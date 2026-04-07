#!/usr/bin/env python3
"""
coletar_precedentes.py — Fase 3B.1 do Pipeline v3

Busca fichas completas de marcas indeferidas e mortas (Buckets B + C)
que passaram na peneira. Foco em extrair DESPACHOS (histórico de decisões)
além das especificações expandidas.

Mesma mecânica do coletar_specs.py, mas extrai campos adicionais
relevantes para análise de precedentes.

NÃO interpreta despachos (isso é do @analista-cadeia).
NÃO faz julgamento. Só coleta.

Grava:
  - precedentes/precedentes-fichas.json
  - Enriquece fonte-bruta.json com despachos e specs

Uso:
    python coletar_precedentes.py \\
        --input "peneira/peneira-resultado.json" \\
        --campo "precedentes_nivel_1,precedentes_nivel_2" \\
        --pasta "laudos/Equipe Plenya/Plenya" \\
        --workers 8
"""

import asyncio
import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional

# Reutiliza a mecânica de busca do coletar_specs
from coletar_specs import (
    coletar_fichas_paralelo,
    log,
    agora_iso,
)


async def executar_coleta_precedentes(
    processos: List[str],
    pasta: Path,
    headless: bool = True,
    num_workers: int = 8,
) -> Dict:
    """
    Busca fichas completas (com despachos) de marcas indeferidas/mortas.
    Salva em precedentes/precedentes-fichas.json e enriquece fonte-bruta.json.
    """
    pasta = Path(pasta)
    prec_dir = pasta / "precedentes"
    prec_dir.mkdir(parents=True, exist_ok=True)

    inicio = time.time()

    log(f"{'=' * 60}")
    log(f"FASE 3B.1 — COLETA DE PRECEDENTES (fichas + despachos)")
    log(f"Protocolos: {len(processos)} | Workers: {num_workers}")
    log(f"{'=' * 60}\n")

    resultados = await coletar_fichas_paralelo(processos, num_workers, headless)

    # Salvar fichas
    fichas_lista = []
    for proto in processos:
        if proto in resultados:
            ficha = resultados[proto]
            ficha["tipo_coleta"] = "precedente"
            fichas_lista.append(ficha)

    fichas_path = prec_dir / "precedentes-fichas.json"
    with open(fichas_path, "w", encoding="utf-8") as f:
        json.dump(fichas_lista, f, ensure_ascii=False, indent=2)
    log(f"\n  precedentes-fichas.json: {len(fichas_lista)} fichas")

    # Enriquecer fonte-bruta.json
    fonte_bruta_path = pasta / "fonte-bruta.json"
    if fonte_bruta_path.exists():
        with open(fonte_bruta_path, "r", encoding="utf-8") as f:
            fonte_bruta = json.load(f)

        for proto, ficha in resultados.items():
            if proto in fonte_bruta:
                fonte_bruta[proto]["especificacao_completa"] = ficha.get("especificacao_completa")
                fonte_bruta[proto]["natureza"] = ficha.get("natureza")
                fonte_bruta[proto]["apresentacao"] = ficha.get("apresentacao")
                fonte_bruta[proto]["texto_bruto_ficha"] = ficha.get("texto_bruto")
                fonte_bruta[proto]["precedente_coletado_em"] = ficha.get("coletado_em")

        with open(fonte_bruta_path, "w", encoding="utf-8") as f:
            json.dump(fonte_bruta, f, ensure_ascii=False, indent=2)
        log(f"  fonte-bruta.json: {len(resultados)} processos enriquecidos")

    fim = time.time()
    falhas = [p for p in processos if p not in resultados]

    metadados = {
        "fase": "3B.1",
        "total_solicitados": len(processos),
        "total_coletados": len(resultados),
        "total_falhas": len(falhas),
        "falhas": falhas,
        "duracao_segundos": round(fim - inicio, 1),
    }

    metadados_path = prec_dir / "precedentes-metadados.json"
    with open(metadados_path, "w", encoding="utf-8") as f:
        json.dump(metadados, f, ensure_ascii=False, indent=2)

    log(f"\n  Duração: {metadados['duracao_segundos']}s")
    log(f"  Coletados: {len(resultados)}/{len(processos)}")

    return metadados


def main():
    parser = argparse.ArgumentParser(
        description="Fase 3B.1 — Coleta de fichas de precedentes (indeferidas + mortas)",
    )
    parser.add_argument("--input", help="Caminho do peneira-resultado.json")
    parser.add_argument(
        "--campo",
        default="precedentes_nivel_1,precedentes_nivel_2",
        help="Campos do JSON de input",
    )
    parser.add_argument("--processos", help="Lista direta de processos")
    parser.add_argument("--pasta", required=True)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--visible", action="store_true")

    args = parser.parse_args()

    processos = []
    if args.processos:
        processos = [p.strip() for p in args.processos.split(",") if p.strip()]
    elif args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        campos = [c.strip() for c in args.campo.split(",")]
        for campo in campos:
            processos.extend(data.get(campo, []))

    if not processos:
        print("Nenhum processo para buscar.")
        sys.exit(0)

    # Deduplicar
    vistos = set()
    processos_unicos = [p for p in processos if not (p in vistos or vistos.add(p))]

    resultado = asyncio.run(
        executar_coleta_precedentes(
            processos=processos_unicos,
            pasta=Path(args.pasta),
            headless=not args.visible,
            num_workers=args.workers,
        )
    )

    sys.exit(0 if resultado["total_falhas"] == 0 else 1)


if __name__ == "__main__":
    main()
