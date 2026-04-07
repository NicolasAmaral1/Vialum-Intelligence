# OpenClaw - Documentacao Completa

> Relatorio de pesquisa aprofundada sobre o OpenClaw, o agente AI pessoal open-source que se tornou o projeto mais estrelado do GitHub.
> Data: 2026-03-23

---

## Indice

1. [Historia e Origem](#1-historia-e-origem)
2. [O Que e o OpenClaw](#2-o-que-e-o-openclaw)
3. [Arquitetura Tecnica](#3-arquitetura-tecnica)
4. [Sistema de Skills](#4-sistema-de-skills)
5. [ClawHub - Registry de Skills](#5-clawhub---registry-de-skills)
6. [Sistema de Agentes](#6-sistema-de-agentes)
7. [Integracoes (Canais de Comunicacao)](#7-integracoes-canais-de-comunicacao)
8. [MCP (Model Context Protocol) Support](#8-mcp-model-context-protocol-support)
9. [Modelos LLM Suportados](#9-modelos-llm-suportados)
10. [Sistema de Memoria e Contexto](#10-sistema-de-memoria-e-contexto)
11. [Automacao e Workflows](#11-automacao-e-workflows)
12. [Como Roda (Local, Docker, Cloud)](#12-como-roda-local-docker-cloud)
13. [Seguranca e Sandbox](#13-seguranca-e-sandbox)
14. [API e Extensibilidade](#14-api-e-extensibilidade)
15. [Comunidade e Ecossistema](#15-comunidade-e-ecossistema)
16. [Numeros e Estatisticas](#16-numeros-e-estatisticas)
17. [Fontes](#17-fontes)

---

## 1. Historia e Origem

### O Criador: Peter Steinberger

Peter Steinberger e um empreendedor austriaco, fundador da PSPDFKit (cujo software foi instalado em mais de 1 bilhao de dispositivos). Conhecido como "vibe coder", ele construiu o prototipo inicial do que viria a ser o OpenClaw em apenas uma hora.

### Linha do Tempo

| Data | Evento |
|------|--------|
| **Nov 2025** | Steinberger publica o **Clawdbot** como open-source no GitHub. O nome era uma referencia ao Claude da Anthropic. Em poucos dias, o repositorio explodiu em popularidade. |
| **Jan 27, 2026** | Renomeado para **Moltbot** (mantendo a tematica de lagosta/lobster) apos queixas de trademark da Anthropic. |
| **Jan 30, 2026** | Renomeado para **OpenClaw** - apenas 3 dias depois - porque Steinberger achou que "Moltbot nunca soou bem". |
| **Fev 2026** | Ultrapassa 100.000 stars no GitHub. Em 72 horas, ganhou 60K stars. Em 2 semanas apos o lancamento de janeiro, atingiu 190K stars. |
| **Fev 14, 2026** | Steinberger anuncia que vai para a OpenAI. O projeto e transferido para uma **fundacao independente 501(c)(3)**, mantendo licenca MIT e governanca comunitaria. |
| **Mar 3, 2026** | Ultrapassa **250.000 stars**, superando o React como projeto de software mais estrelado do GitHub. |
| **Mar 23, 2026** | Atualmente com **333.000+ stars** e **64.800+ forks**. |

### A Fundacao OpenClaw

- Estrutura: 501(c)(3) independente
- Licenca: MIT (mantida)
- A OpenAI patrocina o projeto mas **nao possui o codigo**
- Outros patrocinadores: Vercel, Blacksmith, Convex
- Governanca comunitaria com 900+ contribuidores ativos

---

## 2. O Que e o OpenClaw

OpenClaw e um **agente AI pessoal** que roda localmente nos seus dispositivos. Diferente de chatbots tradicionais, ele:

- **Executa acoes reais** no seu computador (arquivos, APIs, emails, shell commands)
- **Lembra contexto** entre conversas (memoria persistente)
- **Conecta com 20+ plataformas** de mensageria (WhatsApp, Telegram, Slack, Discord, iMessage, etc.)
- **Roda 24/7** como daemon no seu sistema
- **E single-user** - um assistente pessoal, nao um servico multi-tenant

Slogan oficial: *"Your own personal AI assistant. Any OS. Any Platform. The lobster way."*

A Nvidia comparou o OpenClaw como sendo "para AI agentica o que o GPT foi para chatbots".

---

## 3. Arquitetura Tecnica

### Gateway Model (Nucleo)

O coracao do OpenClaw e o **Gateway** - um control plane baseado em WebSocket que conecta todos os componentes:

```
Gateway (ws://127.0.0.1:18789)
    |
    +-- Pi Agent Runtime (RPC mode com tool/block streaming)
    +-- CLI surface (comandos `openclaw`)
    +-- WebChat UI
    +-- Companion Apps (macOS, iOS, Android)
    +-- Canais de mensageria (WhatsApp, Telegram, Slack, etc.)
```

O Gateway e o **unico control plane** para sessoes, canais, ferramentas e eventos.

### Componentes Principais

| Componente | Funcao |
|------------|--------|
| **Gateway** | WebSocket server, roteamento de canais, gerenciamento de sessoes |
| **Agent Runtime** | Execucao do modelo LLM, processamento de ferramentas |
| **Skills Engine** | Carregamento e filtragem de skills por sessao |
| **Memory System** | 4 camadas de memoria persistente |
| **Plugin System** | Extensoes TypeScript/JavaScript no processo do Gateway |
| **Channel Adapters** | Conectores para cada plataforma de mensageria |
| **Companion Apps** | Apps nativos para macOS, iOS, Android |

### Multi-Channel Routing

O Gateway roteia mensagens de diferentes canais/contas/peers para **agentes isolados**, cada um com seu workspace e sessoes independentes.

### Tecnologias

- **Runtime**: Node.js (v24 ou v22.16+)
- **Linguagem**: TypeScript
- **Package Manager**: pnpm
- **Build**: Monorepo com pnpm workspaces
- **Commits**: 21.695+ no repositorio principal

---

## 4. Sistema de Skills

### O Que Sao Skills

Skills sao **pastas de instrucoes em linguagem natural** que ensinam o OpenClaw a usar ferramentas. Cada skill e um diretorio contendo:

- **SKILL.md** - Arquivo principal com YAML frontmatter + instrucoes
- Configs, scripts ou arquivos de suporte opcionais
- Metadata: tags, resumo, requisitos de instalacao

### Como Skills Sao Carregadas

1. O OpenClaw carrega skills bundled + overrides locais
2. **Filtragem no load time** baseada em ambiente, config e binarios presentes
3. **Snapshot** de skills elegiveis no inicio da sessao (reutilizado em turnos subsequentes)
4. Mudancas so tomam efeito na **proxima sessao**

### Precedencia de Skills

```
Workspace skills (~/<workspace>/skills)     -> MAIOR prioridade
User skills (~/.openclaw/skills)            -> Media
Bundled skills (instaladas com OpenClaw)    -> MENOR prioridade
```

Se um nome conflitar, a skill de maior precedencia vence.

### Injecao no Prompt

O OpenClaw **NAO injeta o texto completo** de todas as skills no system prompt. Em vez disso:

1. Injeta uma **lista compacta em XML** com nomes, descricoes e caminhos
2. O modelo le essa lista e, quando decide que uma skill e relevante, **le o SKILL.md sob demanda**
3. Isso economiza tokens e permite escalar para centenas de skills

### Skills First-Class (Built-in)

- **Browser** - Controle de Chrome/Chromium via CDP
- **Canvas** - Interface visual A2UI (agent-driven)
- **Nodes** - Controle de dispositivos (macOS, iOS, Android)
- **Cron** - Agendamento de tarefas
- **Sessions** - Comunicacao entre sessoes/agentes
- **Discord/Slack Actions** - Acoes nativas nos canais

### Escala

O registro publico ClawHub hospeda **13.729+ skills** da comunidade (fev 2026). O repositorio awesome-openclaw-skills lista **5.400+ skills** filtradas e categorizadas.

---

## 5. ClawHub - Registry de Skills

### O Que E

ClawHub e o **registro publico de skills** do OpenClaw - funciona como o npm para bibliotecas JavaScript, mas distribuindo skills de agentes AI.

- Site: https://clawhub.ai/
- GitHub: https://github.com/openclaw/clawhub

### Funcionalidades

| Feature | Descricao |
|---------|-----------|
| **Busca Semantica** | Powered by embeddings (busca vetorial), nao apenas keywords |
| **Versionamento** | Semver, changelogs, tags (incluindo `latest`) |
| **Publicacao** | Conta GitHub com 1+ semana de idade necessaria |
| **Moderacao** | Skills com 3+ reports sao auto-ocultadas |
| **Analise de Seguranca** | Scan automatizado em cada skill publicada |
| **Flags de Risco** | Mostra requests de rede, escritas em filesystem, manipulacao de credenciais |
| **CLI Integration** | `openclaw` CLI para buscar, instalar e gerenciar skills |

### Numeros

- **13.729+** skills publicadas (fev 2026)
- **5.400+** skills curadas no awesome-openclaw-skills

---

## 6. Sistema de Agentes

### Single Agent vs Multi-Agent

O OpenClaw suporta rodar **multiplos agentes** dentro de um unico Gateway, cada um com:

- **Identidade propria**
- **Workspace isolado** (ex: `~/.openclaw/workspace-personal`, `~/.openclaw/workspace-family`)
- **Memoria independente**
- **Channel bindings** separados
- **Sandbox mode** e restricoes de ferramentas por agente

### Estrutura de Configuracao

```
~/.openclaw/
    agents/
        <agentId>/
            sessions/        # Historico de chat e estado de roteamento
            config/          # Auth profiles, model registry, per-agent config
    workspace-personal/      # Workspace do agente pessoal
    workspace-family/        # Workspace do agente familiar
```

### Arquivos de Configuracao por Agente

- **AGENTS.md** - Definicao de agentes e suas capacidades
- **SOUL.md** - Personalidade e regras do agente
- **USER.md** - Informacoes sobre o usuario

### Comunicacao Inter-Agentes

| Ferramenta | Funcao |
|------------|--------|
| `sessions_list` | Descobrir sessoes ativas |
| `sessions_history` | Buscar transcricoes de outras sessoes |
| `sessions_send` | Enviar mensagem para outra sessao (com reply-back opcional) |

### Isolamento de Seguranca

- Agentes nao-confiaveis podem ter **ferramentas restritas**
- **Sandbox** por agente (enquanto outros rodam no host)
- **Permissoes diferentes** por agente
- Acesso concorrente a arquivos com **locks** (sinal "resource busy" em vez de sobrescrever)

---

## 7. Integracoes (Canais de Comunicacao)

### 20+ Plataformas Suportadas

| Canal | Tecnologia |
|-------|-----------|
| **WhatsApp** | Baileys |
| **Telegram** | grammY |
| **Slack** | Bolt |
| **Discord** | discord.js |
| **Google Chat** | API nativa |
| **Signal** | Protocolo Signal |
| **iMessage** | BlueBubbles (preferido) |
| **IRC** | Cliente IRC |
| **Microsoft Teams** | API Teams |
| **Matrix** | Protocolo Matrix |
| **Feishu** | API Feishu |
| **LINE** | API LINE |
| **Mattermost** | API Mattermost |
| **Nextcloud Talk** | API Nextcloud |
| **Nostr** | Protocolo Nostr |
| **Synology Chat** | API Synology |
| **Tlon** | API Tlon |
| **Twitch** | API Twitch |
| **Zalo** | Variantes Zalo |
| **WebChat** | Interface web built-in |

### Comandos de Chat Universais

Funcionam em WhatsApp, Telegram, Slack, Google Chat, Teams e WebChat:

- `/status` - Info da sessao (modelo, tokens, custo)
- `/new`, `/reset` - Reiniciar sessao
- `/think <level>` - off/minimal/low/medium/high/xhigh
- `/verbose on|off`
- `/usage off|tokens|full` - Tracking de custos no footer
- `/activation mention|always` - Toggle de roteamento em grupos

### Politica de DM

- **`dmPolicy="pairing"`** (padrao): Remetentes desconhecidos recebem codigos de pareamento; aprovacao via `openclaw pairing approve`
- **`dmPolicy="open"`**: Requer opt-in explicito com `"*"` na allowlist

### Voz e Audio

- **Wake words** no macOS/iOS
- **Voz continua** no Android
- **ElevenLabs** + system TTS fallback
- **Talk Mode overlay**
- Hooks de transcricao com controles de media pipeline

---

## 8. MCP (Model Context Protocol) Support

### Integracao Nativa

O OpenClaw suporta **MCP servers nativos**, permitindo que agentes se conectem a servidores MCP e usem suas ferramentas diretamente.

### Configuracao

```json
// ~/.openclaw/mcp.json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### Caracteristicas

- **Per-agent MCP**: Cada agente pode ter servidores MCP diferentes configurados
- **Tools by name**: Ferramentas MCP sao chamadas pelo nome, sem etapas extras de busca/execucao
- **Custom MCP Servers**: Desenvolva em TypeScript usando `@modelcontextprotocol/sdk`
- **Validacao**: Schema de input com Zod validation
- **OpenClaw MCP Bridge**: Orquestrar multiplos gateways OpenClaw de um unico servidor MCP

### OpenClaw como MCP Server

O projeto `openclaw-mcp` permite que ferramentas como Claude.ai se conectem ao seu OpenClaw self-hosted via OAuth2:

- `AUTH_ENABLED`, `MCP_CLIENT_ID`, `MCP_CLIENT_SECRET`
- Bridge seguro entre Claude.ai e seu assistente OpenClaw

### Integracoes MCP da Comunidade

Via Composio e outros marketplaces:
- Browser Tool MCP
- Make MCP
- Cursor MCP
- Agent Mail MCP
- MCP360
- E dezenas de outros

---

## 9. Modelos LLM Suportados

### 12 Providers Oficiais

| Provider | Modelos Destaque |
|----------|-----------------|
| **Anthropic** | Claude Sonnet 4.5, etc. |
| **OpenAI** | GPT-5.1 Codex, GPT-5.4, etc. |
| **Google** | Gemini 3.1, etc. |
| **Ollama** | Modelos locais (auto-detectado em `127.0.0.1:11434`) |
| **OpenRouter** | Gateway para dezenas de providers (Claude, GPT, Gemini, Llama, Mistral, DeepSeek, etc.) |
| **Amazon Bedrock** | Modelos via AWS |
| **Vercel AI Gateway** | Roteamento via Vercel |
| **GitHub Copilot** | Com Claude-thinking transcript hints |
| **Moonshot AI** | Modelos Moonshot |
| **MiniMax** | Modelos MiniMax |
| **GLM Models** | Modelos GLM |
| **Z.AI / Synthetic** | Outros providers |

### Model Failover

- **Profile rotation** com fallback chains
- Se um modelo falha, automaticamente tenta o proximo na cadeia
- Config via CLI: `openclaw update --channel stable|beta|dev`

### Autenticacao

- OAuth ou API key por provider
- Configuracao via CLI interativo

### Recomendacao Oficial

> "Para melhor experiencia e menor risco de prompt-injection, use o modelo mais forte e recente disponivel."

---

## 10. Sistema de Memoria e Contexto

### 4 Camadas de Memoria

| Camada | Local | Funcao |
|--------|-------|--------|
| **Session Context** | Em memoria | Conversa atual (contexto do modelo) |
| **Daily Notes** | `memory/YYYY-MM-DD.md` | Notas diarias persistentes |
| **Long-term Memory** | `MEMORY.md` | Memoria de longo prazo que sobrevive restarts |
| **Semantic Search** | Todos os arquivos | Busca semantica cross-file |

### Compaction (Compactacao)

Quando a conversa fica longa demais:

1. O OpenClaw detecta que `contextTokens > contextWindow - reserveTokens`
2. Dispara um **turno silencioso e agentico** (NO_REPLY convention)
3. O modelo escreve **memoria duravel** antes da compactacao
4. Mensagens antigas sao **resumidas** em uma unica entrada
5. Mensagens recentes permanecem intactas

### Memory Flush Automatico

- Trigger: `contextTokens > contextWindow - reserveTokensFloor - softThresholdTokens`
- O agente salva fatos criticos em disco **antes** que o contexto seja compactado
- Recomendacao: manter habilitado para nao perder informacoes

### Armazenamento

```
~/.openclaw/
    agents/
        <agentId>/
            sessions/    # Historico de chat e estado
            memory/      # MEMORY.md + daily notes
```

---

## 11. Automacao e Workflows

### Ferramentas de Automacao Built-in

| Ferramenta | Funcao |
|------------|--------|
| **Cron Jobs** | Agendamento de tarefas recorrentes |
| **Wakeup Scheduling** | Despertar o agente em horarios especificos |
| **Webhook Triggers** | Endpoints HTTP para eventos externos |
| **Gmail Pub/Sub** | Integracao nativa com Gmail |
| **Session Coordination** | Coordenacao entre sessoes via `sessions_*` tools |

### Casos de Uso de Negocios

- **Automacao de vendas**: Captura de leads de web forms, email e messaging, resposta em segundos
- **Onboarding de clientes**: Workflow completo de assinatura de contrato ate setup interno
- **E-commerce**: Processamento de pedidos, sync de inventario, recuperacao de carrinho abandonado
- **CRM**: Integracoes com sistemas de CRM
- **Trading quantitativo**: Skills da comunidade para trading
- **Agregacao de noticias**: Skills para monitoramento de noticias

### Caracteristicas Enterprise

- **RBAC** (Role-Based Access Control)
- **Audit trails**
- **HMAC** autenticacao
- **PCI DSS** compliance features
- **Dual-handle routing**
- **Variable management**

### Visual No-Code Builder

- Interface visual para construir workflows
- Suporte a **multiplos modelos AI por node** (GPT/Claude/Gemini por etapa)
- 9+ canais omnichannel

---

## 12. Como Roda (Local, Docker, Cloud)

### Opcao 1: Instalacao via npm (Recomendado)

```bash
# Requer Node.js 24 ou 22.16+
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

O `--install-daemon` configura o Gateway como servico do sistema:
- **macOS**: launchd
- **Linux**: systemd user service
- Resultado: OpenClaw **sempre rodando** em background

### Opcao 2: A Partir do Codigo Fonte

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install && pnpm ui:build && pnpm build
pnpm openclaw onboard --install-daemon
pnpm gateway:watch  # loop de desenvolvimento
```

### Opcao 3: Docker

```bash
# Usa docker-setup.sh + docker-compose.yml do repositorio
./docker-setup.sh
```

O script cria dois volumes montados:
- `~/.openclaw/` - Config, memoria, API keys
- `~/openclaw/workspace/` - Arquivos acessiveis ao agente

### Opcao 4: Cloud / VPS

Provedores com guias oficiais:
- **DigitalOcean** (App Platform com auto-scaling)
- **Contabo** (VPS barato)
- **Qualquer VPS** com Docker

### Acesso Remoto

- **Tailscale Serve** (tailnet-only) ou **Funnel** (publico) com auto-config
- **SSH tunnels** com auth por token/password
- Gateway faz bind em **loopback** por padrao; Tailscale gerencia exposicao

### Canais de Atualizacao

```bash
openclaw update --channel stable   # Releases tagadas (vYYYY.M.D)
openclaw update --channel beta     # Prereleases (vYYYY.M.D-beta.N)
openclaw update --channel dev      # Head of main
```

### Companion Apps

- **macOS**: Menu bar app, elevated bash toggle, system notifications
- **iOS**: Device pairing, Canvas, Voice Wake, camera access
- **Android**: Connect/Chat/Voice tabs, device commands (notificacoes, localizacao, SMS, fotos, contatos, calendario, motion, app updates)

---

## 13. Seguranca e Sandbox

### Modelo de Seguranca Multi-Camada

| Camada | Descricao |
|--------|-----------|
| **Sandbox** | Container isolado para execucao de comandos |
| **Tool Policy** | Allowlist/blocklist de ferramentas por agente |
| **Elevated Mode** | Bash privilegiado separado do TCC, toggle por sessao (`/elevated on|off`) |
| **DM Policy** | Pairing codes para remetentes desconhecidos |
| **TCC Permissions** | Mapeamento de permissoes macOS via `node.list`/`node.describe` |

### Riscos Conhecidos

- **Sem sandbox por padrao**: O agente roda com as permissoes do seu usuario
- **Acesso irrestrito**: Sem allowlist de comandos, sem requisitos de aprovacao out-of-the-box
- **Elevated escape hatch**: Tools flagged como elevated rodam no host mesmo com agente em sandbox
- **288 security advisories** ja endereacados

### Boas Praticas

- Usar sandboxing e isolamento de host para limites fortes
- Rodar `openclaw doctor` para detectar configs de DM arriscadas
- Para isolamento de usuarios hostis: separar trust boundaries por usuario/host do OS
- Rodar gateways separados para diferentes niveis de confianca

---

## 14. API e Extensibilidade

### 3 Tipos de Extensao

| Tipo | Descricao |
|------|-----------|
| **Skills** | Integracoes via linguagem natural (SKILL.md) |
| **Plugins** | Extensoes profundas do Gateway em TypeScript/JavaScript |
| **Webhooks** | Endpoints HTTP para sistemas externos fazerem POST |

### Plugin Architecture

- Plugins rodam **dentro do processo do Gateway** com acesso a APIs internas
- Interface: `OpenClawPluginApi` (padrao IoC - Inversion of Control)
- Plugins declaram capacidades registrando callbacks
- O runtime invoca os callbacks nos momentos apropriados

### Desenvolvimento de Plugins

```typescript
// index.ts
export function register(api: OpenClawPluginApi) {
  api.registerTool({
    name: "my-tool",
    description: "Does something useful",
    inputSchema: z.object({ param: z.string() }),
    execute: async (input) => {
      // logica aqui
    }
  });
}
```

- **Hot-reload** durante desenvolvimento
- **jiti runtime** para carregar TypeScript direto (sem build toolchain)
- **`openclaw/plugin-sdk`** alias mapping

### Comandos de Plugin

```bash
openclaw plugins install -l <path>   # Link local para dev
openclaw plugins enable <id>
openclaw plugins disable <id>
```

### Plugins Podem Fornecer

- Channel integrations (Telegram, Discord, Slack, etc.)
- Hooks e automacao event-driven
- Ferramentas customizadas
- Extensoes de runtime

---

## 15. Comunidade e Ecossistema

### Governanca

- **Fundacao 501(c)(3)** independente
- **4 equipes** de Community Staff no Discord, cada uma com um lead
- Leads reportam ao Admin
- Repositorio `openclaw/community` documenta como o Discord e gerenciado (open-source para transparencia)

### Patrocinadores Corporativos

- **OpenAI** (principal)
- **Vercel**
- **Blacksmith**
- **Convex**

### Ecossistema de Projetos

| Projeto | Descricao |
|---------|-----------|
| **ClawHub** | Registry de skills (13.729+ skills) |
| **openclaw-pm** | Project manager com heartbeat, memory flush, health checks |
| **Companion Apps** | macOS menu bar, iOS/Android nodes |
| **awesome-openclaw-skills** | 5.400+ skills curadas |
| **openclaw-mcp** | Bridge MCP para Claude.ai |
| **nix-openclaw** | Pacote Nix |
| **openclaw-agents** | One-command multi-agent setup (9 agentes especializados) |

### Canais da Comunidade

- **Discord**: Servidor principal da comunidade
- **GitHub Discussions**: Forum de features e bugs
- **5.000+ issues e PRs** no repositorio principal

---

## 16. Numeros e Estatisticas

| Metrica | Valor |
|---------|-------|
| **GitHub Stars** | 333.000+ (mar 2026) |
| **GitHub Forks** | 64.800+ |
| **Commits** | 21.695+ |
| **Contribuidores** | 900+ (1.000+ shipping code semanalmente) |
| **Issues/PRs** | 5.000+ |
| **Security Advisories** | 288 endereacados |
| **Skills no ClawHub** | 13.729+ |
| **Skills Curadas** | 5.400+ |
| **Usuarios Estimados** | 300.000 - 400.000 mundialmente |
| **Canais Suportados** | 20+ plataformas |
| **Providers LLM** | 12 oficiais |
| **Tempo para 250K stars** | ~60 dias (recorde absoluto do GitHub) |

### Marcos Historicos

- Superou o **React** (10 anos de existencia) como projeto mais estrelado do GitHub
- De 0 a 250K stars em 60 dias
- 60K stars em 72 horas em um unico pico
- Projeto open-source de crescimento mais rapido da historia do GitHub

---

## 17. Fontes

### Fontes Primarias
- [GitHub - openclaw/openclaw](https://github.com/openclaw/openclaw)
- [OpenClaw Docs - Skills](https://docs.openclaw.ai/tools/skills)
- [OpenClaw Docs - ClawHub](https://docs.openclaw.ai/tools/clawhub)
- [OpenClaw Docs - Memory](https://docs.openclaw.ai/concepts/memory)
- [OpenClaw Docs - Multi-Agent](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw Docs - Model Providers](https://docs.openclaw.ai/concepts/model-providers)
- [OpenClaw Docs - Docker](https://docs.openclaw.ai/install/docker)
- [OpenClaw Docs - Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Docs - Plugins](https://docs.openclaw.ai/tools/plugin)
- [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [ClawHub Registry](https://clawhub.ai/)

### Imprensa e Analises
- [KDnuggets - OpenClaw Explained](https://www.kdnuggets.com/openclaw-explained-the-free-ai-agent-tool-going-viral-already-in-2026)
- [SimilarLabs - 60K Stars in 72 Hours](https://similarlabs.com/blog/openclaw-ai-agent-trend-2026)
- [DigitalOcean - What is OpenClaw](https://www.digitalocean.com/resources/articles/what-is-openclaw)
- [Creati.ai - 145K Stars](https://creati.ai/ai-news/2026-02-11/openclaw-open-source-ai-agent-viral-145k-github-stars/)
- [Nvidia/NextPlatform - OpenClaw is to Agentic AI what GPT was to Chattybots](https://www.nextplatform.com/ai/2026/03/17/nvidia-says-openclaw-is-to-agentic-ai-what-gpt-was-to-chattybots/5209428)
- [The New Stack - GitHub Stars Security](https://thenewstack.io/openclaw-github-stars-security/)
- [CNBC - From Clawdbot to Moltbot to OpenClaw](https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html)
- [Pragmatic Engineer - The Creator of Clawd](https://newsletter.pragmaticengineer.com/p/the-creator-of-clawd-i-ship-code)
- [Taskade - History of ClawdBot & Moltbot](https://www.taskade.com/blog/moltbook-clawdbot-openclaw-history)
- [Auth0 - Securing OpenClaw](https://auth0.com/blog/five-step-guide-securing-moltbot-ai-agent/)
- [Nebius - Security Architecture](https://nebius.com/blog/posts/openclaw-security)

### Tutoriais e Guias
- [Hostinger - 25 Use Cases](https://www.hostinger.com/tutorials/openclaw-use-cases)
- [DigitalOcean - OpenClaw Skills Guide](https://www.digitalocean.com/resources/articles/what-are-openclaw-skills)
- [VelvetShark - Memory Masterclass](https://velvetshark.com/openclaw-memory-masterclass)
- [LumaDock - Memory Explained](https://lumadock.com/tutorials/openclaw-memory-explained)
- [LumaDock - Multi-Agent Setup](https://lumadock.com/tutorials/openclaw-multi-agent-setup)
- [Simon Willison - OpenClaw Docker](https://til.simonwillison.net/llms/openclaw-docker)
- [Haimaker - Best Models for OpenClaw](https://haimaker.ai/blog/best-models-for-clawdbot/)
- [Boilerplate Hub - Skills Guide](https://boilerplatehub.com/blog/openclaw-skills)
- [OpenClaw Book - Extension Architecture](https://www.openclawbook.xyz/en/ch13-channel-extension-mechanism/13.1-extension-architecture-design)

---

*Relatorio gerado em 2026-03-23 via pesquisa web abrangente.*

