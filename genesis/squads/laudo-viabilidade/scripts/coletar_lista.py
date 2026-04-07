#!/usr/bin/env python3
"""
coletar_lista.py — Fase 1 do Pipeline v3

Busca por similaridade (fuzzy) no INPI, classe por classe, com browsers paralelos.
Coleta APENAS a listagem (número + nome + situação + titular + % similaridade).
NÃO abre fichas individuais. NÃO busca especificações. NÃO faz julgamento.

Após a coleta, separa mecanicamente em 3 buckets por situação processual:
  - Bucket A (vivas): em vigor, pedido, deferido, publicado, etc.
  - Bucket B (indeferidas): indeferido, recurso contra indeferimento, nulidade
  - Bucket C (mortas): extinta, arquivada, anulada

Grava:
  - coleta/classe-{N}-lista.json (por classe)
  - coleta/geral-lista.json (busca sem classe)
  - coleta/coleta-consolidada.json (deduplicada + metadados)
  - coleta/bucket-a-vivas.json
  - coleta/bucket-b-indeferidas.json
  - coleta/bucket-c-mortas.json
  - fonte-bruta.json (master indexado por nº processo)

Uso:
    python coletar_lista.py "Plenya" \\
        --classes 44,41,42,35 \\
        --pasta "laudos/Equipe Plenya/Plenya" \\
        --workers 4

Critério de parada por classe:
    - Menor % de similaridade na página < 20% → para de paginar
    - Atingiu 10 páginas (1000 resultados) → para (cap de segurança)
    - Sem resultados → campo livre

Paralelismo:
    - N browsers simultâneos (1 por classe), sessões independentes
    - Busca geral (sem classe) roda depois, sequencial
"""

import asyncio
import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Tuple


# ─────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────

SIMILARIDADE_MIN = 20          # % mínimo para continuar paginando
MAX_PAGINAS_POR_CLASSE = 10    # cap de segurança
RESULTADOS_POR_PAGINA = 100    # configuração do formulário INPI
TIMEOUT_BUSCA_S = 120          # tempo máximo esperando resultado de busca
DELAY_ENTRE_PAGINAS = 5.0      # segundos entre páginas
DELAY_POS_LOGIN = 3.0          # segundos após login
DELAY_POS_SUBMIT = 10.0        # intervalo de polling após submeter busca

# Mapeamento de situação → bucket
SITUACAO_BUCKET_A = [
    "vigor", "registro", "pedido", "deferido", "deferida",
    "publicad", "sobrest", "aguardando exame", "aguardando recurso",
    "aguardando prazo", "aguardando manifestação", "em exame",
    "oposição", "exame de mérito",
]
SITUACAO_BUCKET_B = [
    "indeferid", "recurso contra", "nulidade",
]
SITUACAO_BUCKET_C = [
    "extint", "extinção", "arquivad", "anulad", "inexistente",
]

# Keywords para detectar se um campo é situação (em vez de nome de titular)
SITUACAO_DETECT_KEYWORDS = (
    SITUACAO_BUCKET_A + SITUACAO_BUCKET_B + SITUACAO_BUCKET_C
    + ["aguardando", "exame", "mérito", "oposição", "manifestação",
       "prazo", "considerado", "recurso", "publicação", "deferimento",
       "concessão", "marca em", "pedido de"]
)


def log(msg: str):
    """Log com timestamp."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def agora_iso() -> str:
    """Retorna timestamp ISO 8601 UTC."""
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
# CLASSIFICAÇÃO DE BUCKET
# ─────────────────────────────────────────────

def classificar_bucket(situacao: Optional[str]) -> str:
    """
    Classifica uma marca em bucket A, B ou C com base na situação processual.

    Usa string matching simples — sem IA, sem ambiguidade.
    Se a situação não bate com nenhum padrão, classifica como A (conservador).

    Returns:
        "A" (viva), "B" (indeferida), ou "C" (morta)
    """
    if not situacao:
        return "A"  # conservador: na dúvida, é viva

    sit_lower = situacao.lower()

    # Checar B primeiro (indeferidas) — "indeferido" poderia ter substring
    # que bate com outros padrões
    for keyword in SITUACAO_BUCKET_B:
        if keyword in sit_lower:
            return "B"

    for keyword in SITUACAO_BUCKET_C:
        if keyword in sit_lower:
            return "C"

    for keyword in SITUACAO_BUCKET_A:
        if keyword in sit_lower:
            return "A"

    # Fallback conservador: se não reconhece, trata como viva
    return "A"


# ─────────────────────────────────────────────
# EXTRAÇÃO DE MARCAS DA TABELA DE RESULTADOS
# ─────────────────────────────────────────────

def extrair_marcas_pagina(texto: str, classe: Optional[int], fonte: str) -> Tuple[List[Dict], int]:
    """
    Extrai marcas do texto da página de resultados do INPI (Pesquisa Avançada).

    A tabela do INPI na Pesquisa Avançada com similaridade tem colunas:
        % | Nº Processo | Data | Marca | Situação | Titular

    O % de similaridade é a primeira coluna (1-3 dígitos).

    Args:
        texto: innerText da página de resultados
        classe: número da classe NCL (None = busca geral)
        fonte: identificador da fonte (ex: "classe-44-pagina-1")

    Returns:
        Tupla (lista_de_marcas, menor_percentual_encontrado)
    """
    marcas = []
    menor_pct = 100
    vistos = set()

    for linha in texto.split("\n"):
        stripped = linha.strip()
        if not stripped:
            continue

        partes = re.split(r"\t+", stripped)
        partes_limpas = [p.strip() for p in partes if p.strip()]

        if len(partes_limpas) < 3:
            continue

        # Detectar % de similaridade (primeira coluna, 1-3 dígitos)
        idx_start = 0
        similaridade_pct = None

        if re.match(r"^\d{1,3}$", partes_limpas[0]) and len(partes_limpas[0]) <= 3:
            pct_val = int(partes_limpas[0])
            if 0 <= pct_val <= 100:
                similaridade_pct = pct_val
                idx_start = 1
                if pct_val < menor_pct:
                    menor_pct = pct_val

        if idx_start >= len(partes_limpas):
            continue

        # Número de processo (6-9 dígitos)
        numero = partes_limpas[idx_start]
        if not re.match(r"^\d{6,9}$", numero):
            continue

        if numero in vistos:
            continue
        vistos.add(numero)

        marca = {
            "numero_processo": numero,
            "nome_marca": None,
            "situacao": None,
            "titular": None,
            "classe": classe,
            "similaridade_pct": similaridade_pct,
            "fonte": fonte,
        }

        idx = idx_start + 1

        # Data de prioridade (dd/mm/yyyy) — pular
        if idx < len(partes_limpas) and re.match(r"\d{2}/\d{2}/\d{4}", partes_limpas[idx]):
            idx += 1

        # Campos restantes: Nome | Situação | Titular | Classe
        # O INPI nem sempre tem todas as colunas, e às vezes a ordem varia.
        # Estratégia: coletar campos restantes e classificar cada um.
        campos_restantes = partes_limpas[idx:]

        # Classificar cada campo restante
        nome_candidatos = []
        situacao_candidatos = []
        titular_candidatos = []
        classe_detectada = None

        for campo in campos_restantes:
            campo_lower = campo.lower()

            # É classe NCL? Formatos:
            #   "NCL(12) 05"  → classe 5
            #   "NCL(7) 42"   → classe 42
            #   "31 : 20"     → classe 31 (formato antigo subclasse)
            #   "09 : 50"     → classe 9 (formato antigo)
            ncl_match = re.match(r"NCL\(\d+\)\s*(\d{1,2})", campo)
            if ncl_match:
                classe_detectada = int(ncl_match.group(1))
                continue
            antigo_match = re.match(r"^(\d{1,2})\s*:\s*\d{1,2}$", campo.strip())
            if antigo_match:
                classe_detectada = int(antigo_match.group(1))
                continue

            # Pode ter "NCL(11) 45 - Deferida" ou similar
            ncl_extra = re.match(r"NCL\(\d+\)\s*(\d{1,2})\s*-", campo)
            if ncl_extra:
                classe_detectada = int(ncl_extra.group(1))
                continue

            # É situação? (contém keywords de status processual)
            eh_situacao = any(kw in campo_lower for kw in SITUACAO_DETECT_KEYWORDS)

            if eh_situacao:
                situacao_candidatos.append(campo)
            elif not nome_candidatos:
                # Primeiro campo não-situação/não-classe = nome da marca
                nome_candidatos.append(campo)
            else:
                # Campos subsequentes não-situação = titular
                titular_candidatos.append(campo)

        # Atribuir
        if nome_candidatos:
            marca["nome_marca"] = nome_candidatos[0]
        if situacao_candidatos:
            marca["situacao"] = situacao_candidatos[0]
        if titular_candidatos:
            marca["titular"] = titular_candidatos[0]
        elif len(nome_candidatos) > 1:
            # Se não achou titular separado mas tem 2+ campos não-situação,
            # o segundo é o titular
            marca["titular"] = nome_candidatos[1]

        # Classe: prioridade para a detectada no campo, fallback para o parâmetro
        if classe_detectada is not None:
            marca["classe"] = classe_detectada
        # Se classe veio do parâmetro (busca por classe) e não detectou no campo, mantém

        if marca["nome_marca"]:
            marcas.append(marca)

    return marcas, menor_pct


# ─────────────────────────────────────────────
# BUSCA FUZZY POR CLASSE (1 browser)
# ─────────────────────────────────────────────

async def buscar_classe(
    nome_marca: str,
    classe: Optional[int],
    headless: bool = True,
    worker_id: int = 1,
) -> List[Dict]:
    """
    Abre um browser independente e executa busca por similaridade
    para uma classe específica (ou geral se classe=None).

    Navega página por página até:
    - Menor % da página < SIMILARIDADE_MIN (20%)
    - Atingir MAX_PAGINAS_POR_CLASSE (10)
    - Não ter mais páginas

    Returns:
        Lista de marcas extraídas (dicts)
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log("ERRO: playwright não instalado. pip install playwright && playwright install chromium")
        return []

    label = f"classe {classe}" if classe else "geral (todas)"
    marcas_acumuladas: List[Dict] = []

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
        page.set_default_timeout(90000)

        try:
            # Login anônimo
            log(f"  [W{worker_id}] Login para {label}...")
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
                        log(f"  [W{worker_id}] Conexão recusada. Aguardando {wait}s...")
                        await asyncio.sleep(wait)
                    else:
                        raise

            await asyncio.sleep(DELAY_POS_LOGIN)
            log(f"  [W{worker_id}] Login OK — buscando {label}")

            # Ir pro formulário avançado
            await page.goto(
                "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_avancada.jsp",
                wait_until="networkidle",
            )
            await asyncio.sleep(2)

            # Preencher formulário
            await page.locator('input[name="precisao"][value="sim"]').click()
            await page.locator('input[name="marca"]').fill(nome_marca)
            if classe:
                await page.locator('input[name="classeInter"]').fill(str(classe))
            await page.locator('select[name="registerPerPage"]').select_option("100")

            # Submeter
            try:
                await page.evaluate("() => document.querySelector('input[name=\"botao\"]').click()")
            except Exception:
                pass  # navegação iniciou

            # Aguardar resultado (polling)
            page_text = ""
            for _ in range(int(TIMEOUT_BUSCA_S / DELAY_POS_SUBMIT)):
                await asyncio.sleep(DELAY_POS_SUBMIT)
                try:
                    page_text = await page.evaluate("() => document.body.innerText")
                    if any(kw in page_text.lower() for kw in ["processos", "nenhum", "resultado"]):
                        break
                except Exception:
                    continue

            # Sem resultados?
            if "nenhum" in page_text.lower() or "0 processos" in page_text.lower():
                log(f"  [W{worker_id}] {label}: 0 resultados — campo livre")
                await browser.close()
                return []

            # Extrair total e páginas
            total = 0
            total_paginas = 1
            m = re.search(r"(\d+)\s*processos?", page_text)
            if m:
                total = int(m.group(1))
            m = re.search(r"[Pp]ágina\s+\d+\s+de\s+(\d+)", page_text)
            if m:
                total_paginas = int(m.group(1))

            log(f"  [W{worker_id}] {label}: {total} processos em {total_paginas} página(s)")

            # Processar página 1
            fonte = f"classe-{classe}-pagina-1" if classe else "geral-pagina-1"
            marcas_pag, menor_pct = extrair_marcas_pagina(page_text, classe, fonte)
            marcas_acumuladas.extend(marcas_pag)
            log(f"  [W{worker_id}]   Página 1: {len(marcas_pag)} marcas (menor %: {menor_pct})")

            # Checar critério de parada
            if menor_pct < SIMILARIDADE_MIN:
                log(f"  [W{worker_id}]   Parou: menor % ({menor_pct}) < {SIMILARIDADE_MIN}%")
            else:
                # Navegar páginas seguintes
                for pag in range(2, min(total_paginas + 1, MAX_PAGINAS_POR_CLASSE + 1)):
                    await asyncio.sleep(DELAY_ENTRE_PAGINAS)
                    url = (
                        f"https://busca.inpi.gov.br/pePI/servlet/MarcasServletController"
                        f"?Action=nextPageMarca&page={pag}"
                    )
                    await page.goto(url, wait_until="networkidle")
                    await asyncio.sleep(2)

                    texto_pag = await page.evaluate("() => document.body.innerText")
                    fonte_pag = f"classe-{classe}-pagina-{pag}" if classe else f"geral-pagina-{pag}"
                    marcas_pag, menor_pct = extrair_marcas_pagina(texto_pag, classe, fonte_pag)
                    marcas_acumuladas.extend(marcas_pag)
                    log(f"  [W{worker_id}]   Página {pag}/{total_paginas}: {len(marcas_pag)} marcas (menor %: {menor_pct})")

                    # Critério de parada
                    if menor_pct < SIMILARIDADE_MIN:
                        log(f"  [W{worker_id}]   Parou na página {pag}: menor % ({menor_pct}) < {SIMILARIDADE_MIN}%")
                        break

                    if pag >= MAX_PAGINAS_POR_CLASSE:
                        log(f"  [W{worker_id}]   Parou: atingiu cap de {MAX_PAGINAS_POR_CLASSE} páginas")
                        break

        except Exception as e:
            log(f"  [W{worker_id}] ERRO em {label}: {e}")

        finally:
            await browser.close()

    log(f"  [W{worker_id}] {label}: {len(marcas_acumuladas)} marcas coletadas")
    return marcas_acumuladas


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

async def executar_coleta(
    nome_marca: str,
    classes: List[int],
    pasta: Path,
    headless: bool = True,
    num_workers: int = 4,
) -> Dict:
    """
    Pipeline completo da Fase 1:
    1. Busca paralela por classe (1 browser por classe)
    2. Busca geral (sem classe)
    3. Deduplicação
    4. Separação em buckets A/B/C
    5. Gravação de todos os artefatos

    Returns:
        Dicionário com metadados e estatísticas da coleta
    """
    pasta = Path(pasta)
    coleta_dir = pasta / "coleta"
    coleta_dir.mkdir(parents=True, exist_ok=True)

    inicio = time.time()
    resultado = {
        "marca": nome_marca,
        "classes": classes,
        "metodo": "Pesquisa Avançada — análise por similaridade",
        "similaridade_minima": SIMILARIDADE_MIN,
        "max_paginas": MAX_PAGINAS_POR_CLASSE,
        "por_classe": {},
        "busca_geral": {},
        "total_coletadas": 0,
        "total_unicas": 0,
        "buckets": {"A": 0, "B": 0, "C": 0},
        "sucesso": False,
        "erro": None,
        "inicio": agora_iso(),
        "fim": None,
        "duracao_segundos": None,
    }

    # ─── ETAPA 1: Busca paralela por classe ───

    log(f"{'=' * 60}")
    log(f"FASE 1 — COLETA GERAL: {nome_marca}")
    log(f"Classes: {classes} | Workers: {min(num_workers, len(classes))}")
    log(f"Similaridade mínima: {SIMILARIDADE_MIN}% | Max páginas: {MAX_PAGINAS_POR_CLASSE}")
    log(f"{'=' * 60}\n")

    # Criar tasks para cada classe (limitado ao número de workers)
    semaforo = asyncio.Semaphore(num_workers)
    resultados_por_classe: Dict[int, List[Dict]] = {}

    async def buscar_com_semaforo(cls: int, wid: int):
        async with semaforo:
            marcas = await buscar_classe(nome_marca, cls, headless, wid)
            resultados_por_classe[cls] = marcas

    tasks = []
    for i, cls in enumerate(classes):
        tasks.append(asyncio.create_task(buscar_com_semaforo(cls, i + 1)))

    await asyncio.gather(*tasks)

    # Consolidar resultados por classe
    todas_marcas: List[Dict] = []
    processos_vistos = set()

    for cls in classes:
        marcas_cls = resultados_por_classe.get(cls, [])

        # Salvar lista por classe
        cls_path = coleta_dir / f"classe-{cls}-lista.json"
        with open(cls_path, "w", encoding="utf-8") as f:
            json.dump(marcas_cls, f, ensure_ascii=False, indent=2)

        resultado["por_classe"][str(cls)] = {
            "encontradas": len(marcas_cls),
        }

        # Acumular (deduplicar)
        for m in marcas_cls:
            if m["numero_processo"] not in processos_vistos:
                processos_vistos.add(m["numero_processo"])
                todas_marcas.append(m)

    log(f"\nTotal por classe (deduplicadas): {len(todas_marcas)}")

    # ─── ETAPA 2: Busca geral (sem classe) ───

    log(f"\n{'=' * 60}")
    log(f"BUSCA GERAL (sem classe)")
    log(f"{'=' * 60}\n")

    marcas_geral = await buscar_classe(nome_marca, None, headless, len(classes) + 1)

    # Salvar geral
    geral_path = coleta_dir / "geral-lista.json"
    with open(geral_path, "w", encoding="utf-8") as f:
        json.dump(marcas_geral, f, ensure_ascii=False, indent=2)

    # Acumular novas
    novas_geral = 0
    for m in marcas_geral:
        if m["numero_processo"] not in processos_vistos:
            processos_vistos.add(m["numero_processo"])
            todas_marcas.append(m)
            novas_geral += 1

    resultado["busca_geral"] = {
        "encontradas": len(marcas_geral),
        "novas_unicas": novas_geral,
    }
    log(f"\nBusca geral: {len(marcas_geral)} encontradas, {novas_geral} novas")

    # ─── ETAPA 3: Separação em buckets ───

    log(f"\n{'=' * 60}")
    log(f"SEPARAÇÃO EM BUCKETS")
    log(f"{'=' * 60}\n")

    bucket_a: List[Dict] = []
    bucket_b: List[Dict] = []
    bucket_c: List[Dict] = []

    for m in todas_marcas:
        bucket = classificar_bucket(m.get("situacao"))
        m["bucket"] = bucket
        m["coletado_em"] = agora_iso()

        # Marcas sem classe conhecida (busca geral) → flag para busca obrigatória
        if m.get("classe") is None:
            m["classe_desconhecida"] = True
            m["nota"] = "Classe não identificada na listagem. Buscar spec para descobrir classe."

        if bucket == "A":
            bucket_a.append(m)
        elif bucket == "B":
            bucket_b.append(m)
        else:
            bucket_c.append(m)

    log(f"  Bucket A (vivas):       {len(bucket_a)}")
    log(f"  Bucket B (indeferidas): {len(bucket_b)}")
    log(f"  Bucket C (mortas):      {len(bucket_c)}")
    log(f"  Total único:            {len(todas_marcas)}")

    resultado["total_coletadas"] = sum(
        len(resultados_por_classe.get(cls, [])) for cls in classes
    ) + len(marcas_geral)
    resultado["total_unicas"] = len(todas_marcas)
    resultado["buckets"] = {
        "A": len(bucket_a),
        "B": len(bucket_b),
        "C": len(bucket_c),
    }

    # ─── ETAPA 4: Gravação ───

    log(f"\n{'=' * 60}")
    log(f"GRAVAÇÃO DE ARTEFATOS")
    log(f"{'=' * 60}\n")

    # Buckets
    for nome_bucket, dados_bucket in [("a-vivas", bucket_a), ("b-indeferidas", bucket_b), ("c-mortas", bucket_c)]:
        bp = coleta_dir / f"bucket-{nome_bucket}.json"
        with open(bp, "w", encoding="utf-8") as f:
            json.dump(dados_bucket, f, ensure_ascii=False, indent=2)
        log(f"  {bp.name}: {len(dados_bucket)} marcas")

    # Consolidada
    consolidada_path = coleta_dir / "coleta-consolidada.json"
    with open(consolidada_path, "w", encoding="utf-8") as f:
        json.dump(todas_marcas, f, ensure_ascii=False, indent=2)
    log(f"  {consolidada_path.name}: {len(todas_marcas)} marcas")

    # Fonte bruta (master, indexado por número de processo)
    fonte_bruta: Dict[str, Dict] = {}
    for m in todas_marcas:
        entry = {
            "nome_marca": m.get("nome_marca"),
            "classe": m.get("classe"),
            "situacao": m.get("situacao"),
            "titular": m.get("titular"),
            "similaridade_pct": m.get("similaridade_pct"),
            "bucket": m.get("bucket"),
            "fonte": m.get("fonte"),
            "coletado_em": m.get("coletado_em"),
        }
        # Flag para marcas sem classe (busca geral) — obrigatório buscar spec
        if m.get("classe") is None:
            entry["classe_desconhecida"] = True
            entry["nota"] = "Classe não identificada na listagem. Buscar spec para descobrir classe."
        fonte_bruta[m["numero_processo"]] = entry

    fonte_bruta_path = pasta / "fonte-bruta.json"
    with open(fonte_bruta_path, "w", encoding="utf-8") as f:
        json.dump(fonte_bruta, f, ensure_ascii=False, indent=2)
    log(f"  fonte-bruta.json: {len(fonte_bruta)} processos")

    # Metadados da coleta
    fim = time.time()
    resultado["fim"] = agora_iso()
    resultado["duracao_segundos"] = round(fim - inicio, 1)
    resultado["sucesso"] = True

    metadados_path = coleta_dir / "coleta-metadados.json"
    with open(metadados_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    log(f"  {metadados_path.name}: metadados do pipeline")

    # ─── RESUMO FINAL ───

    log(f"\n{'=' * 60}")
    log(f"RESUMO — {nome_marca}")
    log(f"{'=' * 60}")
    for cls in classes:
        info = resultado["por_classe"].get(str(cls), {})
        log(f"  Classe {cls}: {info.get('encontradas', 0)} marcas")
    log(f"  Geral: {resultado['busca_geral'].get('novas_unicas', 0)} novas")
    log(f"  Total único: {resultado['total_unicas']}")
    log(f"  Bucket A: {resultado['buckets']['A']} | B: {resultado['buckets']['B']} | C: {resultado['buckets']['C']}")
    log(f"  Duração: {resultado['duracao_segundos']}s")
    log(f"  Status: {'OK' if resultado['sucesso'] else 'FALHA'}")

    return resultado


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Fase 1 — Coleta geral do INPI: busca por similaridade paralela, "
            "separação em buckets, gravação de fonte-bruta.json"
        ),
    )
    parser.add_argument("marca", help="Nome da marca a pesquisar")
    parser.add_argument(
        "--classes", required=True,
        help="Classes NCL separadas por vírgula (ex: 44,41,42,35)",
    )
    parser.add_argument(
        "--pasta", required=True,
        help="Pasta do caso (ex: laudos/Equipe Plenya/Plenya)",
    )
    parser.add_argument(
        "--workers", type=int, default=4,
        help="Número máximo de browsers paralelos (default: 4)",
    )
    parser.add_argument(
        "--visible", action="store_true",
        help="Mostrar browsers (não headless)",
    )
    parser.add_argument(
        "--similaridade-min", type=int, default=SIMILARIDADE_MIN,
        help=f"Percentual mínimo de similaridade para continuar paginando (default: {SIMILARIDADE_MIN})",
    )
    parser.add_argument(
        "--max-paginas", type=int, default=MAX_PAGINAS_POR_CLASSE,
        help=f"Máximo de páginas por classe (default: {MAX_PAGINAS_POR_CLASSE})",
    )

    args = parser.parse_args()
    classes = [int(c.strip()) for c in args.classes.split(",")]

    resultado = asyncio.run(
        executar_coleta(
            nome_marca=args.marca,
            classes=classes,
            pasta=Path(args.pasta),
            headless=not args.visible,
            num_workers=args.workers,
        )
    )

    sys.exit(0 if resultado["sucesso"] else 1)


if __name__ == "__main__":
    main()
