# NemoClaw: Repositorios GitHub e Analise de Codigo

**Data:** 2026-03-24
**Fonte:** GitHub (pesquisa direta + topics + repos individuais)

---

## 1. Visao Geral do Ecossistema

NemoClaw e a camada de seguranca open-source da NVIDIA para executar agentes OpenClaw dentro do runtime sandboxed OpenShell. O ecossistema no GitHub ja possui **168+ repositorios** encontrados na busca por "nemoclaw", com o repo oficial acumulando **16k stars** em poucos dias desde o lancamento alpha (marco 2026).

---

## 2. Repositorio Oficial: NVIDIA/NemoClaw

**URL:** https://github.com/NVIDIA/NemoClaw
**Stars:** 16.000 | **Forks:** 1.700 | **Licenca:** Apache 2.0
**Status:** Alpha (lancamento 16/mar/2026) | **Contributors:** 34 | **Commits:** 331

### 2.1 Tech Stack

| Linguagem | Percentual |
|-----------|-----------|
| JavaScript | 41,1% |
| Shell | 28,8% |
| TypeScript | 16,4% |
| Python | 12,2% |
| Dockerfile | 1,3% |
| Makefile | 0,2% |

**Dependencias principais:** Node.js 20+, npm 10+, Docker, OpenShell runtime, Python (uv package manager)

### 2.2 Arquitetura de Diretorios

```
NVIDIA/NemoClaw/
├── .agents/skills/          # Skills dos agentes
├── .github/                 # CI/CD, issue templates
├── ISSUE_TEMPLATE/
├── bin/                     # Binarios/executaveis
├── ci/                      # Scripts de CI
├── docs/                    # Documentacao
├── nemoclaw-blueprint/      # Orquestracao Python
│   ├── migrations/          # Migracoes de config
│   ├── orchestrator/        # Motor de orquestracao
│   │   ├── __init__.py
│   │   ├── runner.py        # Runner principal
│   │   └── test_endpoint_validation.py
│   ├── policies/            # Politicas de seguranca
│   │   ├── openclaw-sandbox.yaml  # Politica base
│   │   └── presets/         # Presets prontos
│   │       ├── discord.yaml
│   │       ├── docker.yaml
│   │       ├── huggingface.yaml
│   │       ├── jira.yaml
│   │       ├── npm.yaml
│   │       ├── outlook.yaml
│   │       ├── pypi.yaml
│   │       ├── slack.yaml
│   │       └── telegram.yaml
│   ├── blueprint.yaml       # Config do blueprint
│   ├── pyproject.toml
│   ├── Makefile
│   └── uv.lock
├── nemoclaw/                # Plugin TypeScript
│   ├── src/
│   │   ├── commands/
│   │   │   ├── slash.ts           # Comandos slash
│   │   │   ├── slash.test.ts
│   │   │   ├── migration-state.ts # Estado de migracao
│   │   │   └── migration-state.test.ts
│   │   ├── blueprint/
│   │   │   ├── state.ts           # Estado do blueprint
│   │   │   └── state.test.ts
│   │   ├── onboard/
│   │   │   ├── config.ts          # Configuracao onboard
│   │   │   └── config.test.ts
│   │   └── index.ts               # Entry point
│   ├── openclaw.plugin.json  # Manifesto do plugin
│   ├── package.json
│   ├── tsconfig.json
│   └── eslint.config.mjs
├── scripts/                 # Scripts utilitarios
├── test/                    # Testes
├── install.sh               # Instalador
├── uninstall.sh             # Desinstalador
├── Dockerfile
├── Makefile
├── package.json
└── pyproject.toml
```

### 2.3 Arquitetura em 4 Camadas

| Camada | Tecnologia | Funcao |
|--------|-----------|--------|
| **Plugin** | TypeScript | CLI: launch, connect, status, logs |
| **Blueprint** | Python | Artefato versionado que gerencia sandbox, politica e inferencia |
| **Sandbox** | OpenShell | Container isolado com Landlock + seccomp + netns |
| **Inference** | NVIDIA API | Roteamento de modelo via gateway OpenShell |

**Ciclo de vida do Blueprint:**
1. Resolve artefato (registry OCI ou GitHub)
2. Verifica digest
3. Planeja recursos
4. Aplica via OpenShell CLI

### 2.4 Plugin Manifest (openclaw.plugin.json)

```json
{
  "id": "nemoclaw",
  "name": "NemoClaw",
  "version": "0.1.0",
  "description": "Migrate and run OpenClaw inside OpenShell with optional NIM-backed inference",
  "configSchema": {
    "properties": {
      "blueprintVersion": { "default": "latest" },
      "blueprintRegistry": { "default": "ghcr.io/nvidia/nemoclaw-blueprint" },
      "sandboxName": { "default": "openclaw" },
      "inferenceProvider": { "default": "nvidia" }
    }
  }
}
```

### 2.5 Blueprint Configuration (blueprint.yaml)

Define 4 perfis de inferencia:

| Perfil | Provider | Modelo | Endpoint |
|--------|----------|--------|----------|
| **default** | NVIDIA | nemotron-3-super-120b-a12b | integrate.api.nvidia.com |
| **ncp** | NVIDIA | nemotron-3-super-120b-a12b | Dinamico |
| **nim-local** | OpenAI-compat | nemotron-3-super-120b-a12b | nim-service.local:8000 |
| **vllm** | OpenAI-compat | nemotron-3-nano-30b-a3b | localhost:8000 |

Imagem sandbox: `ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest`
Versao minima OpenShell: 0.1.0 | OpenClaw: 2026.3.0

### 2.6 Politica de Seguranca Base (openclaw-sandbox.yaml)

**Principio:** Deny-by-default. Permite apenas o estritamente necessario.

**Filesystem:**
- Read-only: `/usr`, `/lib`, `/proc`, `/app`, `/etc`, `/var/log`, `/sandbox/.openclaw`
- Read-write: `/sandbox`, `/tmp`, `/dev/null`, `/sandbox/.openclaw-data`
- Landlock: best_effort
- Processo roda como user/group `sandbox`

**Network policies (10 grupos):**

| Grupo | Hosts permitidos | Binarios autorizados |
|-------|-----------------|---------------------|
| claude_code | api.anthropic.com, statsig.anthropic.com, sentry.io | `/usr/local/bin/claude` |
| nvidia | integrate.api.nvidia.com, inference-api.nvidia.com | claude, openclaw |
| github | github.com, api.github.com | gh, git |
| clawhub | clawhub.com (GET+POST) | openclaw |
| openclaw_api | openclaw.ai (GET+POST) | openclaw |
| openclaw_docs | docs.openclaw.ai (GET only) | openclaw |
| npm_registry | registry.npmjs.org | openclaw, npm |
| telegram | api.telegram.org (/bot*/**) | - |
| discord | discord.com, gateway.discord.gg, cdn.discordapp.com | - |

**Mecanismo de aprovacao:** Quando o agente tenta acessar um endpoint nao listado, o OpenShell bloqueia e exibe no TUI para aprovacao/negacao pelo operador em tempo real.

**Recarga dinamica:** Politicas de rede e inferencia podem ser atualizadas sem restart (hot-reload). Politicas de filesystem e processo sao travadas na criacao.

### 2.7 Presets Oficiais (9 presets)

discord, docker, huggingface, jira, npm, outlook, pypi, slack, telegram

### 2.8 CLI - Comandos Principais

**Instalacao:**
```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
```

**Host:**
- `nemoclaw onboard` - Wizard interativo de setup
- `nemoclaw <name> connect` - Entrar no shell do sandbox
- `openshell term` - TUI de monitoramento/aprovacoes
- `nemoclaw start/stop/status` - Gerenciar servicos

**Dentro do sandbox:**
- `openclaw tui` - Chat interativo
- `openclaw agent --agent main --local -m "mensagem"` - Mensagem unica via CLI

### 2.9 Requisitos de Hardware

| Spec | Minimo | Recomendado |
|------|--------|-------------|
| CPU | 4 vCPU | 4+ vCPU |
| RAM | 8 GB | 16 GB |
| Disco | 20 GB | 40 GB |
| Imagem sandbox | ~2,4 GB comprimida | - |

### 2.10 Camadas de Protecao

| Camada | Protecao | Hot-reload? |
|--------|----------|-------------|
| Network | Bloqueia egress nao autorizado | Sim |
| Filesystem | Restringe a /sandbox, /tmp | Nao (travado na criacao) |
| Process | Impede escalacao de privilegios, syscalls perigosas | Nao |
| Inference | Roteia chamadas de modelo para backends controlados | Sim |

---

## 3. Repositorios do Ecossistema

### 3.1 nvidia-nemoclaw/NemoClaw (Installer Multiplataforma)

**URL:** https://github.com/nvidia-nemoclaw/NemoClaw
**Stars:** 51 | **Forks:** 9 | **Licenca:** MIT | **Linguagem:** Python 100%

**O que faz:** Installer 1-click para Windows/macOS que combina OpenClaw + NemoClaw com emulacao transparente de GPU para AMD/Intel.

**Estrutura:**
```
├── assets/
├── utils/
├── README.md
└── LICENSE
```

**Diferenciais:**
- Instalador .exe (Windows) e .dmg (macOS)
- Emulacao GPU via ZLUDA/SYCL/Vulkan para AMD/Intel
- Modelo Nemotron 3 Super 120B pre-instalado (4-bit GGUF/AWQ)
- Requisito: 24-80 GB de memoria unificada
- Fallback automatico para CPU se VRAM insuficiente

**Comando especial:** `nemoclaw deploy <instance>` para deployment em GPU remota

**Maturidade:** Baixa (14 commits), mas funcional para onboarding simplificado.

**Aplicabilidade:** Util para equipes que querem testar NemoClaw sem Linux nativo.

---

### 3.2 VoltAgent/awesome-nemoclaw (Presets e Recipes)

**URL:** https://github.com/VoltAgent/awesome-nemoclaw
**Stars:** 20 | **Forks:** 6 | **Licenca:** MIT

**O que faz:** Colecao curada de presets, recipes e playbooks para operacoes NemoClaw.

**Presets da comunidade (19 adicionais):**
gitlab, notion, linear, confluence, teams, zendesk, sentry, stripe, cloudflare, google-workspace, aws, gcp, vercel, supabase, neon, algolia, airtable, hubspot

**Recipes disponiveis:**
- Workflow de agente web com aprovacao previa
- Monitoramento de sandbox
- Deploy de assistente em GPU remota
- Integracao com bot Telegram
- Troca de modelo em runtime

**Templates:**
- Politica baseline de sandbox
- Estrutura de build de container
- Scripts de bootstrap de servico

**Maturidade:** Baixa (5 commits), mas conteudo curado e pratico.

**Aplicabilidade para negocios:** Muito alta. Os presets de Slack, Jira, HubSpot, Stripe e Google Workspace sao diretamente utilizaveis em automacao empresarial.

---

### 3.3 brooks376/NemoClaw-AI-Agent-Platform

**URL:** https://github.com/brooks376/NemoClaw-AI-Agent-Platform
**Stars:** 14 | **Forks:** 6 | **Licenca:** Apache 2.0

**O que faz:** Implementacao conceitual de uma plataforma enterprise de orquestracao de agentes IA inspirada no NemoClaw. NAO e projeto oficial NVIDIA.

**Arquitetura em 6 camadas:**
1. Control Plane (registro de agentes, tarefas, politicas)
2. Agent Runtime (loops de planejamento e acao)
3. Tool Gateway (conexao com APIs, DBs, CRM)
4. Policy Engine (permissoes, budgets, rate limits)
5. Memory/Context (estado, traces, historico)
6. Observability (logs, audit)

**Tech stack:** Python, FastAPI/Uvicorn

**Principios:** Default-deny, aprovacao humana para acoes sensiveis, audit trails completos.

**Aplicabilidade:** Referencia arquitetural interessante para quem quer construir plataforma similar.

---

### 3.4 Jovancoding/Network-AI (Orquestrador Multi-Agente)

**URL:** https://github.com/Jovancoding/Network-AI
**Stars:** 28 | **Forks:** 10 | **Licenca:** MIT | **Linguagem:** TypeScript

**O que faz:** Camada de coordenacao para sistemas multi-agente com estado compartilhado atomico, guardrails e adaptadores para 17 frameworks.

**Como usa NemoClaw:** Possui adaptador nativo para NemoClaw e exemplo de "sandbox swarm" com 3 agentes rodando em sandboxes NemoClaw isolados com politicas deny-by-default.

**Features principais:**
- LockedBlackboard: estado compartilhado com mutex em filesystem (sem race conditions)
- AuthGuardian: tokens de permissao HMAC/Ed25519
- FederatedBudget: teto de gastos por agente
- Audit log append-only assinado
- 17 adaptadores: LangChain, AutoGen, CrewAI, OpenAI, OpenClaw, NemoClaw, etc.
- 1.684 testes passando

**Maturidade:** Alta (v4.11.2, testes extensivos).

**Aplicabilidade:** Excelente para orquestracao multi-agente com controle de custos e seguranca. Complementa NemoClaw com camada de coordenacao.

---

### 3.5 X-Scale-AI/grits-audit (Scanner de Seguranca)

**URL:** https://github.com/X-Scale-AI/grits-audit
**Stars:** 5 | **Forks:** 1 | **Licenca:** Apache 2.0 | **Linguagem:** Python

**O que faz:** Scanner e auto-fixer de seguranca para configuracoes OpenClaw e NemoClaw. Aborda o problema de que "70% dos deploys de agentes IA saem com acesso irrestrito a API keys, filesystem e rede local".

**Modelo Zero-Trust em 5 camadas:**

| Camada | Foco | Ameaca |
|--------|------|--------|
| Network | Exposicao LAN/VPC | Egress irrestrito |
| Operator | Limites de identidade | Trust boundaries ausentes |
| Application | Politicas de tools/plugins | Permissividade excessiva |
| OS & Secrets | Credenciais em texto plano | Leakage em openclaw.json |
| Financial | Uso de API sem throttling | Cost bleed |

**Fluxo:** Scan -> Snapshot completo -> Patch seguro -> Re-scan -> Relatorio

**Integracao CI/CD:** GitHub Actions, GitLab CI. Gera relatorios JSON e SARIF.

**Zero dependencias externas** (apenas stdlib Python 3).

**Aplicabilidade:** Essencial para qualquer deploy em producao de NemoClaw.

---

### 3.6 thenewguardai/tng-nemoclaw-quickstart

**URL:** https://github.com/thenewguardai/tng-nemoclaw-quickstart
**Stars:** 5 | **Forks:** 2 | **Licenca:** Apache 2.0 | **Linguagem:** Shell 85,8%, Python 14,2%

**O que faz:** Kit de inicio rapido para deploy de agente seguro com NemoClaw em menos de 30 minutos.

**Templates de politica inclusos:**
- **Base lockdown** (restricao maxima)
- **HIPAA** (saude)
- **SOC 2** (financeiro)
- **Attorney-client privilege** (juridico)
- **Permissive dev** (desenvolvimento)

**Stack de monitoramento:** Loki + Promtail + Grafana

**Nota importante:** Documenta bug no NemoClaw v0.0.7 que forca flags GPU no WSL2, causando falhas de sandbox. Inclui patches.

**Aplicabilidade:** Otimo ponto de partida para quem quer testar NemoClaw rapidamente, especialmente os templates de compliance.

---

### 3.7 jetsonhacks/NemoClaw-Orin (Edge/IoT)

**URL:** https://github.com/jetsonhacks/NemoClaw-Orin
**Stars:** 3 | **Forks:** 0 | **Licenca:** MIT | **Linguagem:** Shell

**O que faz:** Scripts para deploy de NemoClaw em hardware NVIDIA Jetson Orin, resolvendo problemas de compatibilidade especificos.

**Problemas resolvidos:**
- Compatibilidade iptables-legacy (kernel Jetson)
- Persistencia de segredos SSH handshake (bug upstream OpenShell)
- Instalacao CLI adaptada para glibc 2.35

**Aplicabilidade:** Nicho - para edge computing com agentes IA em hardware embarcado.

---

### 3.8 ac12644/nemoclaw-hub (Dashboard Web)

**URL:** https://github.com/ac12644/nemoclaw-hub
**Stars:** 1 | **Forks:** 0 | **Licenca:** Apache 2.0 | **Linguagem:** TypeScript 99,6%

**O que faz:** Dashboard web para gerenciar multiplos agentes NemoClaw sandboxed.

**Stack:** React + Vite + Tailwind (frontend) | Fastify + TypeScript (backend) | SQLite | WebSocket

**Features:**
- Grid de agentes com status, modelo, provider, politicas
- Chat com agentes e historico de conversas
- Streaming de logs em tempo real via WebSocket
- Edicao e aplicacao de presets de politica de rede
- Audit trail com filtros (criacao/destruicao sandbox, mudancas de politica, mensagens)

**Maturidade:** Baixa (8 commits), mas funcional.

**Aplicabilidade:** Referencia interessante para UI de gerenciamento de agentes.

---

### 3.9 Rosary-mom/nemoclaw (Blockchain/Solana)

**URL:** https://github.com/Rosary-mom/nemoclaw
**Stars:** 1 | **Forks:** 3 | **Licenca:** MIT | **Linguagem:** TypeScript

**O que faz:** "Sistema operacional" para agentes IA na blockchain Solana. Cada iteracao do loop do agente e registrada como transacao on-chain para auditabilidade.

**Stack:** TypeScript, Solana, Anchor framework, Claude (Anthropic), protocolo x402 v2 para pagamentos

**Nota:** Usa o nome NemoClaw mas NAO e relacionado ao projeto NVIDIA. E um projeto independente de agentes verificaveis em blockchain.

---

### 3.10 Outros Repositorios Relevantes

| Repo | Stars | O que faz |
|------|-------|-----------|
| **adadrag/nemoclaw-dgx-spark** | 1 | Setup guide para DGX Spark com inferencia local e benchmarks Nemotron |
| **arkon-ai/arkon** | 1 | Control Plane de AI Ops para monitoramento e governanca de agentes |
| **razashariff/agentsign-openclaw** | 0 | Middleware zero-trust com identidade criptografica para tool calls |
| **erissatallan/OpenClaw-NemoClaw-Interactive-Graph** | 0 | Grafo de conhecimento mapeando ecossistema OpenClaw+NemoClaw |
| **Hmbown/NemoHermes** | 0 | Registry de capabilities NVIDIA com routing para Hermes Agent |
| **gignaati/gigaclaw** | 0 | Plataforma de agentes autonomos para India |
| **pandoraprompt/pandora-prompt** | 0 | Infra de IA privacy-first com agentes locais |
| **X-Scale-AI/openclaw-security** | 2 | Landing page redirecionando para grits-audit |

---

## 4. Analise do Ecossistema

### 4.1 Mapa de Maturidade

| Nivel | Repos |
|-------|-------|
| **Producao** | NVIDIA/NemoClaw (alpha oficial) |
| **Funcional** | Network-AI (v4.11.2), grits-audit (v0.3.0) |
| **Prototipo** | nvidia-nemoclaw installer, tng-quickstart, nemoclaw-hub |
| **Conceitual** | NemoClaw-AI-Agent-Platform, awesome-nemoclaw |
| **Experimental** | NemoClaw-Orin, repos menores |

### 4.2 Categorias do Ecossistema

| Categoria | Repos | Descricao |
|-----------|-------|-----------|
| **Core** | NVIDIA/NemoClaw | Runtime oficial |
| **Instalacao** | nvidia-nemoclaw installer, NemoClaw-Orin | Facilitam onboarding |
| **Seguranca** | grits-audit, openclaw-security | Auditoria e hardening |
| **Orquestracao** | Network-AI, NemoClaw-AI-Agent-Platform | Multi-agente e coordenacao |
| **UI/Dashboard** | nemoclaw-hub | Interface grafica |
| **Presets/Recipes** | awesome-nemoclaw | Configuracoes prontas |
| **Quickstart** | tng-nemoclaw-quickstart | Onboarding rapido |
| **Edge** | NemoClaw-Orin | Hardware embarcado |
| **Blockchain** | Rosary-mom/nemoclaw | Agentes verificaveis on-chain |

### 4.3 Padroes Observados

1. **Ecossistema nascente mas vibrante:** 168+ repos em menos de 2 semanas do lancamento alpha demonstra interesse massivo.

2. **Seguranca como diferencial:** NemoClaw atrai projetos focados em seguranca (grits-audit, openclaw-security), validando que o mercado reconhece a necessidade de sandbox para agentes.

3. **Multi-plataforma e uma dor:** O installer nvidia-nemoclaw e os patches do jetsonhacks mostram que rodar fora do Linux nativo ainda e trabalhoso.

4. **Compliance templates emergindo:** Os templates HIPAA, SOC 2 e attorney-client do tng-quickstart indicam demanda enterprise real.

5. **Integracao com ferramentas de negocio:** Os presets da comunidade (HubSpot, Stripe, Jira, Slack, Notion, etc.) mostram foco em automacao empresarial.

6. **Orquestracao multi-agente e o proximo passo:** Network-AI ja integra NemoClaw como runtime para swarms de agentes isolados.

### 4.4 Aplicabilidade para Negocios

**Alta relevancia para automacao empresarial:**
- Politicas de rede granulares permitem agentes com acesso controlado a APIs de negocio
- Presets prontos para Slack, Jira, HubSpot, Stripe, Google Workspace
- Templates de compliance para setores regulados
- Audit trails completos para governanca
- Dashboard web (nemoclaw-hub) como referencia para interfaces de gerenciamento

**Para a Vialum especificamente:**
- O modelo de politica deny-by-default com aprovacao em TUI alinha com workflows HITL
- Presets de integracao com APIs externas podem ser adaptados para automacoes INPI
- A arquitetura de blueprint versionado e util para deploys reproduziveis
- O scanner grits-audit seria essencial antes de qualquer deploy em producao

---

## 5. Resumo Tecnico

NemoClaw e um projeto solido da NVIDIA com arquitetura bem pensada em 4 camadas (Plugin TypeScript + Blueprint Python + Sandbox OpenShell + Inference). O codigo fonte e relativamente enxuto (~10 arquivos TypeScript no plugin, ~3 Python no orchestrator), mas o poder esta na integracao com OpenShell que faz o heavy lifting de isolamento via Landlock, seccomp e network namespaces.

O ecossistema no GitHub ja mostra sinais de saude: ferramentas de seguranca complementares, presets da comunidade para 28 servicos, adaptadores multi-framework, e quickstarts com templates de compliance. Para um projeto alpha com menos de 2 semanas, a adocao e impressionante.

