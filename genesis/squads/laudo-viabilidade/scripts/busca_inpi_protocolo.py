#!/usr/bin/env python3
"""
Busca detalhada por numero de protocolo no INPI via Playwright.

Recebe uma lista de numeros de protocolo e busca cada um em paralelo
usando contextos de browser isolados (sem cookies compartilhados).

Estrutura real do INPI (mapeada em 2026-03-15):
- Login anonimo: /pePI/servlet/LoginController?action=login
- Form de busca por processo: /pePI/jsp/marcas/Pesquisa_num_processo.jsp
  - input[name="NumPedido"] = numero do processo
  - Action hidden, tipoPesquisa hidden
- Detalhe: /pePI/servlet/MarcasServletController?Action=detail&CodPedido=XXXXX

Saida: arquivo inpi-raw.txt com todos os resultados detalhados,
no formato esperado pelo processar_inpi.py existente.

Uso:
    python busca_inpi_protocolo.py --protocolos 123456789,987654321 --output inpi-raw.txt
    python busca_inpi_protocolo.py --input suspeitos.json --output inpi-raw.txt
"""

import asyncio
import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Optional


async def buscar_protocolo_individual(
    browser,
    numero_protocolo: str,
    semaforo: asyncio.Semaphore,
    delay_base: float = 3.0,
    max_retries: int = 2,
) -> Optional[str]:
    """
    Busca um protocolo individual no INPI usando contexto isolado.
    Inclui retry com backoff exponencial para lidar com rate limit.

    Returns:
        Texto bruto do resultado ou None se falhou
    """
    for tentativa in range(max_retries + 1):
        async with semaforo:
            if tentativa > 0:
                wait = delay_base * (2 ** tentativa)
                print(f"  [{numero_protocolo}] Retry {tentativa}/{max_retries} (aguardando {wait:.0f}s)")
                await asyncio.sleep(wait)

            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()
            page.set_default_timeout(45000)

            try:
                # 1. Login anonimo
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                    wait_until="networkidle",
                )
                await asyncio.sleep(delay_base)

                # 2. Ir para busca por numero de processo
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_num_processo.jsp",
                    wait_until="networkidle",
                )
                await asyncio.sleep(1)

                # 3. Preencher numero do processo
                await page.locator('input[name="NumPedido"]').fill(numero_protocolo)

                # 4. Submeter
                await page.locator('input[name="botao"]').click()
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(delay_base)

                # 5. Verificar resultado
                page_text = await page.evaluate("() => document.body.innerText")

                if "nenhum" in page_text.lower() and (
                    "resultado" in page_text.lower() or "registro" in page_text.lower()
                ):
                    print(f"  [{numero_protocolo}] Nenhum resultado")
                    return None

                # 6. Se caiu em lista, clicar no link do detalhe
                link = page.locator(f"a:has-text('{numero_protocolo}')").first
                if await link.count() > 0:
                    await link.click()
                    await page.wait_for_load_state("networkidle")
                    await asyncio.sleep(delay_base)
                    page_text = await page.evaluate("() => document.body.innerText")

                # 7. Limpar header do site
                clean_text = page_text.strip()
                header_end = re.search(
                    r"(?:Consulta à Base de Dados do INPI|Início \| Ajuda)",
                    clean_text,
                )
                if header_end:
                    clean_text = clean_text[header_end.end():].strip()

                # 8. Verificar conteudo
                if clean_text and len(clean_text) > 100:
                    print(f"  [{numero_protocolo}] OK ({len(clean_text)} chars)")
                    return clean_text
                else:
                    print(f"  [{numero_protocolo}] Conteudo insuficiente")
                    return None

            except Exception as e:
                err_str = str(e)

                # Se foi connection refused/timeout, tentar retry
                if tentativa < max_retries and (
                    "ERR_CONNECTION_REFUSED" in err_str
                    or "ERR_CONNECTION_TIMED_OUT" in err_str
                    or "ERR_CONNECTION_RESET" in err_str
                    or "net::" in err_str
                ):
                    print(f"  [{numero_protocolo}] Conexão recusada, tentando novamente...")
                    continue

                print(f"  [{numero_protocolo}] Erro: {e}")
                return None

            finally:
                try:
                    await context.close()
                except Exception:
                    pass

    # Esgotou retries
    print(f"  [{numero_protocolo}] Falhou após {max_retries + 1} tentativas")
    return None


async def buscar_protocolos_paralelo(
    protocolos: List[str],
    output_path: Path,
    max_concorrencia: int = 2,
    headless: bool = True,
    delay_base: float = 3.0,
    max_retries: int = 2,
) -> dict:
    """
    Busca multiplos protocolos em paralelo com contextos isolados.

    Returns:
        Dict com estatisticas
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Erro: playwright nao instalado.")
        sys.exit(1)

    stats = {
        "total_protocolos": len(protocolos),
        "encontrados": 0,
        "falhas": 0,
        "sucesso": False,
    }

    resultados_texto = []
    semaforo = asyncio.Semaphore(max_concorrencia)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)

        print(f"Buscando {len(protocolos)} protocolos (max {max_concorrencia} simultaneos)...")

        tasks = [
            buscar_protocolo_individual(
                browser, prot, semaforo, delay_base, max_retries
            )
            for prot in protocolos
        ]

        resultados = await asyncio.gather(*tasks)

        for prot, texto in zip(protocolos, resultados):
            if texto:
                resultados_texto.append(texto)
                stats["encontrados"] += 1
            else:
                stats["falhas"] += 1

        await browser.close()

    # Consolidar em inpi-raw.txt
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if resultados_texto:
        conteudo_final = "\n\n".join(resultados_texto)
        output_path.write_text(conteudo_final, encoding="utf-8")
        stats["sucesso"] = True
        print(f"\nResultados salvos em: {output_path}")
    else:
        print("\nNenhum resultado encontrado.")
        output_path.write_text("", encoding="utf-8")
        stats["sucesso"] = True

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Busca detalhada por protocolo no INPI via Playwright (paralelo)",
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--protocolos",
        help="Numeros de protocolo separados por virgula",
    )
    group.add_argument(
        "--input",
        dest="input_file",
        help="JSON de suspeitos (campo 'protocolos_para_busca_detalhada')",
    )

    parser.add_argument(
        "-o", "--output", default="inpi-raw.txt",
        help="Arquivo de saida (default: inpi-raw.txt)",
    )
    parser.add_argument(
        "-c", "--concorrencia", type=int, default=2,
        help="Maximo de buscas simultaneas (default: 2)",
    )
    parser.add_argument("--visible", action="store_true", help="Mostrar browser")
    parser.add_argument(
        "--delay", type=float, default=3.0,
        help="Delay base entre acoes (default: 3.0s)",
    )
    parser.add_argument(
        "--retries", type=int, default=2,
        help="Tentativas por protocolo em caso de erro (default: 2)",
    )

    args = parser.parse_args()

    if args.protocolos:
        protocolos = [p.strip() for p in args.protocolos.split(",") if p.strip()]
    else:
        input_path = Path(args.input_file)
        if not input_path.exists():
            print(f"Erro: arquivo nao encontrado: {input_path}")
            sys.exit(1)
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        protocolos = data.get("protocolos_para_busca_detalhada", [])

    if not protocolos:
        print("Nenhum protocolo para buscar.")
        sys.exit(0)

    protocolos = [str(p) for p in protocolos if p]

    print(f"Protocolos a buscar: {len(protocolos)}")
    for p in protocolos[:10]:
        print(f"  - {p}")
    if len(protocolos) > 10:
        print(f"  ... e mais {len(protocolos) - 10}")

    stats = asyncio.run(
        buscar_protocolos_paralelo(
            protocolos=protocolos,
            output_path=Path(args.output),
            max_concorrencia=args.concorrencia,
            headless=not args.visible,
            delay_base=args.delay,
            max_retries=args.retries,
        )
    )

    print(f"\nResumo:")
    print(f"  Total: {stats['total_protocolos']}")
    print(f"  Encontrados: {stats['encontrados']}")
    print(f"  Falhas: {stats['falhas']}")

    sys.exit(0 if stats["sucesso"] else 1)


if __name__ == "__main__":
    main()
