#!/usr/bin/env python3
"""
filtro_heuristica.py — Triagem heurística de marcas coletadas

Classifica marcas em Tiers (T1-T5) baseado na relevância de colidência
com a marca-alvo, usando decomposição em elementos com peso e
comparação fonética adaptada ao português.

Tiers:
    T1 — Colidência direta: contém elemento DISTINTIVO exato
    T2 — Colidência fonética: elemento foneticamente próximo do DISTINTIVO
    T3 — Composição suspeita: fonética fraca + contexto (descritivo ou classe)
    T4 — Só descritivo: match apenas com elemento DESCRITIVO
    T5 — Irrelevante: nenhum match relevante

Uso:
    python filtro_heuristica.py \
        --marca "INQ CAPITAL" \
        --elementos "INQ:DISTINTIVO,CAPITAL:DESCRITIVO" \
        --pasta "laudos/Felipe Kutlak/INQ CAPITAL" \
        --classes 36,35,42,9,41

Output:
    triagem/triagem-resultado.json     (todas as marcas com tier + reason)
    triagem/triagem-por-tier.json      (agrupado por tier)
    triagem/triagem-resumo.md          (resumo legível)
"""

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# ─────────────────────────────────────────────
# FILLERS — palavras sem peso marcário
# ─────────────────────────────────────────────

FILLERS = {
    # Português
    "de", "do", "da", "dos", "das", "e", "em", "no", "na",
    "nos", "nas", "o", "a", "os", "as", "um", "uma", "uns", "umas",
    "com", "para", "por", "sem", "ou", "ao", "aos",
    # Inglês
    "the", "of", "and", "for", "by", "with", "to", "in", "on", "at",
    # Jurídico/empresarial
    "sa", "s.a", "ltda", "me", "eireli", "s/a", "epp", "ei",
    "ltda.", "s.a.", "inc", "corp", "llc", "ltd",
    # Marca genérica
    "marca", "brand", "group", "grupo",
}


# ─────────────────────────────────────────────
# NORMALIZAÇÃO E FONÉTICA
# ─────────────────────────────────────────────

def remove_accents(s: str) -> str:
    """Remove acentos/diacríticos."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize(word: str) -> str:
    """Normalização básica: lowercase, sem acentos, só alfanumérico."""
    w = remove_accents(word.lower().strip())
    w = re.sub(r"[^a-z0-9]", "", w)
    return w


def phonetic(word: str) -> str:
    """
    Forma fonética simplificada para português brasileiro.

    Regras aplicadas em ordem:
    1. Dígrafos → forma canônica
    2. H mudo removido
    3. Equivalências consonantais
    4. C/G contextuais
    """
    w = normalize(word)
    if not w:
        return ""

    # Dígrafos (ordem importa — processar antes de chars individuais)
    digraphs = [
        ("qu", "k"), ("gu", "g"),
        ("ch", "x"), ("sh", "x"),
        ("ss", "s"), ("rr", "r"),
        ("ph", "f"), ("th", "t"),
    ]
    for old, new in digraphs:
        w = w.replace(old, new)

    # H mudo
    w = w.replace("h", "")

    # Equivalências simples
    simple = {"ç": "s", "w": "v", "y": "i", "ñ": "n"}
    for old, new in simple.items():
        w = w.replace(old, new)

    # C antes de E,I → S
    w = re.sub(r"c([ei])", r"s\1", w)

    # G antes de E,I → J
    w = re.sub(r"g([ei])", r"j\1", w)

    # Z final → S
    if w.endswith("z"):
        w = w[:-1] + "s"

    return w


def consonant_skeleton(word: str) -> str:
    """Extrai esqueleto consonantal (remove vogais da forma fonética)."""
    return re.sub(r"[aeiou]", "", phonetic(word))


def levenshtein(s1: str, s2: str) -> int:
    """Distância de Levenshtein entre duas strings."""
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if not s2:
        return len(s1)

    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(
                curr[j] + 1,
                prev[j + 1] + 1,
                prev[j] + (0 if c1 == c2 else 1),
            ))
        prev = curr
    return prev[-1]


# ─────────────────────────────────────────────
# COMPARAÇÃO FONÉTICA
# ─────────────────────────────────────────────

def phonetic_match(word1: str, word2: str) -> Tuple[str, float]:
    """
    Compara duas palavras foneticamente.

    Returns:
        (tipo_match, confiança)
        tipo_match: EXATO | FONETICO_FORTE | FONETICO_FRACO | NENHUM
        confiança: 0.0 — 1.0
    """
    n1 = normalize(word1)
    n2 = normalize(word2)

    if not n1 or not n2:
        return ("NENHUM", 0.0)

    # 1. Match exato (normalizado)
    if n1 == n2:
        return ("EXATO", 1.0)

    p1 = phonetic(word1)
    p2 = phonetic(word2)

    # 2. Match fonético exato
    if p1 == p2:
        return ("FONETICO_FORTE", 0.95)

    # 3. Esqueleto consonantal idêntico
    cs1 = consonant_skeleton(word1)
    cs2 = consonant_skeleton(word2)

    if cs1 and cs2 and cs1 == cs2:
        return ("FONETICO_FORTE", 0.85)

    # 4. Levenshtein na forma fonética
    max_len = max(len(p1), len(p2))
    if max_len == 0:
        return ("NENHUM", 0.0)

    dist_ph = levenshtein(p1, p2)

    # Palavras curtas (≤3 chars): Levenshtein 1 é muito permissivo
    # INQ vs IND/INN/INK/INF — só aceita se consoante final é par surdo/sonoro
    if dist_ph == 1:
        if max_len <= 3:
            # Para palavras curtas, Levenshtein 1 só vale se a diferença
            # é na última posição E é par surdo/sonoro (ex: INK↔ING, INQ↔INC)
            # Caso contrário, é FRACO (não forte)
            diff_is_final = (len(p1) == len(p2) and p1[:-1] == p2[:-1])
            if diff_is_final:
                return ("FONETICO_FORTE", 0.75)
            else:
                return ("FONETICO_FRACO", 0.50)
        else:
            return ("FONETICO_FORTE", 0.80)

    if dist_ph == 2 and max_len >= 5:
        return ("FONETICO_FRACO", 0.60)

    # 5. Levenshtein no esqueleto
    if cs1 and cs2:
        dist_sk = levenshtein(cs1, cs2)
        if dist_sk == 0:
            return ("FONETICO_FORTE", 0.85)
        if dist_sk == 1 and len(cs1) >= 2:
            return ("FONETICO_FRACO", 0.55)

    # 6. Substring — só se é palavra independente (começo de string ou precedido por separador)
    #    "INQ" dentro de "MAQUINQ" não conta. "INQ" como prefixo de "INQUEST" conta.
    if len(p1) >= 3 and len(p2) >= 3:
        shorter, longer = (p1, p2) if len(p1) <= len(p2) else (p2, p1)
        if longer.startswith(shorter) or longer.endswith(shorter):
            return ("FONETICO_FRACO", 0.50)

    return ("NENHUM", 0.0)


# ─────────────────────────────────────────────
# DECOMPOSIÇÃO DE MARCA
# ─────────────────────────────────────────────

def decompose(mark_name: str) -> List[str]:
    """
    Decompõe nome de marca em elementos relevantes.
    Remove fillers e tokens curtos (≤1 char).
    """
    words = re.split(r"[\s\-_/&+.,;:()]+", mark_name.strip())
    elements = []
    for w in words:
        cleaned = normalize(w)
        if cleaned and cleaned not in FILLERS and len(cleaned) > 1:
            elements.append(w.strip())
    return elements


# ─────────────────────────────────────────────
# CLASSIFICAÇÃO POR TIER
# ─────────────────────────────────────────────

def classify(
    mark_name: str,
    target_elements: Dict[str, str],
    mark_class: Optional[int] = None,
    target_classes: Optional[List[int]] = None,
) -> Dict:
    """
    Classifica uma marca coletada em tier T1-T5.

    Args:
        mark_name: nome da marca coletada
        target_elements: {"INQ": "DISTINTIVO", "CAPITAL": "DESCRITIVO"}
        mark_class: classe NCL da marca coletada
        target_classes: classes NCL aprovadas da marca-alvo

    Returns:
        {tier, reason, matches}
    """
    mark_elements = decompose(mark_name)

    if not mark_elements:
        return {"tier": 5, "reason": "Sem elementos após decomposição", "matches": []}

    matches = []
    best_distinctive = "NENHUM"
    best_distinctive_conf = 0.0
    has_descriptive = False

    for me in mark_elements:
        for te, te_type in target_elements.items():
            match_type, confidence = phonetic_match(me, te)

            if match_type == "NENHUM":
                continue

            matches.append({
                "elemento_marca": me,
                "elemento_alvo": te,
                "tipo_alvo": te_type,
                "match": match_type,
                "confianca": round(confidence, 2),
                "fonetica_marca": phonetic(me),
                "fonetica_alvo": phonetic(te),
            })

            if te_type == "DISTINTIVO":
                # Guardar o melhor match distintivo
                rank = {"EXATO": 3, "FONETICO_FORTE": 2, "FONETICO_FRACO": 1}
                curr_rank = rank.get(match_type, 0)
                best_rank = rank.get(best_distinctive, 0)
                if curr_rank > best_rank or (curr_rank == best_rank and confidence > best_distinctive_conf):
                    best_distinctive = match_type
                    best_distinctive_conf = confidence

            elif te_type == "DESCRITIVO":
                if match_type in ("EXATO", "FONETICO_FORTE"):
                    has_descriptive = True

    # ─── Decisão por tier ───

    # T1: match exato com DISTINTIVO
    if best_distinctive == "EXATO":
        return {"tier": 1, "reason": "Contém elemento DISTINTIVO exato", "matches": matches}

    # T2: fonética forte com DISTINTIVO
    if best_distinctive == "FONETICO_FORTE":
        return {"tier": 2, "reason": "Elemento foneticamente próximo do DISTINTIVO (forte)", "matches": matches}

    # T3: fonética fraca com DISTINTIVO + contexto
    if best_distinctive == "FONETICO_FRACO":
        in_target_class = mark_class in (target_classes or []) if mark_class else False
        if has_descriptive or in_target_class:
            return {"tier": 3, "reason": "Fonética fraca DISTINTIVO + contexto descritivo/classe", "matches": matches}
        # Fonética fraca sem contexto → T5 (muito longe, sem conexão)
        return {"tier": 5, "reason": "Fonética fraca sem contexto relevante", "matches": matches}

    # T4: só descritivo
    if has_descriptive:
        return {"tier": 4, "reason": "Match apenas com elemento DESCRITIVO", "matches": matches}

    # T5: nada
    return {"tier": 5, "reason": "Nenhum match relevante", "matches": matches}


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

def executar_triagem(
    marca: str,
    elementos: Dict[str, str],
    pasta: Path,
    classes: List[int],
    apenas_vivas: bool = True,
) -> Dict:
    """
    Executa triagem heurística em todas as marcas coletadas.

    Lê de:
        coleta/classe-{N}-lista.json
        coleta/busca-*/coleta/classe-{N}-lista.json  (buscas auxiliares)
        fonte-bruta.json

    Grava em:
        triagem/triagem-resultado.json
        triagem/triagem-por-tier.json
        triagem/triagem-resumo.md
    """
    pasta = Path(pasta)
    triagem_dir = pasta / "triagem"
    triagem_dir.mkdir(parents=True, exist_ok=True)

    # ─── Carregar todas as marcas ───
    todas = {}  # {numero_processo: marca_dict}

    # 1. fonte-bruta.json (se existir)
    fonte_bruta = pasta / "fonte-bruta.json"
    if fonte_bruta.exists():
        fb = json.load(open(fonte_bruta, encoding="utf-8"))
        for np, data in fb.items():
            todas[np] = data
            todas[np]["numero_processo"] = np

    # 2. Listas por classe (pode ter dados extras)
    coleta_dir = pasta / "coleta"
    for cls in classes:
        cls_file = coleta_dir / f"classe-{cls}-lista.json"
        if cls_file.exists():
            marcas = json.load(open(cls_file, encoding="utf-8"))
            for m in marcas:
                np = m.get("numero_processo")
                if np and np not in todas:
                    todas[np] = m

    # 3. Buscas auxiliares (subpastas em coleta/)
    for subdir in coleta_dir.iterdir():
        if subdir.is_dir() and (subdir / "coleta").is_dir():
            for cls_file in (subdir / "coleta").glob("classe-*-lista.json"):
                marcas = json.load(open(cls_file, encoding="utf-8"))
                for m in marcas:
                    np = m.get("numero_processo")
                    if np and np not in todas:
                        todas[np] = m

    # ─── Separar indeferidas pra flags antes de filtrar ───
    indeferidas = {np: d for np, d in todas.items() if d.get("bucket") == "B"}

    # ─── Filtrar por bucket se apenas_vivas ───
    if apenas_vivas:
        antes = len(todas)
        todas = {np: d for np, d in todas.items() if d.get("bucket", "A") == "A"}
        filtradas = antes - len(todas)
        print(f"Total de marcas únicas: {antes}")
        print(f"Filtradas (mortas + indeferidas): {filtradas}")
        print(f"Vivas para triagem: {len(todas)}")
    else:
        print(f"Total de marcas únicas para triagem: {len(todas)} (incluindo mortas/indeferidas)")

    # ─── FLAGS AUTOMÁTICOS ───
    flags = []

    # Flag CAMPO_SATURADO: >5 marcas vivas com mesmo radical do DISTINTIVO na classe
    distintivos = [e for e, t in elementos.items() if t == "DISTINTIVO"]
    for elem_dist in distintivos:
        radical = normalize(elem_dist)
        for cls in classes:
            count = sum(
                1 for d in todas.values()
                if d.get("classe") == cls
                and radical in normalize(d.get("nome_marca", ""))
            )
            if count > 5:
                flags.append({
                    "tipo": "CAMPO_SATURADO",
                    "elemento": elem_dist,
                    "classe": cls,
                    "contagem": count,
                    "consequencia": "Piso NEUTRA na calibragem",
                })
                print(f"  ⚠ FLAG CAMPO_SATURADO: {count} marcas vivas com '{elem_dist}' na cl.{cls}")

    # Flag HISTORICO_REJEICAO: >3 indeferidas com mesmo radical, mesma classe
    for elem_dist in distintivos:
        radical = normalize(elem_dist)
        for cls in classes:
            indef_count = sum(
                1 for d in indeferidas.values()
                if d.get("classe") == cls
                and radical in normalize(d.get("nome_marca", ""))
            )
            if indef_count > 3:
                flags.append({
                    "tipo": "HISTORICO_REJEICAO",
                    "elemento": elem_dist,
                    "classe": cls,
                    "contagem": indef_count,
                    "consequencia": "Piso NEUTRA na calibragem",
                })
                print(f"  ⚠ FLAG HISTORICO_REJEICAO: {indef_count} indeferidas com '{elem_dist}' na cl.{cls}")

    # Flag CROSS_CLASS: marca idêntica fora do perímetro
    cross_class_file = pasta / "coleta" / "cross-class-alerta.json"
    if cross_class_file.exists():
        cross_data = json.load(open(cross_class_file, encoding="utf-8"))
        if cross_data:
            flags.append({
                "tipo": "CROSS_CLASS",
                "marcas": cross_data,
                "consequencia": "Incluir no review humano",
            })
            print(f"  ⚠ FLAG CROSS_CLASS: {len(cross_data)} marcas idênticas fora do perímetro")

    # ─── Classificar cada marca ───
    resultados = []

    for np, data in todas.items():
        nome = data.get("nome_marca", "")
        if not nome:
            continue

        classe = data.get("classe")
        tier_info = classify(nome, elementos, classe, classes)

        resultado = {
            "numero_processo": np,
            "nome_marca": nome,
            "classe": classe,
            "situacao": data.get("situacao"),
            "titular": data.get("titular"),
            "similaridade_inpi": data.get("similaridade_pct"),
            "bucket": data.get("bucket"),
            "tier": tier_info["tier"],
            "reason": tier_info["reason"],
            "matches": tier_info["matches"],
        }
        resultados.append(resultado)

    # Ordenar: tier ASC, depois confiança DESC
    def sort_key(r):
        best_conf = max((m["confianca"] for m in r["matches"]), default=0)
        return (r["tier"], -best_conf, r["nome_marca"])

    resultados.sort(key=sort_key)

    # ─── Agrupar por tier ───
    por_tier = defaultdict(list)
    for r in resultados:
        por_tier[r["tier"]].append(r)

    # ─── Agrupar por tier + classe ───
    por_tier_classe = {}
    for tier in range(1, 6):
        tier_marcas = por_tier.get(tier, [])
        por_classe = defaultdict(list)
        for m in tier_marcas:
            cls_key = str(m["classe"]) if m["classe"] else "sem_classe"
            por_classe[cls_key].append(m)
        por_tier_classe[f"T{tier}"] = dict(por_classe)

    # ─── Stats ───
    stats = {
        "marca_alvo": marca,
        "elementos": elementos,
        "classes_analisadas": classes,
        "total_analisadas": len(resultados),
        "total_indeferidas": len(indeferidas),
        "por_tier": {f"T{t}": len(por_tier.get(t, [])) for t in range(1, 6)},
        "decisao": {
            "cotejo": sum(len(por_tier.get(t, [])) for t in [1, 2, 3]),
            "desgaste": len(por_tier.get(4, [])),
            "descartadas": len(por_tier.get(5, [])),
        },
        "flags": flags,
        "piso_postura": "NEUTRA" if flags else None,
    }

    # ─── Gravar artefatos ───

    # 1. Resultado completo
    with open(triagem_dir / "triagem-resultado.json", "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    # 2. Agrupado por tier + classe
    with open(triagem_dir / "triagem-por-tier.json", "w", encoding="utf-8") as f:
        json.dump(por_tier_classe, f, ensure_ascii=False, indent=2)

    # 3. Stats
    with open(triagem_dir / "triagem-stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    # 4. Resumo em Markdown
    md = generate_summary(marca, elementos, stats, por_tier, classes)
    with open(triagem_dir / "triagem-resumo.md", "w", encoding="utf-8") as f:
        f.write(md)

    # ─── Print resumo ───
    print(f"\n{'=' * 60}")
    print(f"TRIAGEM HEURÍSTICA — {marca}")
    print(f"{'=' * 60}")
    print(f"  Elementos: {elementos}")
    print(f"  Total analisadas: {stats['total_analisadas']}")
    print(f"  T1 (colidência direta):    {stats['por_tier']['T1']}")
    print(f"  T2 (fonética forte):       {stats['por_tier']['T2']}")
    print(f"  T3 (composição suspeita):  {stats['por_tier']['T3']}")
    print(f"  T4 (só descritivo):        {stats['por_tier']['T4']}")
    print(f"  T5 (irrelevante):          {stats['por_tier']['T5']}")
    print(f"  ─────────────────────────")
    print(f"  → Cotejo (T1+T2+T3): {stats['decisao']['cotejo']}")
    print(f"  → Desgaste (T4):     {stats['decisao']['desgaste']}")
    print(f"  → Descartadas (T5):  {stats['decisao']['descartadas']}")
    if flags:
        print(f"  ─────────────────────────")
        print(f"  FLAGS: {len(flags)}")
        for f in flags:
            print(f"    ⚠ {f['tipo']}: {f.get('elemento', '')} cl.{f.get('classe', '')} ({f.get('contagem', '')})")
        print(f"  Piso postura: NEUTRA")
    print(f"  → Descartadas (T5):  {stats['decisao']['descartadas']}")

    return stats


def generate_summary(
    marca: str,
    elementos: Dict[str, str],
    stats: Dict,
    por_tier: Dict,
    classes: List[int],
) -> str:
    """Gera resumo Markdown da triagem."""
    lines = [
        f"# Triagem Heurística — {marca}\n",
        f"## Decomposição da marca-alvo\n",
    ]

    for elem, tipo in elementos.items():
        lines.append(f"- **{elem}** → {tipo} (fonética: `{phonetic(elem)}`, esqueleto: `{consonant_skeleton(elem)}`)")

    lines.append(f"\n## Resultado\n")
    lines.append(f"| Tier | Qtd | Destino |")
    lines.append(f"|------|-----|---------|")
    lines.append(f"| T1 — Colidência direta | {stats['por_tier']['T1']} | Cotejo |")
    lines.append(f"| T2 — Fonética forte | {stats['por_tier']['T2']} | Cotejo |")
    lines.append(f"| T3 — Composição suspeita | {stats['por_tier']['T3']} | Cotejo |")
    lines.append(f"| T4 — Só descritivo | {stats['por_tier']['T4']} | Mapa de desgaste |")
    lines.append(f"| T5 — Irrelevante | {stats['por_tier']['T5']} | Descartada |")
    lines.append(f"| **Total** | **{stats['total_analisadas']}** | |")

    # T1 detail
    t1 = por_tier.get(1, [])
    if t1:
        lines.append(f"\n## T1 — Colidência direta ({len(t1)} marcas)\n")
        for m in t1:
            sit = m.get("situacao", "?")
            cls = m.get("classe", "?")
            lines.append(f"- **{m['nome_marca']}** (cl.{cls}) — {sit} — `{m['numero_processo']}`")

    # T2 detail
    t2 = por_tier.get(2, [])
    if t2:
        lines.append(f"\n## T2 — Fonética forte ({len(t2)} marcas)\n")
        for m in t2:
            sit = m.get("situacao", "?")
            cls = m.get("classe", "?")
            match_desc = ", ".join(
                f"{x['elemento_marca']}≈{x['elemento_alvo']} ({x['match']}, {x['confianca']})"
                for x in m.get("matches", []) if x["tipo_alvo"] == "DISTINTIVO"
            )
            lines.append(f"- **{m['nome_marca']}** (cl.{cls}) — {sit} — {match_desc}")

    # T3 detail
    t3 = por_tier.get(3, [])
    if t3:
        lines.append(f"\n## T3 — Composição suspeita ({len(t3)} marcas)\n")
        for m in t3[:50]:  # cap pra não ficar gigante
            sit = m.get("situacao", "?")
            cls = m.get("classe", "?")
            lines.append(f"- **{m['nome_marca']}** (cl.{cls}) — {sit}")
        if len(t3) > 50:
            lines.append(f"\n... e mais {len(t3) - 50} marcas (ver triagem-resultado.json)")

    # T4 summary (só contagem por classe, não lista individual)
    t4 = por_tier.get(4, [])
    if t4:
        lines.append(f"\n## T4 — Só descritivo ({len(t4)} marcas) — resumo por classe\n")
        t4_by_class = defaultdict(int)
        for m in t4:
            t4_by_class[m.get("classe", "?")] += 1
        for cls in sorted(t4_by_class.keys(), key=lambda x: str(x)):
            lines.append(f"- Classe {cls}: {t4_by_class[cls]} marcas")

    return "\n".join(lines) + "\n"


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Triagem heurística de marcas coletadas — classificação em Tiers T1-T5",
    )
    parser.add_argument("--marca", required=True, help="Nome da marca-alvo (ex: 'INQ CAPITAL')")
    parser.add_argument(
        "--elementos", required=True,
        help="Elementos com peso, formato: ELEM1:TIPO,ELEM2:TIPO (tipos: DISTINTIVO, DESCRITIVO)",
    )
    parser.add_argument("--pasta", required=True, help="Pasta do caso")
    parser.add_argument(
        "--classes", required=True,
        help="Classes NCL aprovadas, separadas por vírgula",
    )
    parser.add_argument(
        "--incluir-mortas", action="store_true",
        help="Incluir marcas mortas e indeferidas na triagem (default: só Bucket A / vivas)",
    )

    args = parser.parse_args()

    # Parse elementos
    elementos = {}
    for pair in args.elementos.split(","):
        parts = pair.strip().split(":")
        if len(parts) == 2:
            elementos[parts[0].strip()] = parts[1].strip().upper()

    classes = [int(c.strip()) for c in args.classes.split(",")]

    stats = executar_triagem(
        marca=args.marca,
        elementos=elementos,
        pasta=Path(args.pasta),
        classes=classes,
        apenas_vivas=not args.incluir_mortas,
    )

    exit(0 if stats["total_analisadas"] > 0 else 1)


if __name__ == "__main__":
    main()
