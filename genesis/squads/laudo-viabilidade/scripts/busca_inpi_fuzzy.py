#!/usr/bin/env python3
"""
Busca Fuzzy no INPI via Playwright.

Acessa busca.inpi.gov.br em modo anonimo, executa pesquisa por radical (fuzzy)
pelo nome da marca, e scrape de ate N paginas de resultados.

Estrutura real do INPI (mapeada em 2026-03-15):
- Login anonimo: /pePI/servlet/LoginController?action=login
- Form de busca: /pePI/jsp/marcas/Pesquisa_classe_basica.jsp
  - input[name="marca"] = nome da marca
  - input[name="buscaExata"][value="nao"] = busca radical (fuzzy)
  - select[name="registerPerPage"] = 100 (max por pagina)
  - Action=searchMarca, tipoPesquisa=BY_MARCA_CLASSIF_BASICA
- Resultados: tabela com Numero|Prioridade|Marca|Situacao|Titular|Classe
- Paginacao: /pePI/servlet/MarcasServletController?Action=nextPageMarca&page=N
- Detalhe: /pePI/servlet/MarcasServletController?Action=detail&CodPedido=XXXXX

Saida: arquivo .md com todos os resultados brutos por pagina.

Uso:
    python busca_inpi_fuzzy.py "NOME DA MARCA" --output resultado.md --max-paginas 10
"""

import asyncio
import argparse
import re
import sys
import time
from pathlib import Path


async def executar_busca_fuzzy(
    nome_marca: str,
    output_path: Path,
    max_paginas: int = 10,
    headless: bool = True,
    delay_entre_paginas: float = 2.0,
) -> dict:
    """
    Executa busca fuzzy no INPI e salva resultados em .md.

    Returns:
        dict com estatisticas da busca
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Erro: playwright nao instalado. Execute: pip install playwright && playwright install chromium")
        sys.exit(1)

    stats = {
        "marca_pesquisada": nome_marca,
        "paginas_coletadas": 0,
        "total_resultados_estimado": 0,
        "total_paginas_disponiveis": 0,
        "sucesso": False,
        "erro": None,
    }

    conteudo_paginas = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
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
            # 1. Login anonimo (com retry para rate limit)
            for tentativa in range(4):
                try:
                    print("Acessando INPI (login anonimo)...")
                    await page.goto(
                        "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                        wait_until="networkidle",
                    )
                    break
                except Exception as e:
                    if tentativa < 3 and "net::" in str(e):
                        wait = 30 * (tentativa + 1)
                        print(f"  Conexao recusada. Aguardando {wait}s (tentativa {tentativa+1}/3)...")
                        await asyncio.sleep(wait)
                    else:
                        raise
            await asyncio.sleep(1)

            # 2. Ir direto para formulario de busca por marca
            print("Abrindo formulario de busca por marca...")
            await page.goto(
                "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp",
                wait_until="networkidle",
            )
            await asyncio.sleep(1)

            # 3. Preencher formulario
            print(f"Configurando busca radical por: {nome_marca}")

            # Selecionar busca NAO exata (radical/fuzzy)
            await page.locator('input[name="buscaExata"][value="nao"]').click()

            # Preencher nome da marca
            await page.locator('input[name="marca"]').fill(nome_marca)

            # Selecionar 100 resultados por pagina (maximo)
            await page.locator('select[name="registerPerPage"]').select_option("100")

            # 4. Submeter busca
            print("Submetendo busca...")
            await page.locator('input[name="botao"]').click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)

            # 5. Verificar resultados
            page_text = await page.evaluate("() => document.body.innerText")

            # Verificar se nao encontrou nada
            if "nenhum" in page_text.lower() and "resultado" in page_text.lower():
                print("Nenhum resultado encontrado.")
                stats["sucesso"] = True
                stats["total_resultados_estimado"] = 0
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(
                    f"# Busca Fuzzy INPI: {nome_marca}\n\nNenhum resultado encontrado.\n",
                    encoding="utf-8",
                )
                await browser.close()
                return stats

            # Extrair total e paginas
            # Formato: "Foram encontrados 938 processos ... Mostrando página 1 de 10."
            total_match = re.search(r"(\d+)\s*processos?\s", page_text)
            if total_match:
                stats["total_resultados_estimado"] = int(total_match.group(1))

            pagina_match = re.search(r"[Pp]ágina\s+\d+\s+de\s+(\d+)", page_text)
            if pagina_match:
                stats["total_paginas_disponiveis"] = int(pagina_match.group(1))

            print(
                f"Encontrados: {stats['total_resultados_estimado']} processos, "
                f"{stats['total_paginas_disponiveis']} paginas"
            )

            # 6. Coletar pagina por pagina
            paginas_a_coletar = min(max_paginas, stats["total_paginas_disponiveis"] or max_paginas)

            for pagina in range(1, paginas_a_coletar + 1):
                print(f"  Coletando pagina {pagina}/{paginas_a_coletar}...")

                # Extrair texto da tabela de resultados
                texto_pagina = await page.evaluate("() => document.body.innerText")

                if texto_pagina.strip():
                    conteudo_paginas.append(
                        f"## Pagina {pagina}\n\n{texto_pagina.strip()}\n"
                    )
                    stats["paginas_coletadas"] += 1

                # Ir para proxima pagina (se nao for a ultima)
                if pagina < paginas_a_coletar:
                    next_page = pagina + 1
                    next_url = (
                        f"https://busca.inpi.gov.br/pePI/servlet/MarcasServletController"
                        f"?Action=nextPageMarca&page={next_page}"
                    )

                    await asyncio.sleep(delay_entre_paginas)
                    try:
                        await page.goto(next_url, wait_until="networkidle")
                        await asyncio.sleep(1)
                    except Exception as e:
                        print(f"  Erro na pagina {next_page}: {e}")
                        break

            # 7. Salvar resultado
            output_path.parent.mkdir(parents=True, exist_ok=True)
            header = (
                f"# Busca Fuzzy INPI: {nome_marca}\n\n"
                f"- Data da busca: {time.strftime('%Y-%m-%d %H:%M')}\n"
                f"- Total estimado: {stats['total_resultados_estimado']} processos\n"
                f"- Paginas disponiveis: {stats['total_paginas_disponiveis']}\n"
                f"- Paginas coletadas: {stats['paginas_coletadas']}\n\n---\n\n"
            )
            conteudo_final = header + "\n\n---\n\n".join(conteudo_paginas)
            output_path.write_text(conteudo_final, encoding="utf-8")

            stats["sucesso"] = True
            print(f"Resultados salvos em: {output_path}")

        except Exception as e:
            stats["erro"] = str(e)
            print(f"Erro durante busca: {e}")
            try:
                await page.screenshot(
                    path=str(output_path.parent / "debug-erro-fuzzy.png")
                )
            except Exception:
                pass
        finally:
            await browser.close()

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Busca Fuzzy de marcas no INPI via Playwright",
    )
    parser.add_argument("marca", help="Nome da marca a pesquisar")
    parser.add_argument(
        "-o", "--output", default="raw-fuzzy.md", help="Arquivo .md de saida"
    )
    parser.add_argument(
        "-p", "--max-paginas", type=int, default=10,
        help="Maximo de paginas (default: 10)",
    )
    parser.add_argument(
        "--visible", action="store_true", help="Mostrar browser (nao headless)"
    )
    parser.add_argument(
        "--delay", type=float, default=2.0,
        help="Delay entre paginas em segundos",
    )

    args = parser.parse_args()

    stats = asyncio.run(
        executar_busca_fuzzy(
            nome_marca=args.marca,
            output_path=Path(args.output),
            max_paginas=args.max_paginas,
            headless=not args.visible,
            delay_entre_paginas=args.delay,
        )
    )

    if stats["sucesso"]:
        print(f"\nBusca concluida: {stats['paginas_coletadas']} paginas coletadas")
        sys.exit(0)
    else:
        print(f"\nBusca falhou: {stats['erro']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
