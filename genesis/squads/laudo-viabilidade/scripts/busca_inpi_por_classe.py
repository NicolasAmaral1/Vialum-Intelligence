#!/usr/bin/env python3
"""
Busca no INPI por classe NCL via Playwright.

Faz uma busca fuzzy (radical) para cada classe aprovada, separadamente.
Percorre TODAS as paginas de resultados, devagar.

Estrutura do INPI:
- Login: /pePI/servlet/LoginController?action=login
- Form: /pePI/jsp/marcas/Pesquisa_classe_basica.jsp
  - input[name="marca"] = nome
  - input[name="classeInter"] = numero da classe NCL
  - input[name="buscaExata"][value="nao"] = radical/fuzzy
  - select[name="registerPerPage"] = 100
- Paginacao: /pePI/servlet/MarcasServletController?Action=nextPageMarca&page=N
- Detalhe: /pePI/servlet/MarcasServletController?Action=detail&CodPedido=XXXXX

Uso:
    python busca_inpi_por_classe.py "AMSTERDAM" --classes 35,42,41 --pasta laudos/cliente/marca/
"""

import asyncio
import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import List, Dict, Optional


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


# ─────────────────────────────────────────────
# ETAPA 1: BUSCA FUZZY POR CLASSE
# ─────────────────────────────────────────────

async def buscar_fuzzy_classe(
    page,
    nome_marca: str,
    classe: int,
    delay_pagina: float = 5.0,
) -> List[str]:
    """
    Busca fuzzy por uma classe especifica.
    Retorna lista de textos de todas as paginas.
    """
    log(f"  Buscando '{nome_marca}' na classe {classe}...")

    # Ir pro formulario
    await page.goto(
        "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp",
        wait_until="networkidle",
    )
    await asyncio.sleep(2)

    # Preencher
    await page.locator('input[name="buscaExata"][value="nao"]').click()
    await page.locator('input[name="marca"]').fill(nome_marca)
    await page.locator('input[name="classeInter"]').fill(str(classe))
    await page.locator('select[name="registerPerPage"]').select_option("100")

    # Submeter
    await page.locator('input[name="botao"]').click()
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(3)

    # Checar resultados
    page_text = await page.evaluate("() => document.body.innerText")

    if "nenhum" in page_text.lower() or "0 processos" in page_text.lower():
        log(f"  Classe {classe}: 0 resultados")
        return []

    # Extrair total e paginas
    total = 0
    total_paginas = 1
    m = re.search(r"(\d+)\s*processos?", page_text)
    if m:
        total = int(m.group(1))
    m = re.search(r"[Pp]ágina\s+\d+\s+de\s+(\d+)", page_text)
    if m:
        total_paginas = int(m.group(1))

    log(f"  Classe {classe}: {total} processos em {total_paginas} página(s)")

    # Coletar todas as paginas
    paginas_texto = [page_text]

    for pag in range(2, total_paginas + 1):
        await asyncio.sleep(delay_pagina)
        url = (
            f"https://busca.inpi.gov.br/pePI/servlet/MarcasServletController"
            f"?Action=nextPageMarca&page={pag}"
        )
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(2)
        texto = await page.evaluate("() => document.body.innerText")
        paginas_texto.append(texto)
        log(f"    Página {pag}/{total_paginas}")

    return paginas_texto


# ─────────────────────────────────────────────
# ETAPA 2: LIMPEZA CONSERVADORA
# ─────────────────────────────────────────────

def extrair_marcas_tabela(textos_paginas: List[str], classe: int) -> List[Dict]:
    """
    Extrai marcas do formato tabular do INPI.
    Politica ultra-conservadora: so descarta linhas que nao sao marcas.
    """
    marcas = []
    vistos = set()

    for texto in textos_paginas:
        for linha in texto.split("\n"):
            stripped = linha.strip()
            if not stripped:
                continue

            partes = re.split(r"\t+", stripped)
            partes_limpas = [p.strip() for p in partes if p.strip()]

            if len(partes_limpas) < 3:
                continue

            # Primeira parte deve ser numero de processo (6-9 digitos)
            numero = partes_limpas[0]
            if not re.match(r"^\d{6,9}$", numero):
                continue

            if numero in vistos:
                continue
            vistos.add(numero)

            # Extrair campos
            marca = {
                "numero_processo": numero,
                "nome_marca": None,
                "situacao": None,
                "titular": None,
                "classe": classe,
                "prioridade": None,
            }

            idx = 1

            # Data prioridade
            if idx < len(partes_limpas) and re.match(r"\d{2}/\d{2}/\d{4}", partes_limpas[idx]):
                marca["prioridade"] = partes_limpas[idx]
                idx += 1

            # Nome da marca
            if idx < len(partes_limpas):
                marca["nome_marca"] = partes_limpas[idx]
                idx += 1

            # Situacao
            if idx < len(partes_limpas):
                candidato = partes_limpas[idx]
                situacoes_kw = [
                    "extint", "arquivad", "vigor", "registro", "pedido",
                    "indeferid", "publicad", "deferido", "nulidade",
                    "aguardando", "sobrestamento",
                ]
                if any(s in candidato.lower() for s in situacoes_kw):
                    marca["situacao"] = candidato
                    idx += 1

            # Titular
            if idx < len(partes_limpas):
                marca["titular"] = partes_limpas[idx]

            if marca["nome_marca"]:
                marcas.append(marca)

    return marcas


def filtro_conservador(marcas: List[Dict], nome_marca: str) -> List[Dict]:
    """
    SEM FILTRO — mantém 100% do que o INPI retornou.

    Justificativa: se o INPI incluiu na busca por radical, ele considerou
    relevante. Qualquer filtro nosso arrisca descartar marcas que o INPI
    deliberadamente incluiu. A triagem de relevancia é feita pela IA depois,
    com contexto completo (especificacoes, afinidade mercadologica, etc.).

    A unica coisa que removemos sao duplicatas (ja tratadas na extracao).
    """
    log(f"  Sem filtro aplicado — mantendo 100% ({len(marcas)} marcas)")
    return marcas


# ─────────────────────────────────────────────
# ETAPA 3: BUSCA DETALHADA POR PROTOCOLO
# ─────────────────────────────────────────────

async def recuperar_sessao(page, delay: float = 5.0):
    """
    Tenta recuperar a sessao do INPI fazendo relogin anonimo.
    Chamado quando detecta timeout ou sessao expirada.
    """
    log(f"    Recuperando sessão INPI (relogin)...")
    try:
        await page.goto(
            "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
            wait_until="networkidle",
            timeout=30000,
        )
        await asyncio.sleep(delay)
        log(f"    Sessão recuperada.")
        return True
    except Exception as e:
        log(f"    Falha ao recuperar sessão: {e}")
        return False


async def buscar_detalhe_protocolo(
    page,
    numero: str,
    delay: float = 5.0,
    max_retries: int = 2,
) -> Optional[str]:
    """
    Busca detalhes de um protocolo individual.
    Usa a MESMA sessao do browser (sem criar contexto novo).
    Retry com backoff em caso de falha de conexao OU timeout.
    Faz relogin automatico se a sessao expirar.
    """
    for tentativa in range(max_retries + 1):
        try:
            if tentativa > 0:
                wait = delay * (2 ** tentativa)
                log(f"    [{numero}] Retry {tentativa}/{max_retries} (aguardando {wait:.0f}s)")
                await asyncio.sleep(wait)
                # Relogin antes do retry (sessao pode ter expirado)
                await recuperar_sessao(page, delay)

            await page.goto(
                "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_num_processo.jsp",
                wait_until="networkidle",
            )
            await asyncio.sleep(1)

            await page.locator('input[name="NumPedido"]').fill(numero)
            await page.locator('input[name="botao"]').click()
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)

            page_text = await page.evaluate("() => document.body.innerText")

            if "nenhum" in page_text.lower():
                log(f"    [{numero}] Não encontrado")
                return None

            # Se caiu em lista, clicar no detalhe
            link = page.locator(f"a:has-text('{numero}')").first
            if await link.count() > 0:
                await link.click()
                await page.wait_for_load_state("networkidle")
                await asyncio.sleep(2)

            # CRÍTICO: Expandir especificações ocultas
            # O INPI esconde o texto completo em divs com id="especificacaoN"
            # (visibility:hidden). Os links truncados mostram "..." no final.
            # Solução: extrair innerHTML dos divs ocultos e substituir no DOM.
            await page.evaluate("""() => {
                const links = document.querySelectorAll('a[onmouseover*="showMe"]');
                for (const a of links) {
                    const onmouse = a.getAttribute('onmouseover') || '';
                    const match = onmouse.match(/showMe\\(['"](.+?)['"]\\)/);
                    if (!match) continue;
                    const div = document.getElementById(match[1]);
                    if (!div) continue;
                    const temp = document.createElement('div');
                    temp.innerHTML = div.innerHTML;
                    let fullText = temp.innerText.trim();
                    fullText = fullText.replace(/^\\s*Especificação\\s*/i, '').trim();
                    if (fullText && fullText.length > 5) {
                        a.innerText = fullText;
                    }
                }
            }""")
            await asyncio.sleep(0.5)

            page_text = await page.evaluate("() => document.body.innerText")

            # Limpar header
            clean = page_text.strip()
            header_end = re.search(
                r"(?:Consulta à Base de Dados do INPI|Início \| Ajuda)",
                clean,
            )
            if header_end:
                clean = clean[header_end.end():].strip()

            if clean and len(clean) > 100:
                log(f"    [{numero}] OK ({len(clean)} chars)")
                await asyncio.sleep(delay)
                return clean
            else:
                log(f"    [{numero}] Conteúdo insuficiente")
                return None

        except Exception as e:
            err = str(e)
            retryable = (
                "net::" in err
                or "Timeout" in err
                or "timeout" in err
                or "ERR_CONNECTION" in err
            )
            if tentativa < max_retries and retryable:
                log(f"    [{numero}] {'Timeout' if 'imeout' in err else 'Erro'} — tentando novamente...")
                continue
            log(f"    [{numero}] Erro: {e}")
            return None

    log(f"    [{numero}] Falhou após {max_retries + 1} tentativas")
    return None


async def buscar_detalhes_em_lotes(
    page,
    marcas: List[Dict],
    delay_entre: float = 5.0,
    delay_entre_lotes: float = 15.0,
    tamanho_lote: int = 5,
) -> tuple:
    """
    Busca detalhes dos protocolos em lotes sequenciais.
    Usa UMA sessao de browser, sem paralelismo.

    Returns:
        (resultados_texto, falhas) — lista de textos OK e lista de protocolos que falharam
    """
    resultados = []
    falhas = []
    protocolos = [m["numero_processo"] for m in marcas]
    total = len(protocolos)

    log(f"  Buscando detalhes de {total} protocolos (lotes de {tamanho_lote}, {delay_entre}s entre cada, {delay_entre_lotes}s entre lotes)")

    for i in range(0, total, tamanho_lote):
        lote = protocolos[i:i+tamanho_lote]
        lote_num = (i // tamanho_lote) + 1
        total_lotes = (total + tamanho_lote - 1) // tamanho_lote

        log(f"  Lote {lote_num}/{total_lotes}: {len(lote)} protocolos")

        for numero in lote:
            texto = await buscar_detalhe_protocolo(page, numero, delay_entre)
            if texto:
                resultados.append(texto)
            else:
                falhas.append(numero)

        # Pausa entre lotes (exceto no ultimo)
        if i + tamanho_lote < total:
            log(f"  Pausa de {delay_entre_lotes}s entre lotes...")
            await asyncio.sleep(delay_entre_lotes)

    if falhas:
        log(f"  ⚠ {len(falhas)} protocolos falharam: {falhas}")

    return resultados, falhas


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

async def executar_pipeline(
    nome_marca: str,
    classes: List[int],
    pasta: Path,
    headless: bool = True,
    delay_pagina: float = 5.0,
    delay_protocolo: float = 5.0,
    delay_entre_lotes: float = 15.0,
    delay_entre_classes: float = 10.0,
    tamanho_lote: int = 5,
) -> Dict:
    """
    Pipeline completo: busca fuzzy por classe → limpeza → detalhe → dossiê.
    UMA sessão de browser, UMA aba, tudo sequencial.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log("ERRO: playwright não instalado. pip install playwright && playwright install chromium")
        sys.exit(1)

    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)

    resultado = {
        "marca": nome_marca,
        "classes": classes,
        "por_classe": {},
        "total_encontradas": 0,
        "total_mantidas": 0,
        "total_detalhadas": 0,
        "sucesso": False,
        "erro": None,
    }

    todos_detalhes = []
    falhas_detalhe = []  # Protocolos que falharam na busca detalhada

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
            # Login anonimo (uma vez)
            log("Acessando INPI (login anônimo)...")
            for tentativa in range(4):
                try:
                    await page.goto(
                        "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                        wait_until="networkidle",
                    )
                    break
                except Exception as e:
                    if tentativa < 3 and "net::" in str(e):
                        wait = 30 * (tentativa + 1)
                        log(f"  Conexão recusada. Aguardando {wait}s...")
                        await asyncio.sleep(wait)
                    else:
                        raise

            await asyncio.sleep(2)
            log("Login OK.\n")

            # Para cada classe
            for i, classe in enumerate(classes):
                log(f"{'='*60}")
                log(f"CLASSE {classe} ({i+1}/{len(classes)})")
                log(f"{'='*60}")

                # Relogin antes de cada classe (sessao pode ter expirado)
                if i > 0:
                    await recuperar_sessao(page, 3)

                # 1. Busca fuzzy
                paginas = await buscar_fuzzy_classe(page, nome_marca, classe, delay_pagina)

                if not paginas:
                    resultado["por_classe"][classe] = {
                        "encontradas": 0,
                        "mantidas": 0,
                        "detalhadas": 0,
                    }
                    log(f"  Classe {classe}: campo livre\n")
                    if i < len(classes) - 1:
                        await asyncio.sleep(delay_entre_classes)
                    continue

                # 2. Limpeza conservadora
                marcas = extrair_marcas_tabela(paginas, classe)
                log(f"  Extraídas: {len(marcas)} marcas")

                marcas_filtradas = filtro_conservador(marcas, nome_marca)
                log(f"  Após filtro: {len(marcas_filtradas)} marcas")

                # Salvar texto bruto como backup (se o parser falhar, dado nao se perde)
                classe_raw = pasta / f"classe-{classe}-raw.md"
                with open(classe_raw, "w", encoding="utf-8") as f:
                    f.write(f"# Busca INPI: {nome_marca} — Classe {classe}\n\n")
                    for pi, pg in enumerate(paginas, 1):
                        f.write(f"## Página {pi}\n\n{pg}\n\n---\n\n")

                # Salvar JSON intermediário por classe
                classe_json = pasta / f"classe-{classe}-marcas.json"
                with open(classe_json, "w", encoding="utf-8") as f:
                    json.dump(marcas_filtradas, f, ensure_ascii=False, indent=2)

                resultado["total_encontradas"] += len(marcas)
                resultado["total_mantidas"] += len(marcas_filtradas)

                # 3. Busca detalhada
                detalhes_classe = []
                falhas_classe = []
                if marcas_filtradas:
                    log(f"  Buscando detalhes...")
                    detalhes_classe, falhas_classe = await buscar_detalhes_em_lotes(
                        page, marcas_filtradas,
                        delay_protocolo, delay_entre_lotes, tamanho_lote,
                    )
                    todos_detalhes.extend(detalhes_classe)
                    falhas_detalhe.extend(falhas_classe)
                    resultado["total_detalhadas"] += len(detalhes_classe)

                resultado["por_classe"][classe] = {
                    "encontradas": len(marcas),
                    "mantidas": len(marcas_filtradas),
                    "detalhadas": len(detalhes_classe),
                    "falhas": falhas_classe,
                }

                log(f"  Classe {classe} concluída: {len(marcas_filtradas)} marcas, {len(detalhes_classe)} detalhadas" + (f", {len(falhas_classe)} falhas" if falhas_classe else "") + "\n")

                # Pausa entre classes
                if i < len(classes) - 1:
                    log(f"  Pausa de {delay_entre_classes}s antes da próxima classe...")
                    await asyncio.sleep(delay_entre_classes)

        except Exception as e:
            resultado["erro"] = str(e)
            log(f"ERRO: {e}")
            try:
                await page.screenshot(path=str(pasta / "debug-erro.png"))
            except Exception:
                pass

        finally:
            await browser.close()

    # Registrar falhas no resultado
    resultado["falhas_detalhe"] = falhas_detalhe

    # Consolidar em inpi-raw.txt
    inpi_raw_path = pasta / "inpi-raw.txt"
    if todos_detalhes:
        inpi_raw_path.write_text("\n\n".join(todos_detalhes), encoding="utf-8")
        resultado["sucesso"] = True
        log(f"Arquivo gerado: {inpi_raw_path}")
    else:
        inpi_raw_path.write_text("", encoding="utf-8")
        resultado["sucesso"] = True
        log("Nenhum detalhe coletado — campo possivelmente livre.")

    if falhas_detalhe:
        log(f"⚠ ATENÇÃO: {len(falhas_detalhe)} protocolos não puderam ser detalhados: {falhas_detalhe}")
        log(f"  Esses protocolos estão nos arquivos classe-XX-marcas.json mas NÃO no inpi-raw.txt")
        log(f"  Considere buscar manualmente ou rodar novamente.")

    # Salvar relatório
    relatorio_path = pasta / "busca-por-classe-relatorio.json"
    with open(relatorio_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    log(f"Relatório: {relatorio_path}")

    return resultado


def main():
    parser = argparse.ArgumentParser(
        description="Busca INPI por classe NCL (fuzzy + detalhe, sequencial e devagar)",
    )
    parser.add_argument("marca", help="Nome da marca")
    parser.add_argument("--classes", required=True, help="Classes NCL (ex: 35,42,41)")
    parser.add_argument("--pasta", required=True, help="Pasta do caso")
    parser.add_argument("--visible", action="store_true", help="Mostrar browser")
    parser.add_argument("--delay-pagina", type=float, default=5.0)
    parser.add_argument("--delay-protocolo", type=float, default=5.0)
    parser.add_argument("--delay-lote", type=float, default=15.0)
    parser.add_argument("--delay-classe", type=float, default=10.0)
    parser.add_argument("--lote", type=int, default=5)

    args = parser.parse_args()
    classes = [int(c.strip()) for c in args.classes.split(",")]

    resultado = asyncio.run(
        executar_pipeline(
            nome_marca=args.marca,
            classes=classes,
            pasta=Path(args.pasta),
            headless=not args.visible,
            delay_pagina=args.delay_pagina,
            delay_protocolo=args.delay_protocolo,
            delay_entre_lotes=args.delay_lote,
            delay_entre_classes=args.delay_classe,
            tamanho_lote=args.lote,
        )
    )

    # Resumo
    log(f"\n{'='*60}")
    log(f"RESUMO FINAL — {args.marca}")
    log(f"{'='*60}")
    for classe, info in resultado["por_classe"].items():
        log(f"  Classe {classe}: {info['encontradas']} encontradas → {info['mantidas']} mantidas → {info['detalhadas']} detalhadas")
    log(f"  Total detalhadas: {resultado['total_detalhadas']}")
    log(f"  Status: {'OK' if resultado['sucesso'] else 'FALHA'}")

    sys.exit(0 if resultado["sucesso"] else 1)


if __name__ == "__main__":
    main()
