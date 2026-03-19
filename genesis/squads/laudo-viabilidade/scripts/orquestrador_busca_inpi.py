#!/usr/bin/env python3
"""
Orquestrador da busca automatica no INPI.

Amarra todo o pipeline de busca automatizada:
1. Busca fuzzy via Playwright
2. Limpeza dos resultados
3. Filtragem de colidencias potenciais
4. Busca detalhada por protocolo (paralela)
5. Consolida tudo em inpi-raw.txt (formato do processar_inpi.py)

Uso:
    python orquestrador_busca_inpi.py \
        --marca "NOME DA MARCA" \
        --pasta "laudos/Cliente/Marca/" \
        --tipo-marca evocativo \
        --classes 35,42 \
        --max-paginas 10
"""

import asyncio
import json
import sys
import time
import argparse
from pathlib import Path
from typing import List, Optional


def log(msg: str):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")


async def executar_pipeline(
    nome_marca: str,
    pasta: Path,
    tipo_marca: str = "evocativo",
    classes_alvo: Optional[List[int]] = None,
    max_paginas: int = 10,
    max_concorrencia: int = 2,
    headless: bool = True,
    threshold: int = 15,
) -> dict:
    """
    Executa o pipeline completo de busca automatica.

    Returns:
        Dict com estatisticas e caminhos dos arquivos gerados
    """
    classes_alvo = classes_alvo or []
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)

    resultado = {
        "sucesso": False,
        "etapas": {},
        "arquivos": {},
        "erro": None,
    }

    # Caminhos dos arquivos intermediarios
    raw_fuzzy_path = pasta / "raw-fuzzy.md"
    fuzzy_clean_path = pasta / "fuzzy-clean.json"
    suspeitos_path = pasta / "suspeitos.json"
    inpi_raw_path = pasta / "inpi-raw.txt"

    try:
        # === ETAPA 1: Busca Fuzzy ===
        log(f"ETAPA 1/4: Busca fuzzy por '{nome_marca}'...")
        from busca_inpi_fuzzy import executar_busca_fuzzy

        stats_fuzzy = await executar_busca_fuzzy(
            nome_marca=nome_marca,
            output_path=raw_fuzzy_path,
            max_paginas=max_paginas,
            headless=headless,
        )

        resultado["etapas"]["fuzzy"] = stats_fuzzy
        resultado["arquivos"]["raw_fuzzy"] = str(raw_fuzzy_path)

        if not stats_fuzzy.get("sucesso"):
            resultado["erro"] = f"Busca fuzzy falhou: {stats_fuzzy.get('erro')}"
            log(f"ERRO: {resultado['erro']}")
            return resultado

        if stats_fuzzy.get("total_resultados_estimado", 0) == 0:
            log("Nenhum resultado na busca fuzzy. Campo livre!")
            # Criar inpi-raw.txt vazio (campo livre = sem anterioridades)
            inpi_raw_path.write_text("", encoding="utf-8")
            resultado["sucesso"] = True
            resultado["arquivos"]["inpi_raw"] = str(inpi_raw_path)
            resultado["etapas"]["resultado"] = "campo_livre"
            return resultado

        log(f"  Paginas coletadas: {stats_fuzzy['paginas_coletadas']}")

        # === ETAPA 2: Limpeza ===
        log("ETAPA 2/4: Limpando resultados...")
        from limpar_resultados_fuzzy import extrair_marcas_de_texto, deduplicar

        texto_bruto = raw_fuzzy_path.read_text(encoding="utf-8")
        marcas = extrair_marcas_de_texto(texto_bruto)
        marcas = deduplicar(marcas)

        with open(fuzzy_clean_path, "w", encoding="utf-8") as f:
            json.dump(marcas, f, ensure_ascii=False, indent=2)

        resultado["arquivos"]["fuzzy_clean"] = str(fuzzy_clean_path)
        log(f"  Marcas unicas extraidas: {len(marcas)}")

        if not marcas:
            log("Nenhuma marca extraida apos limpeza. Possivel erro de parsing.")
            inpi_raw_path.write_text("", encoding="utf-8")
            resultado["sucesso"] = True
            resultado["arquivos"]["inpi_raw"] = str(inpi_raw_path)
            resultado["etapas"]["resultado"] = "sem_marcas_extraidas"
            return resultado

        # === ETAPA 3: Filtragem de colidencias ===
        log(f"ETAPA 3/4: Filtrando colidencias (tipo: {tipo_marca}, threshold: {threshold})...")
        from filtrar_colidencias import filtrar_marcas

        resultado_filtro = filtrar_marcas(
            marcas=marcas,
            nome_marca_alvo=nome_marca,
            tipo_marca=tipo_marca,
            classes_alvo=classes_alvo,
            threshold=threshold,
        )

        with open(suspeitos_path, "w", encoding="utf-8") as f:
            json.dump(resultado_filtro, f, ensure_ascii=False, indent=2)

        resultado["arquivos"]["suspeitos"] = str(suspeitos_path)
        resultado["etapas"]["filtragem"] = {
            "analisadas": resultado_filtro["total_analisadas"],
            "suspeitas": resultado_filtro["total_suspeitas"],
            "protocolos": len(resultado_filtro["protocolos_para_busca_detalhada"]),
        }

        protocolos = resultado_filtro["protocolos_para_busca_detalhada"]
        log(f"  Suspeitas: {resultado_filtro['total_suspeitas']}")
        log(f"  Protocolos para busca detalhada: {len(protocolos)}")

        # Limitar protocolos para evitar sobrecarga em marcas muito comuns
        # Prioriza os de maior score (ja vem ordenado)
        MAX_PROTOCOLOS = 40
        if len(protocolos) > MAX_PROTOCOLOS:
            log(f"  Limitando a {MAX_PROTOCOLOS} protocolos (de {len(protocolos)}) — priorizando maior score")
            protocolos = protocolos[:MAX_PROTOCOLOS]

        if not protocolos:
            log("Nenhum protocolo suspeito. Campo provavelmente livre.")
            inpi_raw_path.write_text("", encoding="utf-8")
            resultado["sucesso"] = True
            resultado["arquivos"]["inpi_raw"] = str(inpi_raw_path)
            resultado["etapas"]["resultado"] = "sem_suspeitas"
            return resultado

        # === ETAPA 4: Busca detalhada por protocolo ===
        log(f"ETAPA 4/4: Busca detalhada de {len(protocolos)} protocolos...")
        from busca_inpi_protocolo import buscar_protocolos_paralelo

        stats_protocolo = await buscar_protocolos_paralelo(
            protocolos=protocolos,
            output_path=inpi_raw_path,
            max_concorrencia=max_concorrencia,
            headless=headless,
        )

        resultado["etapas"]["busca_protocolo"] = stats_protocolo
        resultado["arquivos"]["inpi_raw"] = str(inpi_raw_path)
        resultado["sucesso"] = True
        resultado["etapas"]["resultado"] = "completo"

        log(f"  Encontrados: {stats_protocolo['encontrados']}/{stats_protocolo['total_protocolos']}")
        log(f"Pipeline concluido! Arquivo: {inpi_raw_path}")

    except ImportError as e:
        resultado["erro"] = f"Dependencia nao encontrada: {e}"
        log(f"ERRO: {resultado['erro']}")
    except Exception as e:
        resultado["erro"] = str(e)
        log(f"ERRO: {e}")
        import traceback
        traceback.print_exc()

    return resultado


def main():
    parser = argparse.ArgumentParser(
        description="Orquestrador da busca automatica INPI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplo completo:
  python orquestrador_busca_inpi.py \\
    --marca "GENESIS" \\
    --pasta "laudos/Joao Silva/GENESIS/" \\
    --tipo-marca arbitrario \\
    --classes 35,42,45 \\
    --max-paginas 10

O pipeline gera estes arquivos na pasta:
  raw-fuzzy.md       Resultados brutos da busca fuzzy
  fuzzy-clean.json   Marcas extraidas e limpas
  suspeitos.json     Marcas filtradas como potenciais colidencias
  inpi-raw.txt       Detalhes completos dos suspeitos (para processar_inpi.py)
        """,
    )

    parser.add_argument("--marca", required=True, help="Nome da marca a pesquisar")
    parser.add_argument("--pasta", required=True, help="Pasta do caso (laudos/cliente/marca/)")
    parser.add_argument(
        "--tipo-marca",
        choices=["fantasioso", "arbitrario", "evocativo", "descritivo"],
        default="evocativo",
        help="Tipo da marca (default: evocativo)",
    )
    parser.add_argument(
        "--classes",
        help="Classes NCL alvo (ex: 35,42)",
    )
    parser.add_argument(
        "--max-paginas", type=int, default=10,
        help="Max paginas na busca fuzzy (default: 10)",
    )
    parser.add_argument(
        "--concorrencia", type=int, default=3,
        help="Buscas paralelas por protocolo (default: 3)",
    )
    parser.add_argument(
        "--threshold", type=int, default=15,
        help="Score minimo para suspeita (default: 15)",
    )
    parser.add_argument(
        "--visible", action="store_true",
        help="Mostrar browser",
    )

    args = parser.parse_args()

    classes = []
    if args.classes:
        classes = [int(c.strip()) for c in args.classes.split(",")]

    resultado = asyncio.run(
        executar_pipeline(
            nome_marca=args.marca,
            pasta=Path(args.pasta),
            tipo_marca=args.tipo_marca,
            classes_alvo=classes,
            max_paginas=args.max_paginas,
            max_concorrencia=args.concorrencia,
            headless=not args.visible,
            threshold=args.threshold,
        )
    )

    # Salvar relatorio do pipeline
    relatorio_path = Path(args.pasta) / "busca-automatica-relatorio.json"
    with open(relatorio_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    if resultado["sucesso"]:
        log(f"\nPipeline OK. Relatorio: {relatorio_path}")
        log(f"Proximo passo: processar_inpi.py {resultado['arquivos'].get('inpi_raw', '')}")
        sys.exit(0)
    else:
        log(f"\nPipeline falhou: {resultado['erro']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
