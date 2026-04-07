#!/usr/bin/env python3
"""
coletar_bloqueadores.py — Fase 3B.3 do Pipeline v3

Busca fichas completas dos processos que BLOQUEARAM marcas indeferidas.
A lista vem do @analista-cadeia (fila-busca-bloqueadores.json) e cada
item carrega RASTREABILIDADE: por que essa busca foi feita e qual marca
foi impactada.

A rastreabilidade é preservada no output — cada ficha coletada mantém
o campo 'rastreabilidade' original.

Se um bloqueador também foi indeferido, o @analista-cadeia pode gerar
uma segunda fila (nível 2), mas isso é tratado pelo orquestrador.

NÃO faz julgamento. Só coleta e preserva rastreabilidade.

Grava:
  - precedentes/bloqueadores-fichas.json
  - Enriquece fonte-bruta.json

Uso:
    python coletar_bloqueadores.py \\
        --input "precedentes/fila-busca-bloqueadores.json" \\
        --pasta "laudos/Equipe Plenya/Plenya" \\
        --workers 8
"""

import asyncio
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict

from coletar_specs import (
    coletar_fichas_paralelo,
    log,
    agora_iso,
)


async def executar_coleta_bloqueadores(
    fila: List[Dict],
    pasta: Path,
    headless: bool = True,
    num_workers: int = 8,
) -> Dict:
    """
    Busca fichas completas dos processos bloqueadores.
    Preserva rastreabilidade de cada item da fila.

    Args:
        fila: Lista de dicts com campos:
            - processo: número do processo bloqueador
            - buscado_porque: motivo da busca
            - relevancia_para_caso: impacto no caso atual
            - processo_origem: processo que foi bloqueado por este
    """
    pasta = Path(pasta)
    prec_dir = pasta / "precedentes"
    prec_dir.mkdir(parents=True, exist_ok=True)

    inicio = time.time()

    # Extrair lista de processos e mapear rastreabilidade
    processos = []
    rastreabilidade_map: Dict[str, Dict] = {}

    for item in fila:
        proto = item.get("processo")
        if proto and proto not in rastreabilidade_map:
            processos.append(proto)
            rastreabilidade_map[proto] = {
                "buscado_porque": item.get("buscado_porque", ""),
                "relevancia_para_caso": item.get("relevancia_para_caso", ""),
                "processo_origem": item.get("processo_origem", ""),
                "nome_origem": item.get("nome_origem", ""),
                "originado_na_fase": "3B.3",
            }

    log(f"{'=' * 60}")
    log(f"FASE 3B.3 — COLETA DE BLOQUEADORES (com rastreabilidade)")
    log(f"Protocolos: {len(processos)} | Workers: {num_workers}")
    log(f"{'=' * 60}\n")

    if not processos:
        log("  Nenhum bloqueador para buscar.")
        return {"total_solicitados": 0, "total_coletados": 0}

    resultados = await coletar_fichas_paralelo(processos, num_workers, headless)

    # Adicionar rastreabilidade a cada ficha
    bloqueadores_lista = []
    for proto in processos:
        if proto in resultados:
            ficha = resultados[proto]
            ficha["rastreabilidade"] = rastreabilidade_map.get(proto, {})
            ficha["tipo_coleta"] = "bloqueador"
            bloqueadores_lista.append(ficha)

    # Salvar
    bloq_path = prec_dir / "bloqueadores-fichas.json"
    with open(bloq_path, "w", encoding="utf-8") as f:
        json.dump(bloqueadores_lista, f, ensure_ascii=False, indent=2)
    log(f"\n  bloqueadores-fichas.json: {len(bloqueadores_lista)} fichas (com rastreabilidade)")

    # Enriquecer fonte-bruta.json
    fonte_bruta_path = pasta / "fonte-bruta.json"
    if fonte_bruta_path.exists():
        with open(fonte_bruta_path, "r", encoding="utf-8") as f:
            fonte_bruta = json.load(f)

        for proto, ficha in resultados.items():
            # Bloqueadores podem não estar no fonte-bruta original
            # (vieram de despachos, não da busca fuzzy)
            if proto not in fonte_bruta:
                fonte_bruta[proto] = {
                    "nome_marca": ficha.get("nome_marca"),
                    "classe": ficha.get("classe"),
                    "situacao": ficha.get("situacao"),
                    "titular": ficha.get("titular"),
                    "bucket": "BLOQUEADOR",
                    "fonte": "busca-por-rastreabilidade",
                    "coletado_em": agora_iso(),
                }

            fonte_bruta[proto]["especificacao_completa"] = ficha.get("especificacao_completa")
            fonte_bruta[proto]["natureza"] = ficha.get("natureza")
            fonte_bruta[proto]["apresentacao"] = ficha.get("apresentacao")
            fonte_bruta[proto]["rastreabilidade"] = rastreabilidade_map.get(proto, {})
            fonte_bruta[proto]["bloqueador_coletado_em"] = agora_iso()

        with open(fonte_bruta_path, "w", encoding="utf-8") as f:
            json.dump(fonte_bruta, f, ensure_ascii=False, indent=2)
        log(f"  fonte-bruta.json: {len(resultados)} bloqueadores adicionados/enriquecidos")

    fim = time.time()
    falhas = [p for p in processos if p not in resultados]

    metadados = {
        "fase": "3B.3",
        "total_solicitados": len(processos),
        "total_coletados": len(resultados),
        "total_falhas": len(falhas),
        "falhas": falhas,
        "duracao_segundos": round(fim - inicio, 1),
    }

    metadados_path = prec_dir / "bloqueadores-metadados.json"
    with open(metadados_path, "w", encoding="utf-8") as f:
        json.dump(metadados, f, ensure_ascii=False, indent=2)

    log(f"\n  Duração: {metadados['duracao_segundos']}s")
    log(f"  Coletados: {len(resultados)}/{len(processos)}")

    return metadados


def main():
    parser = argparse.ArgumentParser(
        description="Fase 3B.3 — Coleta de fichas de bloqueadores com rastreabilidade",
    )
    parser.add_argument(
        "--input", required=True,
        help="Caminho do fila-busca-bloqueadores.json",
    )
    parser.add_argument("--pasta", required=True)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--visible", action="store_true")

    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        fila = json.load(f)

    if not fila:
        print("Fila vazia — nenhum bloqueador para buscar.")
        sys.exit(0)

    resultado = asyncio.run(
        executar_coleta_bloqueadores(
            fila=fila,
            pasta=Path(args.pasta),
            headless=not args.visible,
            num_workers=args.workers,
        )
    )

    sys.exit(0 if resultado.get("total_falhas", 0) == 0 else 1)


if __name__ == "__main__":
    main()
