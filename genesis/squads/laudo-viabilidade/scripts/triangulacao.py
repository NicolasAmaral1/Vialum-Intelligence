#!/usr/bin/env python3
"""
triangulacao.py — Sistema de Triangulação v4

Pipeline completo:
  1. Seleciona candidatos a triângulo do fonte-bruta (indeferidas + vivas relevantes)
  2. Abre fichas no INPI (despachos + specs) via coletar_precedentes.py
  3. Extrai bloqueadores citados nos despachos (regex, nunca deduz)
  4. Busca specs dos bloqueadores
  5. Classifica triângulos: CONFIRMADO / FRUSTRADO / PARCIAL / OPACO
  6. Ordena por relevância
  7. Calibra postura (RESTRITIVA / NEUTRA / ABERTA)
  8. Gera .md de review com triângulos completos + specs

Uso:
    python triangulacao.py \
        --marca "Pão Pérola Panificadora e Confeitaria" \
        --atividade "fabricação de produtos de padaria e confeitaria" \
        --elemento-distintivo "PEROLA" \
        --pasta "laudos/Equipe Pão Pérola/Pão Pérola" \
        --classes 30,43
"""

import argparse
import asyncio
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Tuple


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ─────────────────────────────────────────────
# ETAPA 1: SELECIONAR CANDIDATOS
# ─────────────────────────────────────────────

def selecionar_candidatos(
    fonte_bruta: Dict,
    elemento_distintivo: str,
    classes_core: List[int],
    atividade: str,
    max_candidatos: int = 15,
) -> List[Dict]:
    """
    Seleciona os processos mais relevantes pra triangulação.

    Prioridade:
    1. Indeferidas com nome parecido ao nosso na classe core
    2. Indeferidas com elemento distintivo na classe core
    3. Vivas com nome parecido (coexistência / ameaça)
    4. Indeferidas com elemento distintivo em classes adjacentes
    """
    elem = elemento_distintivo.upper()
    ativ_words = set(w.lower() for w in atividade.replace(",", " ").split() if len(w) > 3)

    candidatos = []

    for np, m in fonte_bruta.items():
        nome = (m.get("nome_marca") or "").upper()
        classe = m.get("classe")
        bucket = m.get("bucket", "A")
        situacao = (m.get("situacao") or "").lower()

        # Ignorar mortas sem decisão
        if bucket == "C":
            # Mas marcas extintas após vigência são relevantes
            if "extint" not in situacao and "nul" not in situacao:
                continue

        # Tem o elemento distintivo?
        has_elem = elem in nome
        if not has_elem:
            continue

        # Calcular relevância
        relevancia = 0
        motivo = []

        # Classe core = mais relevante
        if classe in classes_core:
            relevancia += 10
            motivo.append("classe core")

        # Indeferida = precedente
        if bucket == "B":
            relevancia += 8
            motivo.append("indeferida (precedente)")
            # Mantida em recurso = mais forte
            if "mantido em grau de recurso" in situacao:
                relevancia += 3
                motivo.append("mantida em recurso")

        # Viva = coexistência ou ameaça
        if bucket == "A":
            relevancia += 5
            motivo.append("viva")
            if "vigor" in situacao:
                relevancia += 2
                motivo.append("em vigor")

        # Nome relacionado à atividade (PÃO, PANIFIC, CONFEIT, etc.)
        nome_lower = nome.lower()
        ativ_matches = [w for w in ativ_words if w in nome_lower]
        if ativ_matches:
            relevancia += 4
            motivo.append(f"nome relacionado ({', '.join(ativ_matches)})")

        # Marca nula = precedente especial
        if "nul" in situacao:
            relevancia += 6
            motivo.append("marca nula")

        candidatos.append({
            "processo": np,
            "nome_marca": m.get("nome_marca"),
            "classe": classe,
            "situacao": m.get("situacao"),
            "titular": m.get("titular"),
            "bucket": bucket,
            "relevancia": relevancia,
            "motivo_relevancia": motivo,
        })

    # Ordenar por relevância DESC
    candidatos.sort(key=lambda x: -x["relevancia"])

    log(f"Candidatos encontrados: {len(candidatos)}")
    log(f"Top {min(max_candidatos, len(candidatos))}:")
    for c in candidatos[:max_candidatos]:
        log(f"  [{c['relevancia']:>2}] {c['nome_marca']:40s} cl.{c['classe']} {c['bucket']} — {', '.join(c['motivo_relevancia'])}")

    return candidatos[:max_candidatos]


# ─────────────────────────────────────────────
# ETAPA 2: ABRIR FICHAS (via coletar_precedentes.py)
# ─────────────────────────────────────────────

def abrir_fichas(
    processos: List[str],
    pasta: Path,
    tor: bool = False,
) -> Dict[str, Dict]:
    """
    Abre fichas no INPI usando coletar_precedentes.py.
    Retorna dict {processo: ficha_completa}.
    """
    fichas_dir = pasta / "fichas"
    fichas_dir.mkdir(parents=True, exist_ok=True)

    # Criar input JSON
    input_file = fichas_dir / "_temp_processos.json"
    with open(input_file, "w") as f:
        json.dump({"processos": processos}, f)

    script = Path(__file__).parent / "coletar_precedentes.py"
    cmd = [
        sys.executable, str(script),
        "--input", str(input_file),
        "--campo", "processos",
        "--pasta", str(pasta),
        "--workers", "3",
    ]
    if tor:
        cmd.append("--tor")

    log(f"Abrindo {len(processos)} fichas no INPI...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    input_file.unlink(missing_ok=True)

    if result.returncode != 0:
        log(f"Erro ao abrir fichas: {result.stderr[:500]}")

    # Ler fichas coletadas
    fichas_path = pasta / "precedentes" / "precedentes-fichas.json"
    if fichas_path.exists():
        fichas_lista = json.load(open(fichas_path, encoding="utf-8"))
        fichas = {}
        for f in fichas_lista:
            np = f.get("numero_processo") or f.get("processo")
            if np:
                fichas[np] = f
        log(f"Fichas coletadas: {len(fichas)}/{len(processos)}")
        return fichas

    return {}


# ─────────────────────────────────────────────
# ETAPA 3: EXTRAIR BLOQUEADORES DOS DESPACHOS
# ─────────────────────────────────────────────

# Regex pra extrair número de processo citado no despacho
RE_PROCESSO_CITADO = re.compile(r'(?:proc(?:esso)?\.?\s*(?:n[ºo°.]?\s*)?|marca\s+)(\d{9,12})', re.IGNORECASE)
RE_PROCESSO_NUMERICO = re.compile(r'\b(\d{9,12})\b')
RE_ARTIGO = re.compile(r'art(?:igo)?\.?\s*124\s*,?\s*(?:inciso\s+)?([IVXLC]+|\d+)', re.IGNORECASE)

def extrair_bloqueador(ficha: Dict) -> Dict:
    """
    Extrai bloqueador e motivo do despacho.
    SÓ relata o que está escrito. NUNCA deduz.

    Returns:
        {
            "bloqueador_processo": str ou None,
            "motivo_literal": str,
            "artigo": str ou None,
            "tem_oposicao": bool,
            "opositor": str ou None,
        }
    """
    texto_bruto = ficha.get("texto_bruto") or ficha.get("texto_bruto_ficha") or ""
    despachos = ficha.get("despachos") or []

    # Juntar tudo pra busca
    texto_completo = texto_bruto
    for d in despachos:
        texto_completo += "\n" + (d.get("complemento") or d.get("texto") or "")

    resultado = {
        "bloqueador_processo": None,
        "motivo_literal": "",
        "artigo": None,
        "tem_oposicao": False,
        "opositor": None,
    }

    if not texto_completo:
        return resultado

    # Buscar artigo citado
    art_match = RE_ARTIGO.search(texto_completo)
    if art_match:
        resultado["artigo"] = f"art. 124, {art_match.group(1)}"

    # Buscar processo bloqueador citado
    proc_matches = RE_PROCESSO_CITADO.findall(texto_completo)
    if not proc_matches:
        # Fallback: buscar qualquer número com 9-12 dígitos que não seja o próprio processo
        proc_proprio = ficha.get("numero_processo") or ficha.get("processo") or ""
        proc_matches = [p for p in RE_PROCESSO_NUMERICO.findall(texto_completo) if p != proc_proprio]

    if proc_matches:
        resultado["bloqueador_processo"] = proc_matches[0]

    # Buscar oposição
    texto_lower = texto_completo.lower()
    if "oposição" in texto_lower or "oposiçao" in texto_lower:
        resultado["tem_oposicao"] = True

    # Extrair motivo literal (trecho relevante do despacho)
    for padrao in [
        r'(indeferid[oa].*?(?:\.|$))',
        r'(art\.?\s*124.*?(?:\.|$))',
        r'(semelhança.*?(?:\.|$))',
        r'(colidência.*?(?:\.|$))',
    ]:
        match = re.search(padrao, texto_completo, re.IGNORECASE)
        if match:
            resultado["motivo_literal"] = match.group(1).strip()[:300]
            break

    return resultado


# ─────────────────────────────────────────────
# ETAPA 4: CLASSIFICAR TRIÂNGULOS
# ─────────────────────────────────────────────

def spec_sobrepoe(spec: str, atividade: str) -> Tuple[bool, str, float]:
    """
    Verifica se uma especificação sobrepõe a atividade do cliente.

    Returns: (sobrepoe, grau, score)
        grau: TOTAL / PARCIAL / NENHUM
        score: 0.0 - 1.0
    """
    if not spec:
        return False, "NENHUM", 0.0

    spec_lower = spec.lower()
    ativ_lower = atividade.lower()

    # Keywords da atividade
    fillers = {"de", "do", "da", "dos", "das", "e", "em", "no", "na", "para", "com", "por"}
    ativ_words = set(w for w in ativ_lower.replace(",", " ").replace(";", " ").split() if len(w) > 3 and w not in fillers)

    # Keywords extras pra panificação/confeitaria
    keywords_segmento = {
        "pão", "paes", "pães", "panificação", "panificacao", "confeitaria",
        "bolo", "bolos", "biscoito", "biscoitos", "doce", "doces",
        "massa", "massas", "farinha", "padaria", "torta", "tortas",
        "salgado", "salgados", "confeit", "pastel", "pastéis",
        "alimentação", "alimentacao", "aliment", "café", "cafe",
        "restaurante", "lanchonete", "bufê", "bufe", "buffet",
    }

    # Combinar
    all_keywords = ativ_words | keywords_segmento

    matches = [w for w in all_keywords if w in spec_lower]
    ratio = len(matches) / len(all_keywords) if all_keywords else 0

    if ratio >= 0.15 or len(matches) >= 3:
        return True, "TOTAL", ratio
    elif ratio >= 0.05 or len(matches) >= 1:
        return True, "PARCIAL", ratio
    else:
        return False, "NENHUM", ratio


def classificar_triangulo(
    candidato: Dict,
    ficha: Dict,
    bloqueador_info: Dict,
    ficha_bloqueador: Optional[Dict],
    atividade: str,
) -> Dict:
    """
    Classifica um triângulo como CONFIRMADO, FRUSTRADO, PARCIAL ou OPACO.
    """
    # Spec do precedente
    spec_prec = ficha.get("especificacao_completa") or ficha.get("especificacao") or ""
    sobrepoe_prec, grau_prec, score_prec = spec_sobrepoe(spec_prec, atividade)

    # Se spec do precedente não sobrepõe → FRUSTRADO
    if not sobrepoe_prec:
        return {
            **candidato,
            "tipo_triangulo": "FRUSTRADO",
            "spec_precedente": spec_prec[:500],
            "sobreposicao_precedente": grau_prec,
            "score_precedente": round(score_prec, 3),
            "motivo": f"Spec do precedente sem sobreposição com atividade ({grau_prec})",
            "bloqueador": bloqueador_info,
        }

    # Se não tem bloqueador identificado → depende do status
    if not bloqueador_info.get("bloqueador_processo"):
        tipo = "OPACO" if candidato["bucket"] == "B" else "CONFIRMADO"
        motivo = "Indeferida sem bloqueador identificado no despacho" if tipo == "OPACO" else "Marca viva com spec sobrepondo atividade"
        return {
            **candidato,
            "tipo_triangulo": tipo,
            "spec_precedente": spec_prec[:500],
            "sobreposicao_precedente": grau_prec,
            "score_precedente": round(score_prec, 3),
            "motivo": motivo,
            "motivo_literal": bloqueador_info.get("motivo_literal", ""),
            "artigo": bloqueador_info.get("artigo"),
            "bloqueador": bloqueador_info,
        }

    # Tem bloqueador — verificar spec do bloqueador
    spec_bloq = ""
    if ficha_bloqueador:
        spec_bloq = ficha_bloqueador.get("especificacao_completa") or ficha_bloqueador.get("especificacao") or ""

    sobrepoe_bloq, grau_bloq, score_bloq = spec_sobrepoe(spec_bloq, atividade)

    if sobrepoe_bloq:
        tipo = "CONFIRMADO"
        motivo = f"Precedente e bloqueador com spec sobrepondo atividade"
    else:
        tipo = "PARCIAL"
        motivo = f"Precedente sobrepõe mas bloqueador fora do segmento ({grau_bloq})"

    return {
        **candidato,
        "tipo_triangulo": tipo,
        "spec_precedente": spec_prec[:500],
        "sobreposicao_precedente": grau_prec,
        "score_precedente": round(score_prec, 3),
        "spec_bloqueador": spec_bloq[:500],
        "sobreposicao_bloqueador": grau_bloq,
        "score_bloqueador": round(score_bloq, 3),
        "bloqueador": {
            **bloqueador_info,
            "nome_marca_bloqueador": ficha_bloqueador.get("nome_marca") if ficha_bloqueador else None,
            "classe_bloqueador": ficha_bloqueador.get("classe") if ficha_bloqueador else None,
            "situacao_bloqueador": ficha_bloqueador.get("situacao") if ficha_bloqueador else None,
        },
        "motivo": motivo,
        "motivo_literal": bloqueador_info.get("motivo_literal", ""),
        "artigo": bloqueador_info.get("artigo"),
    }


# ─────────────────────────────────────────────
# ETAPA 5: CALIBRAR POSTURA
# ─────────────────────────────────────────────

def calibrar_postura(triangulos: List[Dict], flags: List[Dict], classes_core: List[int]) -> Dict:
    """Calibra postura baseado nos triângulos + flags."""
    confirmados = [t for t in triangulos if t["tipo_triangulo"] == "CONFIRMADO"]
    frustrados = [t for t in triangulos if t["tipo_triangulo"] == "FRUSTRADO"]
    parciais = [t for t in triangulos if t["tipo_triangulo"] == "PARCIAL"]
    opacos = [t for t in triangulos if t["tipo_triangulo"] == "OPACO"]

    conf_core = [t for t in confirmados if t.get("classe") in classes_core]
    has_flag = len(flags) > 0

    if conf_core:
        postura = "RESTRITIVA"
        base = f"{len(conf_core)} triângulo(s) confirmado(s) na classe core"
    elif has_flag and not confirmados:
        postura = "NEUTRA"
        base = f"Flags ativos ({len(flags)}) sem triângulos confirmados na core"
    elif confirmados:
        postura = "NEUTRA"
        base = f"{len(confirmados)} triângulo(s) confirmado(s) fora da classe core"
    elif parciais or opacos:
        postura = "NEUTRA"
        base = f"Triângulos parciais/opacos sem confirmação clara"
    else:
        postura = "ABERTA"
        base = f"Nenhum triângulo confirmado. Expandir pra indiretas."

    return {
        "postura": postura,
        "base": base,
        "confirmados": len(confirmados),
        "confirmados_core": len(conf_core),
        "frustrados": len(frustrados),
        "parciais": len(parciais),
        "opacos": len(opacos),
        "flags": len(flags),
    }


# ─────────────────────────────────────────────
# ETAPA 6: GERAR .MD DE REVIEW
# ─────────────────────────────────────────────

def gerar_review_md(
    marca: str,
    atividade: str,
    triangulos: List[Dict],
    postura: Dict,
    ameacas: List[Dict],
    pasta: Path,
) -> Path:
    """Gera .md completo de revisão com triângulos + specs."""

    confirmados = [t for t in triangulos if t["tipo_triangulo"] == "CONFIRMADO"]
    frustrados = [t for t in triangulos if t["tipo_triangulo"] == "FRUSTRADO"]
    parciais = [t for t in triangulos if t["tipo_triangulo"] == "PARCIAL"]
    opacos = [t for t in triangulos if t["tipo_triangulo"] == "OPACO"]

    lines = []
    lines.append(f"# {marca} — Triangulação\n")
    lines.append(f"> Revise os triângulos. `[x]` = considerar no laudo / `[ ]` = descartar")
    lines.append(f"> Cada triângulo mostra specs completas dos vértices.\n")

    lines.append(f"## Postura calibrada: {postura['postura']}\n")
    lines.append(f"**{postura['base']}**\n")
    lines.append(f"| Tipo | Qtd |")
    lines.append(f"|------|-----|")
    lines.append(f"| Confirmados | {postura['confirmados']} |")
    lines.append(f"| Parciais | {postura['parciais']} |")
    lines.append(f"| Opacos | {postura['opacos']} |")
    lines.append(f"| Frustrados | {postura['frustrados']} |")

    # ─── CONFIRMADOS ───
    if confirmados:
        lines.append(f"\n---\n")
        lines.append(f"## Triângulos confirmados ({len(confirmados)})\n")

        for i, t in enumerate(confirmados, 1):
            bloq = t.get("bloqueador", {})
            lines.append(f"### Triângulo {i}: {t['nome_marca']} (cl.{t.get('classe','?')})\n")
            lines.append(f"**Relevância:** {t.get('relevancia', '?')}/30 — {', '.join(t.get('motivo_relevancia', []))}\n")

            lines.append(f"| Vértice | Marca | Processo | Status |")
            lines.append(f"|---------|-------|----------|--------|")
            lines.append(f"| Nossa | {marca} | — | Em análise |")
            lines.append(f"| Precedente | {t['nome_marca']} | {t['processo']} | {t.get('situacao','?')} |")
            if bloq.get("bloqueador_processo"):
                nome_bloq = bloq.get("nome_marca_bloqueador") or "não identificado"
                lines.append(f"| Bloqueador | {nome_bloq} | {bloq['bloqueador_processo']} | {bloq.get('situacao_bloqueador', '?')} |")

            lines.append(f"\n**Spec do precedente** (sobreposição: {t.get('sobreposicao_precedente', '?')}):")
            lines.append(f"> {t.get('spec_precedente', 'não disponível')}\n")

            if t.get("spec_bloqueador"):
                lines.append(f"**Spec do bloqueador** (sobreposição: {t.get('sobreposicao_bloqueador', '?')}):")
                lines.append(f"> {t.get('spec_bloqueador', 'não disponível')}\n")

            if t.get("motivo_literal"):
                lines.append(f"**Despacho:** {t['motivo_literal']}\n")

            if t.get("artigo"):
                lines.append(f"**Artigo:** {t['artigo']}\n")

            lines.append(f"- [x] Considerar este triângulo no laudo\n")

    # ─── PARCIAIS ───
    if parciais:
        lines.append(f"\n---\n")
        lines.append(f"## Triângulos parciais ({len(parciais)})\n")
        lines.append(f"Precedente sobrepõe atividade mas bloqueador fora do segmento.\n")

        for t in parciais:
            lines.append(f"### {t['nome_marca']} (cl.{t.get('classe','?')})\n")
            lines.append(f"**Spec precedente:** {t.get('spec_precedente', '')[:200]}...")
            if t.get("spec_bloqueador"):
                lines.append(f"**Spec bloqueador:** {t.get('spec_bloqueador', '')[:200]}...")
            if t.get("motivo_literal"):
                lines.append(f"**Despacho:** {t['motivo_literal']}")
            lines.append(f"\n- [ ] Considerar no laudo\n")

    # ─── OPACOS ───
    if opacos:
        lines.append(f"\n---\n")
        lines.append(f"## Triângulos opacos ({len(opacos)})\n")
        lines.append(f"Indeferidas sem bloqueador citado no despacho.\n")

        for t in opacos:
            lines.append(f"- {t['nome_marca']} (cl.{t.get('classe','?')}) — {t.get('situacao','?')}")
            if t.get("motivo_literal"):
                lines.append(f"  Despacho: {t['motivo_literal']}")
            lines.append(f"  Spec: {t.get('spec_precedente', '')[:150]}")

    # ─── FRUSTRADOS ───
    if frustrados:
        lines.append(f"\n---\n")
        lines.append(f"## Triângulos frustrados ({len(frustrados)})\n")
        lines.append(f"Spec sem sobreposição com atividade do cliente — descartados.\n")

        for t in frustrados:
            lines.append(f"- ~~{t['nome_marca']}~~ (cl.{t.get('classe','?')}) — Spec: {t.get('spec_precedente', '')[:100]}...")

    # ─── AMEAÇAS ATIVAS ───
    if ameacas:
        lines.append(f"\n---\n")
        lines.append(f"## Ameaças ativas — sem decisão de mérito ({len(ameacas)})\n")
        lines.append(f"Não servem como precedente mas representam risco de oposição.\n")

        for a in ameacas:
            lines.append(f"- **{a['nome_marca']}** (proc. {a['processo']}) — cl.{a.get('classe','?')} — {a.get('situacao','?')}")

    lines.append(f"\n---\n")
    lines.append("Quando terminar, me avise. Sigo com o laudo baseado nos triângulos marcados.\n")

    md = "\n".join(lines) + "\n"
    out = pasta / f"{marca} - TRIANGULACAO.md"
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)

    return out


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

def executar_triangulacao(
    marca: str,
    atividade: str,
    elemento_distintivo: str,
    pasta: Path,
    classes_core: List[int],
    tor: bool = False,
    max_candidatos: int = 15,
) -> Dict:
    """Pipeline completo de triangulação."""

    pasta = Path(pasta)
    tri_dir = pasta / "triangulacao"
    tri_dir.mkdir(parents=True, exist_ok=True)

    # ─── Carregar dados ───
    fb = json.load(open(pasta / "fonte-bruta.json", encoding="utf-8"))

    # Carregar flags da triagem (se existir)
    flags = []
    stats_file = pasta / "triagem" / "triagem-stats.json"
    if stats_file.exists():
        stats = json.load(open(stats_file, encoding="utf-8"))
        flags = stats.get("flags", [])

    log(f"{'=' * 60}")
    log(f"TRIANGULAÇÃO — {marca}")
    log(f"Elemento distintivo: {elemento_distintivo}")
    log(f"Atividade: {atividade}")
    log(f"Classes core: {classes_core}")
    log(f"Fonte-bruta: {len(fb)} processos")
    log(f"Flags: {len(flags)}")
    log(f"{'=' * 60}\n")

    # ─── ETAPA 1: Selecionar candidatos ───
    log("ETAPA 1 — Selecionando candidatos...\n")
    candidatos = selecionar_candidatos(fb, elemento_distintivo, classes_core, atividade, max_candidatos)

    if not candidatos:
        log("Nenhum candidato encontrado.")
        return {"erro": "sem candidatos"}

    # Separar: com decisão de mérito vs sem
    processos_ficha = [c["processo"] for c in candidatos]

    # ─── ETAPA 2: Abrir fichas ───
    log(f"\nETAPA 2 — Abrindo {len(processos_ficha)} fichas no INPI...\n")
    fichas = abrir_fichas(processos_ficha, pasta, tor=tor)

    # ─── ETAPA 3: Extrair bloqueadores + specs ───
    log(f"\nETAPA 3 — Extraindo bloqueadores dos despachos...\n")

    bloqueadores_a_buscar = set()
    candidatos_com_bloqueador = []

    for cand in candidatos:
        proc = cand["processo"]
        ficha = fichas.get(proc)

        if not ficha:
            log(f"  {cand['nome_marca']:40s} — ficha não disponível")
            continue

        bloq_info = extrair_bloqueador(ficha)
        cand["bloqueador_info"] = bloq_info
        cand["ficha"] = ficha
        candidatos_com_bloqueador.append(cand)

        if bloq_info["bloqueador_processo"]:
            bloqueadores_a_buscar.add(bloq_info["bloqueador_processo"])
            log(f"  {cand['nome_marca']:40s} → bloqueador: {bloq_info['bloqueador_processo']} ({bloq_info.get('artigo', '?')})")
        else:
            status = "oposição" if bloq_info["tem_oposicao"] else "sem bloqueador citado"
            log(f"  {cand['nome_marca']:40s} → {status}")

    # Buscar fichas dos bloqueadores (nível 2)
    bloqueadores_novos = [b for b in bloqueadores_a_buscar if b not in fichas]
    fichas_bloqueadores = {}

    if bloqueadores_novos:
        log(f"\nETAPA 3B — Buscando fichas de {len(bloqueadores_novos)} bloqueadores...\n")
        fichas_bloqueadores = abrir_fichas(bloqueadores_novos, pasta, tor=tor)

    # Juntar todas as fichas
    todas_fichas = {**fichas, **fichas_bloqueadores}

    # ─── ETAPA 4: Classificar triângulos ───
    log(f"\nETAPA 4 — Classificando triângulos...\n")

    triangulos = []
    ameacas = []

    for cand in candidatos_com_bloqueador:
        ficha = cand["ficha"]
        bloq_info = cand["bloqueador_info"]
        situacao = (cand.get("situacao") or "").lower()

        # Sem decisão de mérito → ameaça ativa, não triângulo
        sem_decisao = any(k in situacao for k in ["aguardando", "exame", "oposição", "prazo", "sobrestamento"])
        if sem_decisao and cand["bucket"] == "A":
            ameacas.append(cand)
            log(f"  {cand['nome_marca']:40s} → AMEAÇA ATIVA (sem decisão)")
            continue

        # Buscar ficha do bloqueador
        ficha_bloq = None
        if bloq_info.get("bloqueador_processo"):
            ficha_bloq = todas_fichas.get(bloq_info["bloqueador_processo"])

        tri = classificar_triangulo(cand, ficha, bloq_info, ficha_bloq, atividade)
        triangulos.append(tri)

        log(f"  {cand['nome_marca']:40s} → {tri['tipo_triangulo']:12s} (spec {tri.get('sobreposicao_precedente', '?')})")

    # Ordenar por tipo (CONFIRMADO > PARCIAL > OPACO > FRUSTRADO) e relevância
    tipo_ordem = {"CONFIRMADO": 0, "PARCIAL": 1, "OPACO": 2, "FRUSTRADO": 3}
    triangulos.sort(key=lambda t: (tipo_ordem.get(t["tipo_triangulo"], 9), -t.get("relevancia", 0)))

    # ─── ETAPA 5: Calibrar postura ───
    log(f"\nETAPA 5 — Calibrando postura...\n")
    postura = calibrar_postura(triangulos, flags, classes_core)

    log(f"  Postura: {postura['postura']}")
    log(f"  Base: {postura['base']}")

    # ─── ETAPA 6: Gravar artefatos ───
    log(f"\nETAPA 6 — Gravando artefatos...\n")

    # Remover fichas brutas dos triângulos (muito grande pra JSON)
    for t in triangulos:
        t.pop("ficha", None)
    for a in ameacas:
        a.pop("ficha", None)

    with open(tri_dir / "triangulos.json", "w", encoding="utf-8") as f:
        json.dump(triangulos, f, ensure_ascii=False, indent=2)

    with open(tri_dir / "ameacas-ativas.json", "w", encoding="utf-8") as f:
        json.dump(ameacas, f, ensure_ascii=False, indent=2)

    with open(tri_dir / "postura.json", "w", encoding="utf-8") as f:
        json.dump(postura, f, ensure_ascii=False, indent=2)

    # Gerar .md de review
    out_md = gerar_review_md(marca, atividade, triangulos, postura, ameacas, pasta)

    log(f"\n{'=' * 60}")
    log(f"RESULTADO — {marca}")
    log(f"{'=' * 60}")
    log(f"  Triângulos: {len(triangulos)}")
    log(f"    Confirmados: {postura['confirmados']}")
    log(f"    Parciais:    {postura['parciais']}")
    log(f"    Opacos:      {postura['opacos']}")
    log(f"    Frustrados:  {postura['frustrados']}")
    log(f"  Ameaças ativas: {len(ameacas)}")
    log(f"  Postura: {postura['postura']}")
    log(f"  Review: {out_md}")

    return postura


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Triangulação v4 — fichas + specs + triângulos + postura",
    )
    parser.add_argument("--marca", required=True)
    parser.add_argument("--atividade", required=True)
    parser.add_argument("--elemento-distintivo", required=True)
    parser.add_argument("--pasta", required=True)
    parser.add_argument("--classes", required=True, help="Classes core separadas por vírgula")
    parser.add_argument("--tor", action="store_true")
    parser.add_argument("--max-candidatos", type=int, default=15)

    args = parser.parse_args()
    classes = [int(c.strip()) for c in args.classes.split(",")]

    resultado = executar_triangulacao(
        marca=args.marca,
        atividade=args.atividade,
        elemento_distintivo=args.elemento_distintivo,
        pasta=Path(args.pasta),
        classes_core=classes,
        tor=args.tor,
        max_candidatos=args.max_candidatos,
    )

    sys.exit(0 if resultado.get("postura") else 1)


if __name__ == "__main__":
    main()
