#!/usr/bin/env python3
"""
coletar_specs.py — Fase 3A do Pipeline v3

Recebe uma lista de números de processo (do peneira-resultado.json) e busca
a ficha completa de cada um no INPI com especificações EXPANDIDAS.

Usa N browsers paralelos (workers independentes), cada um com:
- Login próprio (cookies zerados)
- Relogin a cada 2 buscas (evita rate limit)
- Expansão de specs via JavaScript (divs ocultos forçados a display:block)
- Retry com backoff em caso de timeout

NÃO faz julgamento. NÃO filtra. NÃO interpreta.
Apenas coleta e salva exatamente o que o INPI mostra.

Grava:
  - specs/specs-completas.json (fichas estruturadas)
  - Enriquece fonte-bruta.json com campo 'especificacao_completa'

Uso:
    python coletar_specs.py \\
        --input "peneira/peneira-resultado.json" \\
        --campo "nivel_1_candidatas,nivel_2_zona_atencao" \\
        --pasta "laudos/Equipe Plenya/Plenya" \\
        --workers 8

    Ou com lista direta de processos:
    python coletar_specs.py \\
        --processos "940215020,936580372,920111222" \\
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


DELAY_ENTRE_BUSCAS = 8.0     # segundos entre cada busca de protocolo (era 6)
DELAY_POS_LOGIN = 4.0        # segundos após login (era 3)
MAX_RETRIES = 2               # tentativas por protocolo
RELOGIN_CADA_N = 3            # relogin a cada N buscas (era 2, menos logins)
STAGGER_WORKERS = 5.0         # segundos entre start de cada worker (era 3)
MAX_TIMEOUTS_SEGUIDOS = 3     # se 3 timeouts seguidos, parar worker e esperar
PAUSA_APOS_TIMEOUTS = 60.0   # segundos de pausa após 3 timeouts

# User-agents realistas para rotação
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
]


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
# EXPANSÃO DE ESPECIFICAÇÕES
# ─────────────────────────────────────────────

JS_EXPANDIR_SPECS = """() => {
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
}"""


# ─────────────────────────────────────────────
# BUSCA DE FICHA INDIVIDUAL
# ─────────────────────────────────────────────

async def buscar_ficha(page, numero: str, delay: float = DELAY_ENTRE_BUSCAS) -> Optional[Dict]:
    """
    Busca ficha completa de um protocolo individual no INPI.
    Expande especificações ocultas via JavaScript.
    Extrai campos estruturados.

    Returns:
        Dict com campos da ficha ou None se falhou.
    """
    for tentativa in range(MAX_RETRIES + 1):
        try:
            if tentativa > 0:
                wait = delay * (2 ** tentativa)
                log(f"    [{numero}] Retry {tentativa}/{MAX_RETRIES} (aguardando {wait:.0f}s)")
                await asyncio.sleep(wait)
                # Relogin antes do retry
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                    wait_until="domcontentloaded",
                )
                await asyncio.sleep(DELAY_POS_LOGIN)

            # Buscar por número
            await page.goto(
                "https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_num_processo.jsp",
                wait_until="domcontentloaded",
            )
            await asyncio.sleep(1)

            await page.locator('input[name="NumPedido"]').fill(numero)
            await page.locator('input[name="botao"]').click()
            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(2)

            page_text = await page.evaluate("() => document.body.innerText")

            if "nenhum" in page_text.lower():
                log(f"    [{numero}] Não encontrado")
                return None

            # Se caiu em lista, clicar no detalhe
            link = page.locator(f"a:has-text('{numero}')").first
            if await link.count() > 0:
                await link.click()
                await page.wait_for_load_state("domcontentloaded")
                await asyncio.sleep(2)

            # Expandir especificações ocultas
            await page.evaluate(JS_EXPANDIR_SPECS)
            await asyncio.sleep(0.5)

            # Extrair texto completo da ficha
            page_text = await page.evaluate("() => document.body.innerText")

            # Limpar header do INPI
            clean = page_text.strip()
            header_end = re.search(
                r"(?:Consulta à Base de Dados do INPI|Início \| Ajuda)",
                clean,
            )
            if header_end:
                clean = clean[header_end.end():].strip()

            if not clean or len(clean) < 100:
                log(f"    [{numero}] Conteúdo insuficiente")
                return None

            # Extrair campos estruturados do texto da ficha
            ficha = extrair_campos_ficha(numero, clean)
            ficha["texto_bruto"] = clean
            ficha["coletado_em"] = agora_iso()

            log(f"    [{numero}] OK ({len(clean)} chars | spec: {len(ficha.get('especificacao_completa', '') or '')} chars)")
            await asyncio.sleep(delay)
            return ficha

        except Exception as e:
            err = str(e)
            retryable = any(kw in err for kw in ["net::", "Timeout", "timeout", "ERR_CONNECTION"])
            if tentativa < MAX_RETRIES and retryable:
                log(f"    [{numero}] {'Timeout' if 'imeout' in err else 'Erro'} — retentando...")
                continue
            log(f"    [{numero}] Erro: {e}")
            return None

    return None


def extrair_campos_ficha(numero: str, texto: str) -> Dict:
    """
    Extrai campos estruturados do texto bruto da ficha do INPI.

    O formato da ficha do INPI é:
        Marca:        NOME DA MARCA
        Situação:     Registro de marca em vigor
        Apresentação: Nominativa
        Natureza:     Produtos e/ou Serviço
        NCL(11) 44
        ...
        Especificação
        (texto completo da especificação — expandido pelo JS)
        ...
        Titular(1):   NOME DO TITULAR

    A especificação pode vir:
    - Após a linha "Especificação" (sem dois-pontos)
    - Como texto longo numa linha separada abaixo
    - Expandida pelo JS que substitui o link truncado pelo texto completo
    """
    ficha: Dict = {
        "numero_processo": numero,
        "nome_marca": None,
        "classe": None,
        "classes_detalhadas": [],   # Para múltiplas classes (Protocolo de Madrid)
        "situacao": None,
        "titular": None,
        "especificacao_completa": None,
        "natureza": None,
        "apresentacao": None,
    }

    linhas = texto.split("\n")

    for i, linha in enumerate(linhas):
        stripped = linha.strip()
        lower = stripped.lower()

        # Marca (campo com tab ou dois-pontos — com \xa0 non-breaking space)
        if re.match(r"^Marca[:\t]", stripped) and not lower.startswith("marcas"):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if not valor and i + 1 < len(linhas):
                valor = linhas[i + 1].strip()
            if valor and valor != numero and len(valor) > 1:
                ficha["nome_marca"] = valor

        # Situação
        elif re.match(r"^Situa[çc]ão[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["situacao"] = valor

        # Apresentação
        elif re.match(r"^Apresenta[çc]ão[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["apresentacao"] = valor

        # Natureza
        elif lower.startswith("natureza"):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["natureza"] = valor

        # Classe NCL — formatos: "NCL(11) 44", "NCL(12) 05", "31 : 20"
        # Um processo pode ter múltiplas classes (Protocolo de Madrid)
        # Ex: "NCL(12) 44" numa linha, "NCL(12) 35" em outra
        # Também pode vir com situação: "NCL(11) 45 - Deferida" ou "NCL(11) 45 - Excluída"
        elif re.search(r"NCL\(\d+\)\s*\d+", stripped):
            for ncl_match in re.finditer(r"NCL\(\d+\)\s*(\d+)(?:\s*-\s*(.+))?", stripped):
                cls_num = int(ncl_match.group(1))
                cls_sit = ncl_match.group(2).strip() if ncl_match.group(2) else None
                ficha["classes_detalhadas"].append({
                    "classe": cls_num,
                    "situacao_classe": cls_sit,  # "Deferida", "Excluída", None
                })
                if ficha["classe"] is None:
                    ficha["classe"] = cls_num  # primeira classe como principal
        elif re.match(r"^\d{1,2}\s*:\s*\d{1,2}$", stripped) and ficha["classe"] is None:
            m = re.match(r"^(\d{1,2})", stripped)
            if m:
                cls_num = int(m.group(1))
                ficha["classe"] = cls_num
                ficha["classes_detalhadas"].append({"classe": cls_num, "situacao_classe": None})

        # Titular
        elif re.match(r"^Titular\(\d+\)[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["titular"] = valor

        # Especificação — formato real do INPI:
        # Linha longa com tabs contendo: "header da classe\tVide Situação...\t spec completa"
        # OU: linha separada abaixo de "Especificação" com o texto completo
        # Estratégia: buscar "Vide Situação do Processo" como marcador
        if "Vide Situa" in stripped and ficha["especificacao_completa"] is None:
            # A spec vem após o último tab depois de "Vide Situação"
            partes = stripped.split("\t")
            for p in reversed(partes):
                p_clean = p.strip().replace("\xa0", " ").strip()
                # Pular o próprio "Vide Situação" e headers curtos
                if p_clean.startswith("Vide Situa"):
                    continue
                if len(p_clean) > 50 and ";" in p_clean:
                    ficha["especificacao_completa"] = p_clean
                    break

        # Fallback: linha longa com muitos ";" que parece especificação
        if (ficha["especificacao_completa"] is None
            and len(stripped) > 200
            and stripped.count(";") > 3
            and not lower.startswith("classe")
            and not lower.startswith("classificação")):
            # Limpar possíveis prefixos
            spec_text = stripped
            # Remover header de classe se presente no início
            vide_pos = spec_text.find("Vide Situa")
            if vide_pos >= 0:
                # Pegar tudo após "Vide Situação do Processo" + tab
                after_vide = spec_text[vide_pos:]
                partes_after = after_vide.split("\t")
                for p in partes_after[1:]:
                    p_clean = p.strip().replace("\xa0", " ").strip()
                    if len(p_clean) > 50 and ";" in p_clean:
                        spec_text = p_clean
                        break
            ficha["especificacao_completa"] = spec_text.strip()

    return ficha


# ─────────────────────────────────────────────
# WORKER PARALELO
# ─────────────────────────────────────────────

async def worker(
    worker_id: int,
    protocolos: List[str],
    resultados: Dict[str, Dict],
    headless: bool = True,
):
    """
    Worker paralelo: abre browser independente, busca fichas de protocolos
    com relogin periódico e proteção contra ban.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return

    ua = USER_AGENTS[(worker_id - 1) % len(USER_AGENTS)]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=ua,
        )
        page = await context.new_page()
        page.set_default_timeout(90000)  # 90s timeout (INPI é lento)

        # Login inicial
        try:
            await page.goto(
                "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                wait_until="domcontentloaded",
            )
        except Exception as e:
            log(f"  [W{worker_id}] ERRO no login: {e}")
            await browser.close()
            return

        await asyncio.sleep(DELAY_POS_LOGIN)
        log(f"  [W{worker_id}] Login OK — {len(protocolos)} protocolos")

        timeouts_seguidos = 0

        for i, proto in enumerate(protocolos):
            # Relogin periódico
            if i > 0 and i % RELOGIN_CADA_N == 0:
                try:
                    await page.goto(
                        "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                        wait_until="domcontentloaded",
                    )
                    await asyncio.sleep(DELAY_POS_LOGIN)
                except Exception:
                    log(f"  [W{worker_id}] Relogin falhou, tentando continuar...")

            ficha = await buscar_ficha(page, proto)
            if ficha:
                resultados[proto] = ficha
                timeouts_seguidos = 0
            else:
                timeouts_seguidos += 1
                if timeouts_seguidos >= MAX_TIMEOUTS_SEGUIDOS:
                    log(f"  [W{worker_id}] {MAX_TIMEOUTS_SEGUIDOS} falhas seguidas — pausando {PAUSA_APOS_TIMEOUTS}s")
                    await asyncio.sleep(PAUSA_APOS_TIMEOUTS)
                    # Relogin após pausa
                    try:
                        await page.goto(
                            "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                            wait_until="domcontentloaded",
                        )
                        await asyncio.sleep(DELAY_POS_LOGIN)
                    except Exception:
                        pass
                    timeouts_seguidos = 0

        await browser.close()
        log(f"  [W{worker_id}] Finalizado — {sum(1 for p in protocolos if p in resultados)}/{len(protocolos)} OK")


async def coletar_fichas_paralelo(
    protocolos: List[str],
    num_workers: int = 8,
    headless: bool = True,
) -> Dict[str, Dict]:
    """
    Distribui protocolos entre N workers e busca fichas em paralelo.

    Returns:
        Dict[numero_processo → ficha]
    """
    if not protocolos:
        return {}

    # Distribuir round-robin
    chunks = [[] for _ in range(min(num_workers, len(protocolos)))]
    for i, proto in enumerate(protocolos):
        chunks[i % len(chunks)].append(proto)

    resultados: Dict[str, Dict] = {}
    tasks = []

    log(f"  Distribuindo {len(protocolos)} protocolos entre {len(chunks)} workers")

    for i, chunk in enumerate(chunks):
        await asyncio.sleep(STAGGER_WORKERS)
        tasks.append(asyncio.create_task(worker(i + 1, chunk, resultados, headless)))

    await asyncio.gather(*tasks)

    falhas = [p for p in protocolos if p not in resultados]
    if falhas:
        log(f"  ⚠ {len(falhas)} protocolos falharam: {falhas[:10]}{'...' if len(falhas) > 10 else ''}")

    return resultados


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

async def executar_coleta_specs(
    processos: List[str],
    pasta: Path,
    headless: bool = True,
    num_workers: int = 8,
) -> Dict:
    """
    Busca fichas completas com specs expandidas para uma lista de processos.
    Salva em specs/specs-completas.json e enriquece fonte-bruta.json.
    """
    pasta = Path(pasta)
    specs_dir = pasta / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)

    inicio = time.time()

    log(f"{'=' * 60}")
    log(f"FASE 3A — COLETA DE ESPECIFICAÇÕES")
    log(f"Protocolos: {len(processos)} | Workers: {num_workers}")
    log(f"{'=' * 60}\n")

    resultados = await coletar_fichas_paralelo(processos, num_workers, headless)

    # Salvar specs
    specs_lista = []
    for proto in processos:
        if proto in resultados:
            specs_lista.append(resultados[proto])

    specs_path = specs_dir / "specs-completas.json"
    with open(specs_path, "w", encoding="utf-8") as f:
        json.dump(specs_lista, f, ensure_ascii=False, indent=2)
    log(f"\n  specs-completas.json: {len(specs_lista)} fichas")

    # Enriquecer fonte-bruta.json
    fonte_bruta_path = pasta / "fonte-bruta.json"
    if fonte_bruta_path.exists():
        with open(fonte_bruta_path, "r", encoding="utf-8") as f:
            fonte_bruta = json.load(f)

        for proto, ficha in resultados.items():
            if proto in fonte_bruta:
                fonte_bruta[proto]["especificacao_completa"] = ficha.get("especificacao_completa")
                fonte_bruta[proto]["natureza"] = ficha.get("natureza")
                # Se a ficha trouxe classe, atualizar (pode ser mais precisa)
                if ficha.get("classe") is not None:
                    fonte_bruta[proto]["classe"] = ficha["classe"]
                    if fonte_bruta[proto].get("classe_desconhecida"):
                        del fonte_bruta[proto]["classe_desconhecida"]
                # Se a ficha NÃO trouxe classe, manter a do fonte-bruta (Fase 1)
                # e copiar pro objeto da ficha pra consistência
                elif fonte_bruta[proto].get("classe") is not None:
                    ficha["classe"] = fonte_bruta[proto]["classe"]
                fonte_bruta[proto]["apresentacao"] = ficha.get("apresentacao")
                fonte_bruta[proto]["specs_coletado_em"] = ficha.get("coletado_em")

        with open(fonte_bruta_path, "w", encoding="utf-8") as f:
            json.dump(fonte_bruta, f, ensure_ascii=False, indent=2)
        log(f"  fonte-bruta.json: {len(resultados)} processos enriquecidos")

    fim = time.time()
    falhas = [p for p in processos if p not in resultados]

    metadados = {
        "fase": "3A",
        "total_solicitados": len(processos),
        "total_coletados": len(resultados),
        "total_falhas": len(falhas),
        "falhas": falhas,
        "duracao_segundos": round(fim - inicio, 1),
        "inicio": agora_iso(),
    }

    metadados_path = specs_dir / "specs-metadados.json"
    with open(metadados_path, "w", encoding="utf-8") as f:
        json.dump(metadados, f, ensure_ascii=False, indent=2)

    log(f"\n  Duração: {metadados['duracao_segundos']}s")
    log(f"  Coletados: {len(resultados)}/{len(processos)}")
    if falhas:
        log(f"  Falhas: {len(falhas)}")

    return metadados


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fase 3A — Coleta de especificações completas do INPI",
    )
    parser.add_argument(
        "--input",
        help="Caminho do peneira-resultado.json",
    )
    parser.add_argument(
        "--campo",
        default="nivel_1_candidatas,nivel_2_zona_atencao",
        help="Campos do JSON de input com listas de processos (separados por vírgula)",
    )
    parser.add_argument(
        "--processos",
        help="Lista direta de processos separados por vírgula (alternativa ao --input)",
    )
    parser.add_argument(
        "--pasta", required=True,
        help="Pasta do caso",
    )
    parser.add_argument(
        "--workers", type=int, default=8,
        help="Número de browsers paralelos (default: 8)",
    )
    parser.add_argument(
        "--visible", action="store_true",
        help="Mostrar browsers",
    )

    args = parser.parse_args()

    # Resolver lista de processos
    processos = []
    if args.processos:
        processos = [p.strip() for p in args.processos.split(",") if p.strip()]
    elif args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        campos = [c.strip() for c in args.campo.split(",")]
        for campo in campos:
            processos.extend(data.get(campo, []))
    else:
        print("Erro: forneça --input ou --processos")
        sys.exit(1)

    if not processos:
        print("Nenhum processo para buscar.")
        sys.exit(0)

    # Deduplicar mantendo ordem
    vistos = set()
    processos_unicos = []
    for p in processos:
        if p not in vistos:
            vistos.add(p)
            processos_unicos.append(p)

    resultado = asyncio.run(
        executar_coleta_specs(
            processos=processos_unicos,
            pasta=Path(args.pasta),
            headless=not args.visible,
            num_workers=args.workers,
        )
    )

    sys.exit(0 if resultado["total_falhas"] == 0 else 1)


if __name__ == "__main__":
    main()
