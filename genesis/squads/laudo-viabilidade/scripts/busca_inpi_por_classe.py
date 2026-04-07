#!/usr/bin/env python3
"""
Busca no INPI por classe NCL via Playwright.

Usa a Pesquisa Avançada com análise por similaridade (fuzzy) para cada classe
aprovada, separadamente, e também executa busca geral (sem classe) para
capturar anterioridades em classes adjacentes.

Busca detalhada dos protocolos usa 4 browsers paralelos para performance
sem rate limit, com relogin entre cada busca.

Estrutura do INPI:
- Login: /pePI/servlet/LoginController?action=login
- Form Avançado: /pePI/jsp/marcas/Pesquisa_classe_avancada.jsp
  - input[name="precisao"][value="sim"] = análise por similaridade (fuzzy)
  - input[name="marca"] = nome
  - input[name="classeInter"] = numero da classe NCL (vazio = todas)
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
    classe: Optional[int] = None,
    delay_pagina: float = 5.0,
) -> List[str]:
    """
    Busca por similaridade (fuzzy) na Pesquisa Avançada do INPI.
    Se classe=None, busca em TODAS as classes.
    Retorna lista de textos de todas as paginas.
    """
    label = f"classe {classe}" if classe else "todas as classes"
    log(f"  Buscando '{nome_marca}' em {label} (Pesquisa Avançada — similaridade)...")

    # Ir pro formulario avançado
    await page.goto(
        "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_avancada.jsp",
        wait_until="networkidle",
    )
    await asyncio.sleep(2)

    # Selecionar análise por similaridade (Fuzzy)
    await page.locator('input[name="precisao"][value="sim"]').click()
    # Preencher marca
    await page.locator('input[name="marca"]').fill(nome_marca)
    # Classe (se especificada)
    if classe:
        await page.locator('input[name="classeInter"]').fill(str(classe))
    # 100 resultados por pagina
    await page.locator('select[name="registerPerPage"]').select_option("100")

    # Submeter: click via JS + aguardar resposta (pode demorar >60s para termos genéricos)
    try:
        await page.evaluate("() => document.querySelector('input[name=\"botao\"]').click()")
    except Exception:
        pass  # "Execution context destroyed" = navegação iniciou, OK

    # Aguardar a página de resultados carregar (retry robusto)
    page_text = ""
    for _wait_attempt in range(12):  # até 120s (12 x 10s)
        await asyncio.sleep(10)
        try:
            page_text = await page.evaluate("() => document.body.innerText")
            if "processos" in page_text.lower() or "nenhum" in page_text.lower() or "resultado" in page_text.lower():
                break
        except Exception:
            continue  # página ainda navegando

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

            # A Pesquisa Avançada inclui coluna % (similaridade) como primeira coluna.
            # Detectar e pular se presente.
            idx_start = 0
            if re.match(r"^\d{1,3}$", partes_limpas[0]) and len(partes_limpas[0]) <= 3:
                # É um percentual de similaridade (1-100), pular
                idx_start = 1

            if idx_start >= len(partes_limpas):
                continue

            # Primeira parte (após %) deve ser numero de processo (6-9 digitos)
            numero = partes_limpas[idx_start]
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

            idx = idx_start + 1

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


async def _worker_detalhes(
    worker_id: int,
    protocolos: List[str],
    resultados: Dict[str, str],
    headless: bool = True,
    delay: float = 6.0,
):
    """
    Worker paralelo: abre browser independente com cookies zerados,
    busca detalhes de protocolos com relogin a cada 2 buscas.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                f"AppleWebKit/537.36 Chrome/{120 + worker_id}.0.0.0"
            ),
        )
        page = await context.new_page()
        page.set_default_timeout(60000)

        # Login inicial
        await page.goto(
            "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
            wait_until="networkidle",
        )
        await asyncio.sleep(3)
        log(f"  [Worker {worker_id}] Login OK — {len(protocolos)} protocolos")

        for i, proto in enumerate(protocolos):
            # Relogin a cada 2 buscas para evitar rate limit
            if i > 0 and i % 2 == 0:
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                    wait_until="networkidle",
                )
                await asyncio.sleep(3)

            texto = await buscar_detalhe_protocolo(page, proto, delay)
            if texto:
                resultados[proto] = texto
            await asyncio.sleep(delay)

        await browser.close()
        log(f"  [Worker {worker_id}] Finalizado")


async def buscar_detalhes_paralelo(
    protocolos: List[str],
    num_workers: int = 4,
    headless: bool = True,
    delay: float = 6.0,
    stagger: float = 5.0,
) -> tuple:
    """
    Busca detalhes usando N browsers paralelos com cookies zerados.
    Cada worker recebe um subconjunto de protocolos e opera de forma independente.

    Returns:
        (resultados_dict, falhas_list)
    """
    if not protocolos:
        return {}, []

    # Distribuir protocolos round-robin entre workers
    chunks = [[] for _ in range(num_workers)]
    for i, proto in enumerate(protocolos):
        chunks[i % num_workers].append(proto)

    # Remover chunks vazios
    chunks = [c for c in chunks if c]
    actual_workers = len(chunks)

    log(f"  Buscando detalhes de {len(protocolos)} protocolos com {actual_workers} browsers paralelos")

    resultados: Dict[str, str] = {}
    tasks = []
    for i, chunk in enumerate(chunks):
        # Stagger: cada worker começa com um atraso
        await asyncio.sleep(stagger)
        tasks.append(
            asyncio.create_task(
                _worker_detalhes(i + 1, chunk, resultados, headless, delay)
            )
        )

    await asyncio.gather(*tasks)

    falhas = [p for p in protocolos if p not in resultados]
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
    delay_protocolo: float = 6.0,
    delay_entre_lotes: float = 15.0,
    delay_entre_classes: float = 10.0,
    tamanho_lote: int = 5,
    num_workers: int = 4,
) -> Dict:
    """
    Pipeline completo:
    1. Pesquisa Avançada por similaridade (fuzzy) por classe + busca geral
    2. Limpeza conservadora (sem filtro)
    3. Busca detalhada com N browsers paralelos (cookies zerados)
    4. Consolidação em inpi-raw.txt
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
        "metodo": "Pesquisa Avançada — análise por similaridade",
        "por_classe": {},
        "busca_geral": {},
        "total_encontradas": 0,
        "total_mantidas": 0,
        "total_detalhadas": 0,
        "sucesso": False,
        "erro": None,
    }

    todas_marcas: List[Dict] = []
    protocolos_vistos = set()

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
        page.set_default_timeout(90000)

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

            # ─── ETAPA 1: Busca por similaridade em cada classe ───
            for i, classe in enumerate(classes):
                log(f"{'='*60}")
                log(f"CLASSE {classe} ({i+1}/{len(classes)})")
                log(f"{'='*60}")

                # Relogin antes de cada classe
                if i > 0:
                    await recuperar_sessao(page, 3)

                paginas = await buscar_fuzzy_classe(page, nome_marca, classe, delay_pagina)

                if not paginas:
                    resultado["por_classe"][classe] = {
                        "encontradas": 0,
                        "mantidas": 0,
                    }
                    log(f"  Classe {classe}: campo livre\n")
                    if i < len(classes) - 1:
                        await asyncio.sleep(delay_entre_classes)
                    continue

                marcas = extrair_marcas_tabela(paginas, classe)
                marcas_filtradas = filtro_conservador(marcas, nome_marca)

                # Salvar backup e JSON por classe
                classe_raw = pasta / f"classe-{classe}-raw.md"
                with open(classe_raw, "w", encoding="utf-8") as f:
                    f.write(f"# Busca INPI (similaridade): {nome_marca} — Classe {classe}\n\n")
                    for pi, pg in enumerate(paginas, 1):
                        f.write(f"## Página {pi}\n\n{pg}\n\n---\n\n")

                classe_json = pasta / f"classe-{classe}-marcas.json"
                with open(classe_json, "w", encoding="utf-8") as f:
                    json.dump(marcas_filtradas, f, ensure_ascii=False, indent=2)

                resultado["total_encontradas"] += len(marcas)
                resultado["total_mantidas"] += len(marcas_filtradas)
                resultado["por_classe"][classe] = {
                    "encontradas": len(marcas),
                    "mantidas": len(marcas_filtradas),
                }

                # Acumular marcas (deduplicar por protocolo)
                for m in marcas_filtradas:
                    if m["numero_processo"] not in protocolos_vistos:
                        protocolos_vistos.add(m["numero_processo"])
                        todas_marcas.append(m)

                log(f"  Classe {classe}: {len(marcas_filtradas)} marcas\n")
                if i < len(classes) - 1:
                    await asyncio.sleep(delay_entre_classes)

            # ─── ETAPA 2: Busca geral (todas as classes) ───
            log(f"{'='*60}")
            log(f"BUSCA GERAL (todas as classes)")
            log(f"{'='*60}")
            await recuperar_sessao(page, 3)

            paginas_geral = await buscar_fuzzy_classe(page, nome_marca, None, delay_pagina)
            if paginas_geral:
                marcas_geral = extrair_marcas_tabela(paginas_geral, 0)
                log(f"  Geral: {len(marcas_geral)} marcas")

                geral_raw = pasta / "geral-raw.md"
                with open(geral_raw, "w", encoding="utf-8") as f:
                    f.write(f"# Busca INPI (similaridade): {nome_marca} — Todas as classes\n\n")
                    for pi, pg in enumerate(paginas_geral, 1):
                        f.write(f"## Página {pi}\n\n{pg}\n\n---\n\n")

                geral_json = pasta / "geral-marcas.json"
                with open(geral_json, "w", encoding="utf-8") as f:
                    json.dump(marcas_geral, f, ensure_ascii=False, indent=2)

                # Acumular marcas novas
                novas = 0
                for m in marcas_geral:
                    if m["numero_processo"] not in protocolos_vistos:
                        protocolos_vistos.add(m["numero_processo"])
                        todas_marcas.append(m)
                        novas += 1

                resultado["busca_geral"] = {
                    "encontradas": len(marcas_geral),
                    "novas_unicas": novas,
                }
                log(f"  {novas} marcas novas não vistas nas buscas por classe\n")
            else:
                resultado["busca_geral"] = {"encontradas": 0, "novas_unicas": 0}
                log(f"  Busca geral: 0 resultados\n")

        except Exception as e:
            resultado["erro"] = str(e)
            log(f"ERRO: {e}")
            try:
                await page.screenshot(path=str(pasta / "debug-erro.png"))
            except Exception:
                pass
        finally:
            await browser.close()

    # ─── ETAPA 3: Busca detalhada com browsers paralelos ───
    log(f"{'='*60}")
    log(f"BUSCA DETALHADA — {len(todas_marcas)} protocolos com {num_workers} browsers")
    log(f"{'='*60}")

    todos_protocolos = [m["numero_processo"] for m in todas_marcas]

    if todos_protocolos:
        resultados_detalhes, falhas_detalhe = await buscar_detalhes_paralelo(
            todos_protocolos,
            num_workers=num_workers,
            headless=headless,
            delay=delay_protocolo,
        )
        resultado["total_detalhadas"] = len(resultados_detalhes)
        resultado["falhas_detalhe"] = falhas_detalhe
    else:
        resultados_detalhes = {}
        falhas_detalhe = []
        resultado["falhas_detalhe"] = []

    # Consolidar em inpi-raw.txt (na ordem original dos protocolos)
    inpi_raw_path = pasta / "inpi-raw.txt"
    detalhes_ordenados = []
    for proto in todos_protocolos:
        if proto in resultados_detalhes:
            detalhes_ordenados.append(resultados_detalhes[proto])

    if detalhes_ordenados:
        inpi_raw_path.write_text("\n\n".join(detalhes_ordenados), encoding="utf-8")
        resultado["sucesso"] = True
        log(f"Arquivo gerado: {inpi_raw_path}")
    else:
        inpi_raw_path.write_text("", encoding="utf-8")
        resultado["sucesso"] = True
        log("Nenhum detalhe coletado — campo possivelmente livre.")

    if falhas_detalhe:
        log(f"⚠ ATENÇÃO: {len(falhas_detalhe)} protocolos não puderam ser detalhados: {falhas_detalhe}")

    # Salvar relatório
    relatorio_path = pasta / "busca-por-classe-relatorio.json"
    with open(relatorio_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    log(f"Relatório: {relatorio_path}")
    return resultado


def main():
    parser = argparse.ArgumentParser(
        description="Busca INPI por similaridade (Pesquisa Avançada) + detalhes com browsers paralelos",
    )
    parser.add_argument("marca", help="Nome da marca")
    parser.add_argument("--classes", required=True, help="Classes NCL (ex: 35,42,41)")
    parser.add_argument("--pasta", required=True, help="Pasta do caso")
    parser.add_argument("--visible", action="store_true", help="Mostrar browser")
    parser.add_argument("--workers", type=int, default=4, help="Browsers paralelos para detalhes (default: 4)")
    parser.add_argument("--delay-pagina", type=float, default=5.0)
    parser.add_argument("--delay-protocolo", type=float, default=6.0)
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
            num_workers=args.workers,
        )
    )

    # Resumo
    log(f"\n{'='*60}")
    log(f"RESUMO FINAL — {args.marca}")
    log(f"{'='*60}")
    for classe, info in resultado["por_classe"].items():
        log(f"  Classe {classe}: {info['encontradas']} encontradas → {info['mantidas']} mantidas")
    log(f"  Total detalhadas: {resultado['total_detalhadas']}")
    log(f"  Status: {'OK' if resultado['sucesso'] else 'FALHA'}")

    sys.exit(0 if resultado["sucesso"] else 1)


if __name__ == "__main__":
    main()
