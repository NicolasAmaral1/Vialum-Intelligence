#!/usr/bin/env python3
"""Coleta fichas detalhadas de protocolos específicos no INPI."""

import asyncio
import sys
import time
sys.path.insert(0, '/Users/nicolasamaral/vialum-intelligence/genesis/squads/laudo-viabilidade/scripts')
from busca_inpi_por_classe import buscar_detalhes_paralelo

PROTOCOLOS = [
    # Classe 17 vivas
    "821472119", "002083604",
    # Classe 35 - TRIUM family
    "926453165", "940344742", "941302075", "926470027",
    # TRIMU, TRIOM, TRIUP, TRIUS, BRIUM
    "934300925", "816326118", "816326096", "934502510", "914745484", "923927824",
    # ORIUM family
    "827126808", "933811721", "939690837", "938358049",
    # IRIUM family
    "827605200", "926057995",
    # ARIUM family
    "941576574", "941576949",
    # TRAUM
    "938918893", "920281974",
    # TRIUMPH na 35 (key ones)
    "817336397", "003082318", "501749139", "934189706",
    # TRIUMF, TRIUMAQ, TRIUMON
    "922659699", "927874350", "906657458", "938140043",
    # TRIDIUM
    "930264355", "939079950",
    # NATRIUM
    "819173355", "920786073", "920785972",
    # ATRIUM (key ones - different segments)
    "906629330", "819629413", "821855018", "922879001",
    # Orium X Imports (importação!)
    "939690837",
]

# Dedup
PROTOCOLOS = list(dict.fromkeys(PROTOCOLOS))

async def main():
    print(f"Coletando fichas de {len(PROTOCOLOS)} protocolos...")
    resultados, falhas = await buscar_detalhes_paralelo(
        PROTOCOLOS, num_workers=2, headless=True, delay=6.0, stagger=5.0
    )

    # Salvar em inpi-raw.txt
    pasta = '/Users/nicolasamaral/vialum-intelligence/laudos/Rodrigo e Gustavo/TRIUM'
    with open(f'{pasta}/inpi-raw.txt', 'w') as f:
        for proto, texto in resultados.items():
            f.write(f"{'='*80}\n")
            f.write(f"PROCESSO: {proto}\n")
            f.write(f"{'='*80}\n")
            f.write(texto + "\n\n")

    print(f"\nColetados: {len(resultados)} | Falhas: {len(falhas)}")
    if falhas:
        print(f"Falharam: {falhas}")

asyncio.run(main())
