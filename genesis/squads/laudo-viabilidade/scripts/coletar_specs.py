#!/usr/bin/env python3
"""
coletar_specs.py — Fase 3A do Pipeline v3 (com Tor + Semáforo Adaptativo)

Recebe uma lista de números de processo (do peneira-resultado.json) e busca
a ficha completa de cada um no INPI com especificações EXPANDIDAS.

Arquitetura:
- 1 processo Tor com IsolateSOCKSAuth (~50MB RAM)
- Até 40 browsers Playwright headless, cada um com IP diferente
- Semáforo adaptativo: controla workers por CPU real, não por contagem fixa
- Escalonamento: browsers não abrem todos juntos

Proteção:
- CPU gate: se CPU > 70%, pausa novos workers
- Rate limit: relogin a cada N buscas
- Retry com backoff em caso de timeout
- Timeout de sessão: se INPI demora demais, não acumula spike

Grava:
  - specs/specs-completas.json (fichas estruturadas)
  - Enriquece fonte-bruta.json com campo 'especificacao_completa'

Uso:
    python coletar_specs.py \\
        --input "peneira/lista-specs.json" \\
        --pasta "laudos/Reinaldo Neto/RUN BABY RUN" \\
        --workers 40 --tor

    Sem Tor (modo original):
    python coletar_specs.py \\
        --input "peneira/lista-specs.json" \\
        --pasta "laudos/Reinaldo Neto/RUN BABY RUN" \\
        --workers 6
"""

import asyncio
import argparse
import json
import os
import re
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional


# ─────────────────────────────────────────────
# CONFIGURAÇÃO
# ─────────────────────────────────────────────

DELAY_ENTRE_BUSCAS = 3.0      # segundos entre buscas (menor com Tor, cada IP é diferente)
DELAY_ENTRE_BUSCAS_SEM_TOR = 8.0  # sem Tor, manter delay alto
DELAY_POS_LOGIN = 3.0
MAX_RETRIES = 2
RELOGIN_CADA_N = 3
STAGGER_DELAY = 1.5            # segundos entre launch de cada worker (Tor precisa de tempo pra estabilizar circuitos)
MAX_TIMEOUTS_SEGUIDOS = 3
PAUSA_APOS_TIMEOUTS = 30.0
CPU_LIMIT = 70                 # % máximo de CPU antes de pausar novos workers
CPU_CHECK_INTERVAL = 0.5       # segundos entre checks de CPU

TOR_SOCKS_PORT = 9050
TOR_DATA_DIR = "/tmp/tor-laudos"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
]


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_cpu_percent() -> float:
    """CPU usage sem depender do psutil (usa /proc/stat no Linux, ps no macOS)."""
    try:
        import psutil
        return psutil.cpu_percent(interval=0.3)
    except ImportError:
        pass
    # Fallback: ps
    try:
        out = subprocess.check_output(
            ["ps", "-A", "-o", "%cpu"], text=True, timeout=2
        )
        total = sum(float(x) for x in out.strip().split("\n")[1:] if x.strip())
        ncpu = os.cpu_count() or 4
        return min(total / ncpu, 100.0)
    except Exception:
        return 0.0  # Se não consegue medir, não bloqueia


# ─────────────────────────────────────────────
# TOR MANAGEMENT
# ─────────────────────────────────────────────

class TorManager:
    """
    Gerencia processo Tor com múltiplas SocksPorts.

    Chromium não suporta SOCKS5 auth, então usamos N portas diferentes.
    Cada porta = circuito independente = IP diferente.
    """

    def __init__(self, base_port: int = TOR_SOCKS_PORT, num_ports: int = 20, data_dir: str = TOR_DATA_DIR):
        self.base_port = base_port
        self.num_ports = num_ports
        self.data_dir = data_dir
        self.process: Optional[subprocess.Popen] = None
        self._counter = 0
        self.ports: List[int] = []

    def start(self) -> bool:
        """Inicia Tor com N SocksPorts. Detecta Tor já rodando (systemd)."""
        import socket as sock_mod

        # 1. Detectar portas Tor já ativas (systemd / manual)
        existing_ports = []
        for port in range(self.base_port, self.base_port + self.num_ports):
            try:
                s = sock_mod.socket(sock_mod.AF_INET, sock_mod.SOCK_STREAM)
                s.settimeout(0.5)
                s.connect(("127.0.0.1", port))
                s.close()
                existing_ports.append(port)
            except Exception:
                pass

        if existing_ports:
            self.ports = existing_ports
            self._managed = False
            log(f"Tor já rodando. {len(self.ports)} portas detectadas ({self.ports[0]}-{self.ports[-1]}).")
            return True

        # 2. Se não tem Tor rodando, iniciar
        os.makedirs(self.data_dir, exist_ok=True)

        tor_bin = None
        for path in ["/opt/homebrew/opt/tor/bin/tor", "/usr/bin/tor", "/usr/local/bin/tor"]:
            if os.path.exists(path):
                tor_bin = path
                break
        if not tor_bin:
            try:
                subprocess.check_output(["which", "tor"], text=True, timeout=5)
                tor_bin = "tor"
            except Exception:
                log("ERRO: Tor não encontrado. Instale com: apt install tor (Linux) ou brew install tor (macOS)")
                return False

        self.ports = [self.base_port + i for i in range(self.num_ports)]
        args = [tor_bin, "--DataDirectory", self.data_dir, "--Log", "err stderr"]
        for i, port in enumerate(self.ports):
            args.extend(["--SocksPort", f"{port} SessionGroup={i}"])

        log(f"Iniciando Tor com {self.num_ports} portas ({self.base_port}-{self.ports[-1]})...")
        self.process = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        self._managed = True

        for _ in range(30):
            time.sleep(1)
            if self.process.poll() is not None:
                stderr = self.process.stderr.read().decode() if self.process.stderr else ""
                log(f"ERRO: Tor encerrou prematuramente: {stderr[:200]}")
                return False
            try:
                s = sock_mod.socket(sock_mod.AF_INET, sock_mod.SOCK_STREAM)
                s.settimeout(1)
                s.connect(("127.0.0.1", self.base_port))
                s.close()
                log(f"Tor pronto. {self.num_ports} circuitos disponíveis.")
                return True
            except Exception:
                continue

        log("ERRO: Tor não ficou pronto em 30s")
        return False

    def get_proxy(self) -> Dict:
        """Retorna proxy config com porta rotativa (sem auth — Chromium-compatible)."""
        port = self.ports[self._counter % len(self.ports)]
        self._counter += 1
        return {
            "server": f"socks5://127.0.0.1:{port}",
        }

    def stop(self):
        """Encerra Tor (só se foi iniciado por nós)."""
        if hasattr(self, '_managed') and not self._managed:
            log("Tor gerenciado externamente — não encerrando.")
            return
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            log("Tor encerrado.")


# ─────────────────────────────────────────────
# SEMÁFORO ADAPTATIVO
# ─────────────────────────────────────────────

class AdaptiveSemaphore:
    """
    Semáforo que controla concorrência por 2 critérios:
    1. Número máximo de workers (limite de RAM)
    2. CPU atual (limite de processamento)

    Se CPU > cpu_limit, bloqueia novos workers até baixar.
    """

    def __init__(self, max_workers: int = 40, cpu_limit: int = CPU_LIMIT):
        self.max_workers = max_workers
        self.cpu_limit = cpu_limit
        self.active = 0
        self.total_started = 0
        self.total_completed = 0
        self.cpu_waits = 0
        self._lock = asyncio.Lock()

    async def acquire(self):
        while True:
            async with self._lock:
                if self.active < self.max_workers:
                    cpu = get_cpu_percent()
                    if cpu < self.cpu_limit:
                        self.active += 1
                        self.total_started += 1
                        return
                    else:
                        self.cpu_waits += 1
            await asyncio.sleep(CPU_CHECK_INTERVAL)

    async def release(self):
        async with self._lock:
            self.active -= 1
            self.total_completed += 1

    def stats(self) -> str:
        return f"active={self.active} started={self.total_started} done={self.total_completed} cpu_waits={self.cpu_waits}"


# ─────────────────────────────────────────────
# EXPANSÃO DE ESPECIFICAÇÕES (JavaScript)
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
    """
    for tentativa in range(MAX_RETRIES + 1):
        try:
            if tentativa > 0:
                wait = delay * (2 ** tentativa)
                log(f"    [{numero}] Retry {tentativa}/{MAX_RETRIES} (aguardando {wait:.0f}s)")
                await asyncio.sleep(wait)
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                    wait_until="domcontentloaded",
                )
                await asyncio.sleep(DELAY_POS_LOGIN)

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

            link = page.locator(f"a:has-text('{numero}')").first
            if await link.count() > 0:
                await link.click()
                await page.wait_for_load_state("domcontentloaded")
                await asyncio.sleep(2)

            await page.evaluate(JS_EXPANDIR_SPECS)
            await asyncio.sleep(0.5)

            page_text = await page.evaluate("() => document.body.innerText")

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
    """Extrai campos estruturados do texto bruto da ficha do INPI."""
    ficha: Dict = {
        "numero_processo": numero,
        "nome_marca": None,
        "classe": None,
        "classes_detalhadas": [],
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

        if re.match(r"^Marca[:\t]", stripped) and not lower.startswith("marcas"):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if not valor and i + 1 < len(linhas):
                valor = linhas[i + 1].strip()
            if valor and valor != numero and len(valor) > 1:
                ficha["nome_marca"] = valor

        elif re.match(r"^Situa[çc]ão[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["situacao"] = valor

        elif re.match(r"^Apresenta[çc]ão[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["apresentacao"] = valor

        elif lower.startswith("natureza"):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["natureza"] = valor

        elif re.search(r"NCL\(\d+\)\s*\d+", stripped):
            for ncl_match in re.finditer(r"NCL\(\d+\)\s*(\d+)(?:\s*-\s*(.+))?", stripped):
                cls_num = int(ncl_match.group(1))
                cls_sit = ncl_match.group(2).strip() if ncl_match.group(2) else None
                ficha["classes_detalhadas"].append({
                    "classe": cls_num,
                    "situacao_classe": cls_sit,
                })
                if ficha["classe"] is None:
                    ficha["classe"] = cls_num
        elif re.match(r"^\d{1,2}\s*:\s*\d{1,2}$", stripped) and ficha["classe"] is None:
            m = re.match(r"^(\d{1,2})", stripped)
            if m:
                cls_num = int(m.group(1))
                ficha["classe"] = cls_num
                ficha["classes_detalhadas"].append({"classe": cls_num, "situacao_classe": None})

        elif re.match(r"^Titular\(\d+\)[:\t]", stripped):
            valor = re.split(r"[:\t\xa0]+", stripped, maxsplit=1)[-1].strip()
            if valor:
                ficha["titular"] = valor

        if "Vide Situa" in stripped and ficha["especificacao_completa"] is None:
            partes = stripped.split("\t")
            for p in reversed(partes):
                p_clean = p.strip().replace("\xa0", " ").strip()
                if p_clean.startswith("Vide Situa"):
                    continue
                if len(p_clean) > 50 and ";" in p_clean:
                    ficha["especificacao_completa"] = p_clean
                    break

        if (ficha["especificacao_completa"] is None
            and len(stripped) > 200
            and stripped.count(";") > 3
            and not lower.startswith("classe")
            and not lower.startswith("classificação")):
            spec_text = stripped
            vide_pos = spec_text.find("Vide Situa")
            if vide_pos >= 0:
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
# WORKER COM TOR + SEMÁFORO ADAPTATIVO
# ─────────────────────────────────────────────

async def worker_adaptivo(
    worker_id: int,
    numero: str,
    semaforo: AdaptiveSemaphore,
    resultados: Dict[str, Dict],
    tor: Optional[TorManager] = None,
    headless: bool = True,
    delay: float = DELAY_ENTRE_BUSCAS,
):
    """Worker individual: abre browser, busca 1 ficha, fecha browser."""
    await semaforo.acquire()
    try:
        from playwright.async_api import async_playwright

        ua = USER_AGENTS[worker_id % len(USER_AGENTS)]
        proxy = tor.get_proxy() if tor else None

        async with async_playwright() as p:
            launch_args = {"headless": headless}
            if proxy:
                launch_args["proxy"] = proxy

            browser = await p.chromium.launch(**launch_args)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=ua,
                ignore_https_errors=True,
            )
            page = await context.new_page()
            page.set_default_timeout(90000)

            # Login
            try:
                await page.goto(
                    "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                    wait_until="domcontentloaded",
                )
                await asyncio.sleep(DELAY_POS_LOGIN)
            except Exception as e:
                log(f"  [W{worker_id}] Login falhou: {e}")
                await browser.close()
                return

            # Buscar ficha
            ficha = await buscar_ficha(page, numero, delay)
            if ficha:
                resultados[numero] = ficha

            await browser.close()

    except Exception as e:
        log(f"  [W{worker_id}] Erro worker: {e}")
    finally:
        await semaforo.release()


async def coletar_fichas_adaptivo(
    protocolos: List[str],
    max_workers: int = 40,
    tor: Optional[TorManager] = None,
    headless: bool = True,
    cpu_limit: int = CPU_LIMIT,
) -> Dict[str, Dict]:
    """
    Coleta fichas com semáforo adaptativo + Tor.
    Cada worker abre e fecha seu próprio browser (IP isolado via Tor).
    """
    if not protocolos:
        return {}

    delay = DELAY_ENTRE_BUSCAS if tor else DELAY_ENTRE_BUSCAS_SEM_TOR
    semaforo = AdaptiveSemaphore(max_workers=max_workers, cpu_limit=cpu_limit)
    resultados: Dict[str, Dict] = {}

    log(f"  Modo: {'Tor + IsolateSOCKSAuth' if tor else 'IP direto'}")
    log(f"  Workers max: {max_workers} | CPU limit: {cpu_limit}%")
    log(f"  Delay entre buscas: {delay}s")
    log(f"  Protocolos: {len(protocolos)}")

    # Escalonar launches
    tasks = []
    for i, proto in enumerate(protocolos):
        task = asyncio.create_task(
            worker_adaptivo(i + 1, proto, semaforo, resultados, tor, headless, delay)
        )
        tasks.append(task)
        # Escalonar: não lançar todos ao mesmo tempo
        if (i + 1) % max_workers == 0:
            # Esperar um batch terminar antes do próximo
            await asyncio.sleep(1)
        else:
            await asyncio.sleep(STAGGER_DELAY)

    await asyncio.gather(*tasks)

    log(f"  Semáforo: {semaforo.stats()}")

    falhas = [p for p in protocolos if p not in resultados]
    if falhas:
        log(f"  ⚠ {len(falhas)} protocolos falharam: {falhas[:10]}{'...' if len(falhas) > 10 else ''}")

    return resultados


# ─────────────────────────────────────────────
# WORKER LEGADO (sem Tor, modelo antigo com browser persistente)
# ─────────────────────────────────────────────

async def worker_legado(
    worker_id: int,
    protocolos: List[str],
    resultados: Dict[str, Dict],
    headless: bool = True,
):
    """Worker legado: 1 browser faz várias buscas sequenciais com relogin."""
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
        page.set_default_timeout(90000)

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
            if i > 0 and i % RELOGIN_CADA_N == 0:
                try:
                    await page.goto(
                        "https://busca.inpi.gov.br/pePI/servlet/LoginController?action=login",
                        wait_until="domcontentloaded",
                    )
                    await asyncio.sleep(DELAY_POS_LOGIN)
                except Exception:
                    pass

            ficha = await buscar_ficha(page, proto, DELAY_ENTRE_BUSCAS_SEM_TOR)
            if ficha:
                resultados[proto] = ficha
                timeouts_seguidos = 0
            else:
                timeouts_seguidos += 1
                if timeouts_seguidos >= MAX_TIMEOUTS_SEGUIDOS:
                    log(f"  [W{worker_id}] {MAX_TIMEOUTS_SEGUIDOS} falhas seguidas — pausando {PAUSA_APOS_TIMEOUTS}s")
                    await asyncio.sleep(PAUSA_APOS_TIMEOUTS)
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


async def coletar_fichas_legado(
    protocolos: List[str],
    num_workers: int = 6,
    headless: bool = True,
) -> Dict[str, Dict]:
    """Modo legado: N browsers persistentes, sem Tor."""
    if not protocolos:
        return {}

    chunks = [[] for _ in range(min(num_workers, len(protocolos)))]
    for i, proto in enumerate(protocolos):
        chunks[i % len(chunks)].append(proto)

    resultados: Dict[str, Dict] = {}
    tasks = []

    log(f"  Modo: legado (sem Tor) | Workers: {len(chunks)}")

    for i, chunk in enumerate(chunks):
        await asyncio.sleep(5.0)
        tasks.append(asyncio.create_task(worker_legado(i + 1, chunk, resultados, headless)))

    await asyncio.gather(*tasks)

    falhas = [p for p in protocolos if p not in resultados]
    if falhas:
        log(f"  ⚠ {len(falhas)} protocolos falharam")

    return resultados


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────

async def executar_coleta_specs(
    processos: List[str],
    pasta: Path,
    headless: bool = True,
    num_workers: int = 40,
    use_tor: bool = False,
    cpu_limit: int = CPU_LIMIT,
    max_specs: int = 0,
) -> Dict:
    """
    Busca fichas completas com specs expandidas para uma lista de processos.
    Salva em specs/specs-completas.json e enriquece fonte-bruta.json.
    """
    pasta = Path(pasta)
    specs_dir = pasta / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)

    # Filtro de volume
    if max_specs > 0 and len(processos) > max_specs:
        log(f"  ⚠ Volume alto: {len(processos)} processos. Limitando a {max_specs}.")
        processos = processos[:max_specs]

    inicio = time.time()

    log(f"{'=' * 60}")
    log(f"FASE 3A — COLETA DE ESPECIFICAÇÕES")
    log(f"Protocolos: {len(processos)} | Workers: {num_workers} | Tor: {use_tor}")
    log(f"{'=' * 60}\n")

    tor = None
    if use_tor:
        tor = TorManager(base_port=TOR_SOCKS_PORT, num_ports=min(num_workers, 20), data_dir=TOR_DATA_DIR)
        if not tor.start():
            log("Tor falhou. Caindo pro modo legado (sem Tor, max 6 workers).")
            use_tor = False
            num_workers = min(num_workers, 6)

    try:
        if use_tor and tor:
            resultados = await coletar_fichas_adaptivo(
                processos, num_workers, tor, headless, cpu_limit
            )
        else:
            resultados = await coletar_fichas_legado(
                processos, min(num_workers, 6), headless
            )
    finally:
        if tor:
            tor.stop()

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
                if ficha.get("classe") is not None:
                    fonte_bruta[proto]["classe"] = ficha["classe"]
                    if fonte_bruta[proto].get("classe_desconhecida"):
                        del fonte_bruta[proto]["classe_desconhecida"]
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
        "modo": "tor" if use_tor else "legado",
        "total_solicitados": len(processos),
        "total_coletados": len(resultados),
        "total_falhas": len(falhas),
        "falhas": falhas[:50],
        "workers": num_workers,
        "cpu_limit": cpu_limit,
        "duracao_segundos": round(fim - inicio, 1),
        "inicio": agora_iso(),
    }

    metadados_path = specs_dir / "specs-metadados.json"
    with open(metadados_path, "w", encoding="utf-8") as f:
        json.dump(metadados, f, ensure_ascii=False, indent=2)

    log(f"\n{'=' * 60}")
    log(f"RESUMO FASE 3A")
    log(f"{'=' * 60}")
    log(f"  Coletados: {len(resultados)}/{len(processos)}")
    log(f"  Falhas: {len(falhas)}")
    log(f"  Duração: {metadados['duracao_segundos']}s")
    log(f"  Modo: {metadados['modo']}")

    return metadados


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fase 3A — Coleta de especificações completas do INPI (com Tor opcional)",
    )
    parser.add_argument("--input", help="Caminho do JSON com lista de processos")
    parser.add_argument(
        "--campo", default="processos",
        help="Campo do JSON com a lista (default: processos)",
    )
    parser.add_argument("--processos", help="Lista direta de processos (vírgula)")
    parser.add_argument("--pasta", required=True, help="Pasta do caso")
    parser.add_argument("--workers", type=int, default=6, help="Workers paralelos (default: 6, com Tor: até 40)")
    parser.add_argument("--tor", action="store_true", help="Usar Tor para IPs rotativos")
    parser.add_argument("--cpu-limit", type=int, default=CPU_LIMIT, help=f"CPU max %% (default: {CPU_LIMIT})")
    parser.add_argument("--max-specs", type=int, default=0, help="Limite de specs (0 = sem limite)")
    parser.add_argument("--visible", action="store_true", help="Mostrar browsers")

    args = parser.parse_args()

    processos = []
    if args.processos:
        processos = [p.strip() for p in args.processos.split(",") if p.strip()]
    elif args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        campos = [c.strip() for c in args.campo.split(",")]
        for campo in campos:
            if isinstance(data.get(campo), list):
                processos.extend(data[campo])
            elif isinstance(data.get(campo), dict):
                for sub in data[campo].values():
                    if isinstance(sub, list):
                        processos.extend(sub)
    else:
        print("Erro: forneça --input ou --processos")
        sys.exit(1)

    if not processos:
        print("Nenhum processo para buscar.")
        sys.exit(0)

    # Deduplicar
    vistos = set()
    processos_unicos = []
    for p in processos:
        p_str = str(p)
        if p_str not in vistos:
            vistos.add(p_str)
            processos_unicos.append(p_str)

    # Se Tor, permitir mais workers
    if args.tor and args.workers <= 6:
        args.workers = 40
        log(f"  Tor ativo: workers auto-ajustados para {args.workers}")

    resultado = asyncio.run(
        executar_coleta_specs(
            processos=processos_unicos,
            pasta=Path(args.pasta),
            headless=not args.visible,
            num_workers=args.workers,
            use_tor=args.tor,
            cpu_limit=args.cpu_limit,
            max_specs=args.max_specs,
        )
    )

    sys.exit(0 if resultado["total_falhas"] == 0 else 1)


if __name__ == "__main__":
    main()
