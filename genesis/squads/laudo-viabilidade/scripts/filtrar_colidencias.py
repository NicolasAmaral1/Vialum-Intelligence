#!/usr/bin/env python3
"""
Filtro de colidencias potenciais para triagem pre-INPI.

Recebe o JSON limpo da busca fuzzy e filtra marcas que podem
representar colidencia fonetica, grafica ou ideologica com a marca alvo.

Criterio conservador: na duvida, SEMPRE inclui.

Uso:
    python filtrar_colidencias.py fuzzy-clean.json "NOME DA MARCA" \
        --tipo-marca evocativo --classes 35,42 -o suspeitos.json
"""

import json
import re
import sys
import argparse
import unicodedata
from pathlib import Path
from typing import List, Dict, Optional


def normalizar(texto: str) -> str:
    """Remove acentos, converte para minusculo, remove caracteres especiais."""
    if not texto:
        return ""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower().strip()
    texto = re.sub(r"[^a-z0-9\s]", "", texto)
    return texto


def fonetizar_simples(texto: str) -> str:
    """
    Fonetizacao simplificada para portugues brasileiro.

    Agrupa sons semelhantes para detectar colidencia fonetica.
    Nao e perfeito — mas o criterio e conservador (falso positivo > falso negativo).
    """
    t = normalizar(texto)

    # Remover espacos
    t = t.replace(" ", "")

    # Substituicoes foneticas PT-BR
    substituicoes = [
        (r"ph", "f"),
        (r"th", "t"),
        (r"ch", "x"),
        (r"sh", "x"),
        (r"sch", "x"),
        (r"lh", "l"),
        (r"nh", "n"),
        (r"ss", "s"),
        (r"sc", "s"),
        (r"xc", "s"),
        (r"ck", "k"),
        (r"qu", "k"),
        (r"gu(?=[ei])", "g"),
        (r"ce", "se"),
        (r"ci", "si"),
        (r"ge", "je"),
        (r"gi", "ji"),
        (r"y", "i"),
        (r"w", "v"),
        (r"z$", "s"),
        (r"x", "s"),  # simplificacao: x tem muitos sons, melhor capturar
        # Vogais duplicadas
        (r"aa", "a"),
        (r"ee", "e"),
        (r"ii", "i"),
        (r"oo", "o"),
        (r"uu", "u"),
        # Consoantes duplicadas
        (r"bb", "b"),
        (r"cc", "k"),
        (r"dd", "d"),
        (r"ff", "f"),
        (r"gg", "g"),
        (r"ll", "l"),
        (r"mm", "m"),
        (r"nn", "n"),
        (r"pp", "p"),
        (r"rr", "r"),
        (r"tt", "t"),
    ]

    for padrao, sub in substituicoes:
        t = re.sub(padrao, sub, t)

    return t


def similaridade_levenshtein(s1: str, s2: str) -> float:
    """
    Calcula similaridade normalizada (0-1) baseada em distancia de Levenshtein.

    1.0 = identicos, 0.0 = totalmente diferentes
    """
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    len1, len2 = len(s1), len(s2)
    matriz = [[0] * (len2 + 1) for _ in range(len1 + 1)]

    for i in range(len1 + 1):
        matriz[i][0] = i
    for j in range(len2 + 1):
        matriz[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            custo = 0 if s1[i - 1] == s2[j - 1] else 1
            matriz[i][j] = min(
                matriz[i - 1][j] + 1,       # delecao
                matriz[i][j - 1] + 1,       # insercao
                matriz[i - 1][j - 1] + custo  # substituicao
            )

    distancia = matriz[len1][len2]
    max_len = max(len1, len2)
    return 1.0 - (distancia / max_len) if max_len > 0 else 1.0


def contem_raiz(marca_alvo: str, marca_candidata: str) -> bool:
    """Verifica se a raiz da marca alvo esta contida na candidata ou vice-versa."""
    alvo = normalizar(marca_alvo)
    candidata = normalizar(marca_candidata)

    if not alvo or not candidata:
        return False

    # Raiz = primeiros 4+ caracteres (ou o nome inteiro se curto)
    raiz_min = min(4, len(alvo))
    raiz_alvo = alvo[:raiz_min]

    return raiz_alvo in candidata or candidata[:raiz_min] in alvo


def calcular_risco_colidencia(
    marca_alvo: str,
    marca_candidata: str,
    tipo_marca: str,
    classes_alvo: List[int],
    classes_candidata: List[int],
    situacao_candidata: Optional[str],
) -> Dict:
    """
    Avalia risco de colidencia entre marca alvo e candidata.

    Retorna dict com score (0-100), motivos e recomendacao.

    tipo_marca: fantasioso | arbitrario | evocativo | descritivo
    """
    motivos = []
    score = 0

    nome_alvo_norm = normalizar(marca_alvo)
    nome_cand_norm = normalizar(marca_candidata) if marca_candidata else ""

    if not nome_cand_norm:
        return {"score": 0, "motivos": ["Nome vazio"], "recomendacao": "ignorar"}

    # --- COLIDENCIA GRAFICA ---
    sim_grafica = similaridade_levenshtein(nome_alvo_norm, nome_cand_norm)
    if sim_grafica >= 0.85:
        score += 40
        motivos.append(f"Grafica alta ({sim_grafica:.0%})")
    elif sim_grafica >= 0.65:
        score += 25
        motivos.append(f"Grafica media ({sim_grafica:.0%})")
    elif sim_grafica >= 0.50:
        score += 10
        motivos.append(f"Grafica leve ({sim_grafica:.0%})")

    # --- COLIDENCIA FONETICA ---
    fon_alvo = fonetizar_simples(marca_alvo)
    fon_cand = fonetizar_simples(marca_candidata) if marca_candidata else ""
    sim_fonetica = similaridade_levenshtein(fon_alvo, fon_cand)

    if sim_fonetica >= 0.85:
        score += 35
        motivos.append(f"Fonetica alta ({sim_fonetica:.0%})")
    elif sim_fonetica >= 0.65:
        score += 20
        motivos.append(f"Fonetica media ({sim_fonetica:.0%})")
    elif sim_fonetica >= 0.50:
        score += 10
        motivos.append(f"Fonetica leve ({sim_fonetica:.0%})")

    # --- RAIZ COMUM ---
    if contem_raiz(marca_alvo, marca_candidata or ""):
        score += 15
        motivos.append("Raiz comum")

    # --- CLASSES COINCIDENTES ---
    if classes_alvo and classes_candidata:
        classes_comuns = set(classes_alvo) & set(classes_candidata)
        if classes_comuns:
            score += 20
            motivos.append(f"Classes em comum: {sorted(classes_comuns)}")

    # --- AJUSTE POR TIPO DE MARCA ---
    # Marcas fantasiosas/arbitrarias tem protecao mais ampla
    # Marcas evocativas/descritivas tem protecao mais restrita
    if tipo_marca in ("fantasioso", "arbitrario"):
        # Marca forte: mesmo colidencia leve e preocupante
        score = int(score * 1.2)
        if score > 100:
            score = 100
    elif tipo_marca == "descritivo":
        # Marca fraca: so colidencia muito alta importa
        score = int(score * 0.7)

    # --- AJUSTE POR SITUACAO ---
    if situacao_candidata:
        sit_lower = situacao_candidata.lower()
        if "extint" in sit_lower or "arquivad" in sit_lower:
            # Marca morta: risco menor, mas nao zero (pode haver ressurgimento)
            score = int(score * 0.4)
            motivos.append("Marca extinta/arquivada (risco reduzido)")
        elif "indeferid" in sit_lower:
            score = int(score * 0.5)
            motivos.append("Marca indeferida (risco reduzido)")
        elif "registro" in sit_lower or "vigor" in sit_lower:
            score = int(score * 1.1)
            if score > 100:
                score = 100
            motivos.append("Marca em vigor (risco elevado)")

    # --- RECOMENDACAO ---
    if score >= 30:
        recomendacao = "investigar"
    elif score >= 15:
        recomendacao = "investigar"  # Conservador: na duvida, investiga
    else:
        recomendacao = "baixo_risco"

    return {
        "score": score,
        "motivos": motivos,
        "recomendacao": recomendacao,
        "similaridade_grafica": round(sim_grafica, 3),
        "similaridade_fonetica": round(sim_fonetica, 3),
    }


def filtrar_marcas(
    marcas: List[Dict],
    nome_marca_alvo: str,
    tipo_marca: str = "evocativo",
    classes_alvo: Optional[List[int]] = None,
    threshold: int = 15,
) -> Dict:
    """
    Filtra lista de marcas e retorna suspeitas de colidencia.

    Args:
        marcas: Lista de marcas do JSON limpo
        nome_marca_alvo: Nome da marca em analise
        tipo_marca: fantasioso|arbitrario|evocativo|descritivo
        classes_alvo: Classes NCL aprovadas
        threshold: Score minimo para incluir (default: 15, conservador)

    Returns:
        Dict com suspeitas e estatisticas
    """
    classes_alvo = classes_alvo or []
    suspeitas = []
    ignoradas = 0

    for marca in marcas:
        nome_cand = marca.get("nome_marca")
        if not nome_cand:
            ignoradas += 1
            continue

        classes_cand = marca.get("classes", [])
        situacao = marca.get("situacao")

        avaliacao = calcular_risco_colidencia(
            marca_alvo=nome_marca_alvo,
            marca_candidata=nome_cand,
            tipo_marca=tipo_marca,
            classes_alvo=classes_alvo,
            classes_candidata=classes_cand,
            situacao_candidata=situacao,
        )

        if avaliacao["score"] >= threshold:
            suspeitas.append({
                **marca,
                "avaliacao": avaliacao,
            })

    # Ordenar por score decrescente
    suspeitas.sort(key=lambda x: x["avaliacao"]["score"], reverse=True)

    return {
        "marca_alvo": nome_marca_alvo,
        "tipo_marca": tipo_marca,
        "classes_alvo": classes_alvo,
        "threshold": threshold,
        "total_analisadas": len(marcas),
        "total_suspeitas": len(suspeitas),
        "total_ignoradas": ignoradas,
        "suspeitas": suspeitas,
        "protocolos_para_busca_detalhada": [
            s["numero_processo"]
            for s in suspeitas
            if s.get("numero_processo") and s["avaliacao"]["recomendacao"] == "investigar"
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Filtra colidencias potenciais da busca fuzzy INPI",
    )
    parser.add_argument("input_file", help="JSON limpo (fuzzy-clean.json)")
    parser.add_argument("marca", help="Nome da marca alvo")
    parser.add_argument(
        "--tipo-marca",
        choices=["fantasioso", "arbitrario", "evocativo", "descritivo"],
        default="evocativo",
        help="Tipo da marca (default: evocativo)",
    )
    parser.add_argument(
        "--classes",
        help="Classes NCL alvo separadas por virgula (ex: 35,42)",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=15,
        help="Score minimo para incluir como suspeita (default: 15)",
    )
    parser.add_argument(
        "-o", "--output",
        help="JSON de saida (default: suspeitos.json na mesma pasta)",
    )

    args = parser.parse_args()
    input_path = Path(args.input_file)

    if not input_path.exists():
        print(f"Erro: arquivo nao encontrado: {input_path}")
        sys.exit(1)

    classes_alvo = []
    if args.classes:
        classes_alvo = [int(c.strip()) for c in args.classes.split(",")]

    output_path = Path(args.output) if args.output else input_path.parent / "suspeitos.json"

    print(f"Marca alvo: {args.marca}")
    print(f"Tipo: {args.tipo_marca}")
    print(f"Classes alvo: {classes_alvo or 'todas'}")
    print(f"Threshold: {args.threshold}")

    with open(input_path, "r", encoding="utf-8") as f:
        marcas = json.load(f)

    print(f"Marcas carregadas: {len(marcas)}")

    resultado = filtrar_marcas(
        marcas=marcas,
        nome_marca_alvo=args.marca,
        tipo_marca=args.tipo_marca,
        classes_alvo=classes_alvo,
        threshold=args.threshold,
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\nResultado:")
    print(f"  Analisadas: {resultado['total_analisadas']}")
    print(f"  Suspeitas: {resultado['total_suspeitas']}")
    print(f"  Protocolos para busca detalhada: {len(resultado['protocolos_para_busca_detalhada'])}")

    if resultado["suspeitas"]:
        print(f"\nTop 5 suspeitas:")
        for s in resultado["suspeitas"][:5]:
            nome = s.get("nome_marca", "?")
            score = s["avaliacao"]["score"]
            motivos = ", ".join(s["avaliacao"]["motivos"][:3])
            print(f"  [{score:3d}] {nome} — {motivos}")

    print(f"\nSalvo em: {output_path}")
    sys.exit(0)


if __name__ == "__main__":
    main()
