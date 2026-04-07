#!/usr/bin/env python3
"""
validar_integridade.py — Anti-alucinação do Pipeline v3

Cruza dados citados em vereditos e relatórios com o fonte-bruta.json.
Detecta discrepâncias: processos inexistentes, nomes trocados,
especificações alteradas, vereditos inconsistentes.

Roda automaticamente:
  - Após Fase 5 (valida vereditos-individuais.json × fonte-bruta.json)
  - Após Fase 6 (valida relatório .md × fonte-bruta.json)

Grava: validacao/validacao-integridade.json

Uso:
    # Validar vereditos
    python validar_integridade.py \\
        --fonte-bruta "fonte-bruta.json" \\
        --vereditos "vereditos/vereditos-individuais.json"

    # Validar relatório markdown
    python validar_integridade.py \\
        --fonte-bruta "fonte-bruta.json" \\
        --relatorio "Plenya - RELATÓRIO TÉCNICO DE COTEJO.md"

    # Validar ambos
    python validar_integridade.py \\
        --fonte-bruta "fonte-bruta.json" \\
        --vereditos "vereditos/vereditos-individuais.json" \\
        --relatorio "Plenya - RELATÓRIO TÉCNICO DE COTEJO.md" \\
        --pasta "laudos/Equipe Plenya/Plenya"
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List


def log(msg: str):
    print(msg, flush=True)


def carregar_fonte_bruta(path: Path) -> Dict:
    """Carrega fonte-bruta.json."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────
# VALIDAÇÃO DE VEREDITOS
# ─────────────────────────────────────────────

def validar_vereditos(
    vereditos_path: Path,
    fonte_bruta: Dict,
) -> List[Dict]:
    """
    Valida vereditos-individuais.json contra fonte-bruta.json.

    Verifica:
    1. Processo citado existe no fonte-bruta?
    2. Nome da marca bate?
    3. Especificação citada bate?
    4. Classe bate?

    Returns:
        Lista de alertas (vazia = tudo OK)
    """
    alertas = []

    with open(vereditos_path, "r", encoding="utf-8") as f:
        vereditos = json.load(f)

    if isinstance(vereditos, dict):
        vereditos = vereditos.get("vereditos", [])

    for v in vereditos:
        processo = v.get("processo") or v.get("numero_processo")
        if not processo:
            alertas.append({
                "tipo": "PROCESSO_AUSENTE",
                "descricao": f"Veredito sem número de processo: {json.dumps(v, ensure_ascii=False)[:200]}",
                "severidade": "ALTA",
            })
            continue

        # 1. Existe no fonte-bruta?
        if processo not in fonte_bruta:
            alertas.append({
                "tipo": "PROCESSO_NAO_ENCONTRADO",
                "processo": processo,
                "descricao": f"Processo {processo} citado no veredito mas NÃO existe no fonte-bruta.json",
                "severidade": "ALTA",
            })
            continue

        fb = fonte_bruta[processo]

        # 2. Nome bate?
        nome_veredito = (v.get("nome") or v.get("nome_marca") or "").strip().upper()
        nome_fb = (fb.get("nome_marca") or "").strip().upper()
        if nome_veredito and nome_fb and nome_veredito != nome_fb:
            alertas.append({
                "tipo": "NOME_DIVERGENTE",
                "processo": processo,
                "nome_veredito": nome_veredito,
                "nome_fonte_bruta": nome_fb,
                "descricao": f"Processo {processo}: nome no veredito '{nome_veredito}' ≠ fonte-bruta '{nome_fb}'",
                "severidade": "ALTA",
            })

        # 3. Spec bate? (comparação de substring — spec citada deve estar contida na completa)
        spec_veredito = v.get("especificacao_completa") or v.get("spec") or ""
        spec_fb = fb.get("especificacao_completa") or ""
        if spec_veredito and spec_fb:
            # Normalizar para comparação
            spec_v_norm = re.sub(r"\s+", " ", spec_veredito.strip().lower())
            spec_fb_norm = re.sub(r"\s+", " ", spec_fb.strip().lower())
            if spec_v_norm and spec_v_norm not in spec_fb_norm and spec_fb_norm not in spec_v_norm:
                # Verificar ao menos 80% de overlap
                palavras_v = set(spec_v_norm.split())
                palavras_fb = set(spec_fb_norm.split())
                if palavras_fb:
                    overlap = len(palavras_v & palavras_fb) / max(len(palavras_v), 1)
                    if overlap < 0.8:
                        alertas.append({
                            "tipo": "SPEC_DIVERGENTE",
                            "processo": processo,
                            "spec_veredito_trecho": spec_veredito[:200],
                            "spec_fonte_bruta_trecho": spec_fb[:200],
                            "overlap": round(overlap, 2),
                            "descricao": f"Processo {processo}: spec no veredito diverge do fonte-bruta (overlap {overlap:.0%})",
                            "severidade": "MÉDIA",
                        })

        # 4. Classe bate?
        classe_v = v.get("classe")
        classe_fb = fb.get("classe")
        if classe_v and classe_fb and int(classe_v) != int(classe_fb):
            alertas.append({
                "tipo": "CLASSE_DIVERGENTE",
                "processo": processo,
                "classe_veredito": classe_v,
                "classe_fonte_bruta": classe_fb,
                "descricao": f"Processo {processo}: classe {classe_v} no veredito ≠ {classe_fb} no fonte-bruta",
                "severidade": "MÉDIA",
            })

    return alertas


# ─────────────────────────────────────────────
# VALIDAÇÃO DE RELATÓRIO MARKDOWN
# ─────────────────────────────────────────────

def validar_relatorio(
    relatorio_path: Path,
    fonte_bruta: Dict,
) -> List[Dict]:
    """
    Valida relatório .md contra fonte-bruta.json.

    Extrai todos os números de processo mencionados no relatório
    e verifica se existem no fonte-bruta.

    Returns:
        Lista de alertas
    """
    alertas = []

    with open(relatorio_path, "r", encoding="utf-8") as f:
        conteudo = f.read()

    # Extrair números de processo (6-9 dígitos que parecem processos INPI)
    processos_citados = set(re.findall(r"\b(\d{6,9})\b", conteudo))

    # Filtrar: só manter os que parecem processos (não datas, CEPs, etc.)
    # Processos INPI são tipicamente 9 dígitos, mas há legados com 6-8
    processos_filtrados = set()
    for p in processos_citados:
        # Ignorar se parece data (ddmmyyyy, dd/mm/yyyy já foi removido mas por segurança)
        if len(p) == 8 and (p[2:4] in ["01","02","03","04","05","06","07","08","09","10","11","12"]):
            continue
        processos_filtrados.add(p)

    processos_no_fb = 0
    processos_fora = 0

    for proc in processos_filtrados:
        if proc in fonte_bruta:
            processos_no_fb += 1
        else:
            processos_fora += 1
            alertas.append({
                "tipo": "PROCESSO_NO_RELATORIO_SEM_FONTE",
                "processo": proc,
                "descricao": f"Processo {proc} citado no relatório mas NÃO existe no fonte-bruta.json",
                "severidade": "ALTA",
            })

    log(f"  Processos no relatório: {len(processos_filtrados)}")
    log(f"  Encontrados no fonte-bruta: {processos_no_fb}")
    log(f"  NÃO encontrados: {processos_fora}")

    return alertas


# ─────────────────────────────────────────────
# PIPELINE
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Anti-alucinação: valida dados citados em vereditos/relatórios contra fonte-bruta.json",
    )
    parser.add_argument("--fonte-bruta", required=True, help="Caminho do fonte-bruta.json")
    parser.add_argument("--vereditos", help="Caminho do vereditos-individuais.json")
    parser.add_argument("--relatorio", help="Caminho do relatório .md")
    parser.add_argument("--pasta", help="Pasta do caso (para salvar resultado)")

    args = parser.parse_args()

    fonte_bruta = carregar_fonte_bruta(Path(args.fonte_bruta))
    log(f"fonte-bruta.json: {len(fonte_bruta)} processos carregados\n")

    todos_alertas = []

    if args.vereditos:
        log("Validando vereditos...")
        alertas_v = validar_vereditos(Path(args.vereditos), fonte_bruta)
        todos_alertas.extend(alertas_v)
        log(f"  Alertas: {len(alertas_v)}\n")

    if args.relatorio:
        log("Validando relatório...")
        alertas_r = validar_relatorio(Path(args.relatorio), fonte_bruta)
        todos_alertas.extend(alertas_r)
        log(f"  Alertas: {len(alertas_r)}\n")

    # Resultado
    status = "OK" if not todos_alertas else "ALERTAS"
    resultado = {
        "status": status,
        "total_alertas": len(todos_alertas),
        "alertas_alta": sum(1 for a in todos_alertas if a.get("severidade") == "ALTA"),
        "alertas_media": sum(1 for a in todos_alertas if a.get("severidade") == "MÉDIA"),
        "alertas": todos_alertas,
    }

    log(f"{'=' * 60}")
    log(f"RESULTADO: {status}")
    log(f"  Total alertas: {len(todos_alertas)}")
    log(f"  Alta severidade: {resultado['alertas_alta']}")
    log(f"  Média severidade: {resultado['alertas_media']}")

    if todos_alertas:
        log(f"\nAlertas:")
        for a in todos_alertas:
            log(f"  [{a['severidade']}] {a['descricao']}")

    # Salvar resultado
    if args.pasta:
        val_dir = Path(args.pasta) / "validacao"
        val_dir.mkdir(parents=True, exist_ok=True)
        val_path = val_dir / "validacao-integridade.json"
        with open(val_path, "w", encoding="utf-8") as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        log(f"\nSalvo em: {val_path}")

    sys.exit(0 if status == "OK" else 1)


if __name__ == "__main__":
    main()
