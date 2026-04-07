# Relatorio: 20+ Repositorios OpenClaw no GitHub

**Data:** 2026-03-23
**Objetivo:** Analise de repositorios que usam OpenClaw para projetos serios e bem construidos

---

## Contexto

OpenClaw (anteriormente Clawdbot/Moltbot) e um assistente pessoal de IA open-source criado por Peter Steinberger em novembro de 2025. Em marco de 2026, ja acumula 333k stars no GitHub -- superando React e Linux. O ecossistema inclui skills (13.700+ no ClawHub), plugins, integracao com 20+ canais de mensagem (WhatsApp, Telegram, Slack, Discord, etc.) e suporte a multiplos provedores de LLM.

---

## Repositorios Analisados

### 1. OpenClaw (Repo Principal)
- **URL:** https://github.com/openclaw/openclaw
- **Descricao:** O repositorio principal do OpenClaw -- assistente pessoal de IA que roda nos seus proprios dispositivos, com suporte a 20+ canais de mensagem, voz, Canvas visual e Gateway local.
- **Tech Stack:** TypeScript, Node.js 24+, pnpm, React (UI)
- **Stars/Forks:** 333k / 64.8k
- **Como usa OpenClaw:** E o core do projeto. Gateway WebSocket em localhost:18789, sistema de skills (bundled, managed, workspace), multi-agent routing, browser control via Chrome/Chromium, wake word detection.
- **Destaques:** Projeto open-source mais estrelado do GitHub em 2026. Arquitetura modular, seguranca por padrao (allowlist, DM pairing), suporte a Tailscale para acesso remoto.
- **Aplicabilidade business:** Base para qualquer automacao empresarial com IA. Pode ser o hub central de comunicacao, automacao de tarefas e integracao com ferramentas de negocio.

---

### 2. ClawHub (Registry de Skills)
- **URL:** https://github.com/openclaw/clawhub
- **Descricao:** Registry publico de skills para OpenClaw. Permite publicar, versionar e buscar skills baseados em texto (SKILL.md). Tambem cataloga plugins.
- **Tech Stack:** TypeScript (96.2%), TanStack Start (React/Vite/Nitro), Convex (database), OpenAI embeddings para busca semantica, GitHub OAuth
- **Stars/Forks:** 6.7k / 1.1k
- **Como usa OpenClaw:** E o marketplace oficial. Skills sao instalados via CLI (`openclaw skills install`). Busca semantica com embeddings. Moderacao e curadoria de skills.
- **Destaques:** 13.729 skills cadastrados. Busca vetorial semantica. API CLI-friendly. Analise de seguranca das declaracoes de skills.
- **Aplicabilidade business:** Essencial para descobrir e distribuir automacoes. Empresas podem publicar skills proprietarios ou consumir skills da comunidade.

---

### 3. HKUDS/ClawWork
- **URL:** https://github.com/HKUDS/ClawWork
- **Descricao:** Transforma o agente de IA em um "coworker" com responsabilidade economica. O agente comeca com $10 e precisa ganhar dinheiro completando tarefas profissionais reais em 44 setores, pagando por tokens consumidos.
- **Tech Stack:** Python 3.10+, nanobot framework, React (dashboard), E2B/BoxLite (sandbox), Tavily/Jina (web search), GPT-5.2 (avaliacao)
- **Stars/Forks:** 7.5k / 967
- **Como usa OpenClaw:** Usa o nanobot (versao lightweight do OpenClaw) com 9 canais + 4 ferramentas economicas (decide_activity, submit_work, learn, get_status). Cada resposta inclui footer de custo.
- **Destaques:** 220 tarefas GDP validation em 44 setores. Metricas de qualidade, eficiencia de custo e sustentabilidade economica. Arena multi-modelo com leaderboard.
- **Aplicabilidade business:** Framework para avaliar ROI real de agentes de IA. Util para empresas que querem medir se o agente gera mais valor do que consome.

---

### 4. HKUDS/nanobot
- **URL:** https://github.com/HKUDS/nanobot
- **Descricao:** Versao ultra-leve do OpenClaw -- 99% menos codigo, significativamente mais rapido. Projetado para ser limpo, legivel e facil de modificar para pesquisa.
- **Tech Stack:** Python, 11+ provedores LLM (Claude, GPT, DeepSeek, Qwen, Ollama, etc.), 12 plataformas de chat, MCP support, Docker
- **Stars/Forks:** 35.8k / 6.1k
- **Como usa OpenClaw:** Reimplementacao minimalista do core do OpenClaw. Agent loop, skills bundled, memoria persistente baseada em tokens, scheduling com cron.
- **Destaques:** Deploy com um clique. Suporte a encriptacao E2E (Matrix). Cache de prompts (Anthropic). Codigo limpo e extensivel.
- **Aplicabilidade business:** Ideal para empresas que querem um agente leve e rapido sem a complexidade do OpenClaw completo. Bom para VPS com recursos limitados.

---

### 5. Gen-Verse/OpenClaw-RL
- **URL:** https://github.com/Gen-Verse/OpenClaw-RL
- **Descricao:** Framework de reinforcement learning totalmente assincrono que treina agentes personalizados a partir de feedback em conversas naturais. Transforma interacoes do dia-a-dia em sinais de treinamento.
- **Tech Stack:** Python 3.12, CUDA 12.9, Slime (framework RL), Qwen3, Megatron-LM, LoRA, endpoints compativeis com OpenAI
- **Stars/Forks:** 4.1k / 399
- **Como usa OpenClaw:** Integra com OpenClaw para coletar trajetorias de conversas e treinar o modelo. Suporta Binary RL (GRPO), On-Policy Distillation e combinacao. Zero labeling manual.
- **Destaques:** Arquitetura completamente assincrona (serving, rollout, avaliacao, treinamento). Self-hosted e privado. Compativel com Tinker API para treino sem GPU.
- **Aplicabilidade business:** Para empresas que querem agentes que aprendem e melhoram com o uso. O agente se adapta ao estilo e preferencias da empresa ao longo do tempo.

---

### 6. grp06/openclaw-studio
- **URL:** https://github.com/grp06/openclaw-studio
- **Descricao:** Dashboard web limpo para OpenClaw. Conecta ao Gateway, visualiza agentes, chat em tempo real, gerencia aprovacoes e configura jobs.
- **Tech Stack:** Next.js, TypeScript (93.8%), SQLite (better-sqlite3), WebSocket, SSE, Playwright (testes), Vitest
- **Stars/Forks:** 1.8k / 270
- **Como usa OpenClaw:** Conecta via WebSocket ao Gateway do OpenClaw. Arquitetura "server-owned control-plane" com dois caminhos: browser-to-Studio (HTTP+SSE) e Studio-to-Gateway (WebSocket). Historico persistente em SQLite.
- **Destaques:** Interface moderna e clean. Streaming de eventos em tempo real. Workflow de aprovacao para acoes sensíveis.
- **Aplicabilidade business:** Interface de gerenciamento para equipes que usam OpenClaw. Permite controle visual sobre agentes, aprovacoes e historico de execucao.

---

### 7. dataelement/Clawith
- **URL:** https://github.com/dataelement/Clawith
- **Descricao:** "OpenClaw for Teams" -- plataforma de colaboracao multi-agente com identidades persistentes, memoria de longo prazo, e workspaces individuais.
- **Tech Stack:** Python (58.2%), TypeScript (36.8%), FastAPI, SQLAlchemy async, SQLite/PostgreSQL, Redis, JWT, MCP Client, React 19, Vite, Zustand, TanStack Query, Docker
- **Stars/Forks:** 2.2k / 325
- **Como usa OpenClaw:** Extende o OpenClaw para equipes. Sistema "Aware" com 6 tipos de triggers (cron, once, interval, poll, on_message, webhook). "The Plaza" como feed de conhecimento compartilhado. Agentes com org chart awareness e delegacao.
- **Destaques:** Multi-tenant RBAC. Quotas de uso por usuario. Workflows de aprovacao. Audit logs. Self-evolving -- agentes descobrem ferramentas em runtime via Smithery/ModelScope.
- **Aplicabilidade business:** Solucao enterprise para equipes que precisam de multiplos agentes colaborando. Perfeito para organizacoes com controle de acesso, auditoria e governanca.

---

### 8. abhi1693/openclaw-mission-control
- **URL:** https://github.com/abhi1693/openclaw-mission-control
- **Descricao:** Dashboard de orquestracao de agentes IA. Gerencia agentes, atribui tarefas e coordena colaboracao multi-agente via OpenClaw Gateway.
- **Tech Stack:** TypeScript (55.4%), Python (41.9%), Next.js/React, Docker Compose, autenticacao via bearer token ou Clerk JWT
- **Stars/Forks:** 3k / 651
- **Como usa OpenClaw:** Conecta ao OpenClaw Gateway para operacoes distribuidas. Orquestracao de trabalho com organizacoes, boards, tarefas e tags. Governanca com fluxos de aprovacao.
- **Destaques:** API-first. Suporte multi-equipe. Trilha de decisoes para auditoria. Modo containerizado ou local.
- **Aplicabilidade business:** Plataforma de operacoes para empresas que rodam multiplos agentes. Gerenciamento centralizado com governanca e aprovacoes.

---

### 9. DenchHQ/DenchClaw
- **URL:** https://github.com/DenchHQ/DenchClaw
- **Descricao:** Framework gerenciado para todo tipo de knowledge work. CRM Automation e agentes de outreach. "A unica ferramenta de produtividade local que voce precisa."
- **Tech Stack:** TypeScript (97.8%), Node.js 22+, pnpm, tsdown, Vite, Vitest, React (web UI)
- **Stars/Forks:** 1.3k / 82
- **Como usa OpenClaw:** Fork do OpenClaw com foco em CRM e outreach. Web UI em localhost:3100 com workspace management, tabelas de objetos e AI chat. Skills store integrado.
- **Destaques:** Instalacao com `npx denchclaw@latest`. DuckDB para queries em linguagem natural. Browser automation. Multi-view UI.
- **Aplicabilidade business:** CRM e automacao de vendas/outreach totalmente local. Ideal para pequenas empresas que querem automacao sem depender de SaaS caros.

---

### 10. giorgosn/openclaw-crm
- **URL:** https://github.com/giorgosn/openclaw-crm
- **Descricao:** CRM open-source self-hosted com integracao nativa ao OpenClaw Bot. O agente de IA ja sabe usar o CRM -- busca contatos, cria deals, atualiza registros e gerencia tarefas sem codigo adicional.
- **Tech Stack:** TypeScript (98.6%), Next.js 15 (App Router), PostgreSQL 16, Drizzle ORM, Better Auth, shadcn/ui, Tailwind CSS v4, TanStack Table v8, dnd-kit, TipTap, pnpm + Turborepo
- **Stars/Forks:** 43 / 12
- **Como usa OpenClaw:** Chat agent integrado com OpenRouter (Claude, GPT-4o, Llama, Gemini). 8 ferramentas de leitura com auto-execucao, 5 de escrita com confirmacao. Streaming token-by-token. Multi-round tool calling (10 rounds max).
- **Destaques:** Stack moderna e bem construida. 17 tipos de atributos customizaveis. Pipeline drag-and-drop. Import/export CSV. Full-text search via command palette.
- **Aplicabilidade business:** CRM completo com IA integrada. O agente conversa com o CRM em linguagem natural. Muito relevante para empresas que querem gestao de clientes com IA.

---

### 11. FreedomIntelligence/OpenClaw-Medical-Skills
- **URL:** https://github.com/FreedomIntelligence/OpenClaw-Medical-Skills
- **Descricao:** A maior biblioteca open-source de skills medicos para OpenClaw -- 869 skills cobrindo clinica, genomica, drug discovery, bioinformatica e dispositivos medicos.
- **Tech Stack:** OpenClaw/NanoClaw, 14+ bancos de dados biomedicos (PubMed, ClinicalTrials.gov, ChEMBL, DrugBank), FHIR APIs, Git LFS, ClawHub registry
- **Stars/Forks:** 1.6k / 204
- **Como usa OpenClaw:** Skills instalados via ClawHub CLI ou configuracao de workspace. Relatorios clinicos HIPAA/FDA/ICH-GCP compliant. Pipelines de bioinformatica (ClawBio). Suite BioOS estendida.
- **Destaques:** 869 skills categorizados em 8 areas. Integracao com bancos de dados medicos reais. Compliance regulatorio.
- **Aplicabilidade business:** Para empresas de saude, farma e biotech. Automacao de relatorios clinicos, analise genomica, e pesquisa de medicamentos.

---

### 12. ComposioHQ/secure-openclaw
- **URL:** https://github.com/ComposioHQ/secure-openclaw
- **Descricao:** Assistente pessoal 24/7 que roda em plataformas de mensagem. Envia mensagem no WhatsApp, Telegram, Signal ou iMessage e recebe respostas do Claude com acesso completo a ferramentas, memoria persistente e 500+ integracoes de apps.
- **Tech Stack:** JavaScript/Node.js 18+, Claude Agent SDK (Anthropic), Composio (500+ integracoes), Docker/Docker Compose
- **Stars/Forks:** 1.4k / 219
- **Como usa OpenClaw:** Alternativa ao OpenClaw focada em seguranca. Sistema de permissoes com aprovacao do usuario para operacoes sensíveis. Memoria de longo prazo em ~/secure-openclaw/. Scheduling com cron.
- **Destaques:** 500+ apps via Composio (Gmail, Slack, GitHub, Notion, etc.). Multi-plataforma. Sistema de aprovacao para acoes sensiveis.
- **Aplicabilidade business:** Para empresas que precisam de um assistente em messaging com integracoes extensivas e controle de permissoes. Bom para equipes distribuidas.

---

### 13. memovai/mimiclaw
- **URL:** https://github.com/memovai/mimiclaw
- **Descricao:** Roda OpenClaw em um chip de $5. Sem OS Linux, sem Node.js, sem Raspberry Pi. Implementacao completa de agente em C puro no ESP32-S3.
- **Tech Stack:** C (96.6%), ESP-IDF v5.5+, ESP32-S3 (16MB flash, 8MB PSRAM), WiFi, Telegram Bot API, SPIFFS filesystem, NVS
- **Stars/Forks:** 4.8k / 673
- **Como usa OpenClaw:** Reimplementa o core do OpenClaw em C para microcontrolador. Telegram integration, dual AI provider (Claude + GPT), memoria persistente (SOUL.md, USER.md, MEMORY.md), cron scheduler, heartbeat autonomo, ReAct agent loop com web search.
- **Destaques:** Primeiro assistente de IA em chip de $5. Dual-core utilization. Proactive operations via heartbeat. Hardware-level agent framework.
- **Aplicabilidade business:** IoT e automacao fisica. Agentes de IA em dispositivos embarcados baratos. Smart home, monitoramento industrial, terminais de atendimento.

---

### 14. freema/openclaw-mcp
- **URL:** https://github.com/freema/openclaw-mcp
- **Descricao:** Servidor MCP que conecta Claude.ai ao seu OpenClaw self-hosted com autenticacao OAuth2. Bridge seguro entre dois sistemas de IA.
- **Tech Stack:** TypeScript (98.6%), Node.js 20+, Docker/Docker Compose, MCP (Model Context Protocol), SSE transport
- **Stars/Forks:** 106 / 16
- **Como usa OpenClaw:** Orquestra multiplos gateways OpenClaw (prod, staging, dev) a partir de um unico servidor MCP. Suporte a tarefas assincronas com tracking de status. Compativel com reverse proxy.
- **Destaques:** OAuth 2.1. CORS protection. Zero-migration -- deployments existentes funcionam sem mudanca. Documentacao de threat modeling.
- **Aplicabilidade business:** Para empresas que usam Claude Desktop/Claude Code e querem conectar ao OpenClaw. Gerenciamento multi-ambiente (prod/staging/dev).

---

### 15. mergisi/awesome-openclaw-agents
- **URL:** https://github.com/mergisi/awesome-openclaw-agents
- **Descricao:** 187 templates de agentes production-ready para OpenClaw. Configuracoes SOUL.md copy-paste em 24 categorias.
- **Tech Stack:** Markdown, JSON (agents.json), integracao com CrewClaw para deploy
- **Stars/Forks:** 1.8k / 255
- **Como usa OpenClaw:** Cada template e um SOUL.md pronto para usar no OpenClaw. 132 cenarios documentados. Integracoes MCP e compatibilidade de ferramentas. Deploy com um clique via CrewClaw.
- **Destaques:** 24 categorias: Productivity, Development, Marketing, Business, DevOps, Finance, Education, Healthcare, Legal, HR, Creative, Security, E-Commerce, Data, SaaS, Real Estate, Freelance, Supply Chain, Compliance, Voice, Customer Success, Automation.
- **Aplicabilidade business:** Ponto de partida rapido para qualquer caso de uso empresarial. Templates prontos para vendas, suporte, compliance, RH, financeiro, etc.

---

### 16. VoltAgent/awesome-openclaw-skills
- **URL:** https://github.com/VoltAgent/awesome-openclaw-skills
- **Descricao:** Colecao curada de 5.211 skills filtrados e categorizados do registry oficial. Exclui spam, duplicatas, low-quality e maliciosos.
- **Tech Stack:** Markdown/documentacao
- **Stars/Forks:** 41.3k / 4k
- **Como usa OpenClaw:** Catalogo organizado de skills para instalar no OpenClaw. 22 categorias incluindo Coding (1.184), Web Dev (919), DevOps (393), Browser Automation (322), Search (345), Marketing (102).
- **Destaques:** +1M views mensais. O recurso comunitario #1 apos o site oficial. Filtragem rigorosa dos 13.729 skills do ClawHub.
- **Aplicabilidade business:** Referencia essencial para encontrar skills uteis. Economia de tempo significativa ao avaliar quais skills adotar.

---

### 17. hesamsheikh/awesome-openclaw-usecases
- **URL:** https://github.com/hesamsheikh/awesome-openclaw-usecases
- **Descricao:** Colecao comunitaria de casos de uso reais do OpenClaw. Social media, produtividade, DevOps, CRM, pesquisa, financas, automacao criativa.
- **Tech Stack:** Markdown/documentacao
- **Stars/Forks:** 27k / 2.3k
- **Como usa OpenClaw:** Documenta implementacoes reais: digest diario Reddit/YouTube, automacao X/Twitter, pipeline de conteudo YouTube, CRM local, tracking de habitos, meeting notes, RAG knowledge base, Polymarket trading.
- **Destaques:** Casos verificados e testados. Ampla cobertura de dominios. Preocupacao com seguranca documentada.
- **Aplicabilidade business:** Inspiracao e guia pratico para implementar automacoes reais. Mostra o que ja funciona em producao.

---

### 18. Laso37/clawbot
- **URL:** https://github.com/Laso37/clawbot
- **Descricao:** Deploy production-ready do OpenClaw com Docker Compose, auto-HTTPS (Traefik), autenticacao (Authelia), e LLM local (Ollama). Custo ~$30-50/mes vs $1.500+.
- **Tech Stack:** TypeScript (91.7%), Docker Compose, Traefik, Authelia, Ollama (tinyllama 637MB), Next.js (dashboard)
- **Stars/Forks:** 3 / 2
- **Como usa OpenClaw:** Deploy completo do OpenClaw com 6 estrategias de reducao de tokens: model routing (Haiku default, Sonnet quando necessario), heartbeats locais com Ollama. Dashboard customizado com tracking de custo em tempo real.
- **Destaques:** Foco em otimizacao de custo real. Seguranca com Authelia. Monitoramento customizado. Budget enforcement.
- **Aplicabilidade business:** Template para deploy economico de OpenClaw em producao. Essencial para empresas que querem controlar gastos com API.

---

### 19. coollabsio/openclaw
- **URL:** https://github.com/coollabsio/openclaw
- **Descricao:** Imagens Docker totalmente automatizadas do OpenClaw. Build continuo com deteccao de releases upstream a cada 6 horas.
- **Tech Stack:** Go, JavaScript, Shell, Docker (multi-stage builds), docker-compose, nginx, GitHub Actions, Linuxbrew, uv
- **Stars/Forks:** 318 / 90
- **Como usa OpenClaw:** Distribuicao automatizada via Docker. Multi-architecture (amd64/arm64). Reverse proxy nginx com autenticacao HTTP basic. Suporte a 18+ provedores de IA. Browser automation via Chrome/CDP remoto.
- **Destaques:** CI/CD totalmente automatizado. Volumes persistentes para estado e workspace. Webhook automation e integracoes de canal.
- **Aplicabilidade business:** Infraestrutura Docker pronta para producao. Simplifica drasticamente o deploy e manutencao do OpenClaw em VPS/cloud.

---

### 20. digitalknk/openclaw-runbook
- **URL:** https://github.com/digitalknk/openclaw-runbook
- **Descricao:** Guia operacional pratico para rodar OpenClaw sem custos excessivos. Foco em estabilidade e padroes de deploy real, nao em marketing.
- **Tech Stack:** Markdown/documentacao, templates de configuracao
- **Stars/Forks:** 967 / 95
- **Como usa OpenClaw:** Documenta padroes de producao: modelo coordinator vs. worker, controle de custos, gerenciamento de memoria. Templates para prompts, spawn patterns, security hardening, deploy em VPS, monitoramento de quotas.
- **Destaques:** Automacoes prontas: daily briefings, research pipelines, content generation, remote access. Foco em seguranca (API keys, tool policies, prompt injection defense, network lockdown).
- **Aplicabilidade business:** Manual essencial para operacoes. Padroes testados em producao real. Fundamental para qualquer empresa que vá rodar OpenClaw seriamente.

---

### 21. coolmanns/openclaw-memory-architecture
- **URL:** https://github.com/coolmanns/openclaw-memory-architecture
- **Descricao:** Arquitetura de memoria de 12 camadas para agentes OpenClaw. Knowledge graph com 3K+ fatos, busca semantica multilingual (7ms GPU), domain RAG.
- **Tech Stack:** JavaScript/Python, SQLite (facts.db, lcm.db), PostgreSQL + pgvector (LightRAG), llama.cpp com ROCm, OpenAI embeddings, Claude Sonnet, GPT-4.1-mini
- **Stars/Forks:** 38 / 5
- **Como usa OpenClaw:** Plugin system do OpenClaw. Memory_search unificado consultando 4 backends em paralelo. Lossless Context Management (LCM) com DAG de reconstrucao. Knowledge graph com ativacao/decaimento Hebbiano. GraphRAG sobre 139 papers + 11 livros.
- **Destaques:** Busca semantica sub-7ms. 100+ idiomas. Pipeline metacognitivo automatizado (extracao de fatos, deteccao de lacunas, sintese de vetores de crescimento). 4.909 entidades e 6.089 relacoes no GraphRAG.
- **Aplicabilidade business:** Para empresas com grandes bases de conhecimento. Agentes com memoria real e persistente. Ideal para consultoria, juridico, saude -- qualquer dominio intensivo em conhecimento.

---

### 22. LeoYeAI/openclaw-master-skills
- **URL:** https://github.com/LeoYeAI/openclaw-master-skills
- **Descricao:** Colecao curada de 387+ skills de IA, atualizada semanalmente pelo MyClaw.ai a partir do ClawHub, GitHub e comunidade.
- **Tech Stack:** JavaScript/TypeScript, multi-idioma (EN, ZH, FR, DE, RU, JA, IT, ES)
- **Stars/Forks:** 2k / 372
- **Como usa OpenClaw:** Skills instalados via ClawHub ou git clone. 9 categorias: AI/LLM Tools (50), Search/Web (21), Productivity/Office (43), Development/DevOps (87), Financial/E-commerce, Social, System/Infrastructure, Content/Media, Utilities.
- **Destaques:** Atualizacao semanal. Suporte multi-idioma. Cobertura ampla de dominios.
- **Aplicabilidade business:** Fonte curada de skills de qualidade. A atualizacao semanal garante que voce sempre tem acesso aos melhores skills disponiveis.

---

### 23. Helms-AI/openclaw-mcp-server
- **URL:** https://github.com/Helms-AI/openclaw-mcp-server
- **Descricao:** Servidor MCP que expoe ferramentas do OpenClaw Gateway para Claude Code e outros clientes MCP-compativeis.
- **Tech Stack:** TypeScript, Node.js 18+, MCP (Model Context Protocol), npm
- **Stars/Forks:** 10 / 4
- **Como usa OpenClaw:** Conecta ao Gateway local (localhost:18789). Expoe 8 categorias de capacidades: Messaging (7 plataformas), Sessions (spawn sub-agents), Scheduling (cron), Nodes (devices), Web Operations, Memory Search, Text-to-Speech, Gateway status.
- **Destaques:** Arquitetura modular baseada em tools. Permite que Claude Code controle o OpenClaw diretamente.
- **Aplicabilidade business:** Integracao entre ecossistemas de IA. Permite usar Claude Code como interface para controlar OpenClaw e seus agentes.

---

### 24. hustcc/nano-claw
- **URL:** https://github.com/hustcc/nano-claw
- **Descricao:** Assistente pessoal de IA ultra-leve em TypeScript, inspirado no OpenClaw. ~4.500 linhas de codigo, arquitetura extensivel e pronta para pesquisa.
- **Tech Stack:** TypeScript 5.x, Node.js 18+, Zod (validacao), modular architecture
- **Stars/Forks:** 48 / 7
- **Como usa OpenClaw:** Reimplementacao minimalista em TypeScript. Agent loop, 11+ provedores LLM, 3 plataformas de chat (Telegram, Discord, DingTalk), memoria persistente, skill loading, cron scheduling, gateway server.
- **Destaques:** Codebase limpo e legivel. Facil de entender e modificar. Validacao com Zod.
- **Aplicabilidade business:** Para empresas que querem entender como o OpenClaw funciona internamente e customizar profundamente. Base educacional excelente.

---

## Resumo Comparativo

| # | Repositorio | Stars | Tipo | Foco Principal |
|---|------------|-------|------|----------------|
| 1 | openclaw/openclaw | 333k | Core | Assistente pessoal IA |
| 2 | openclaw/clawhub | 6.7k | Registry | Skills marketplace |
| 3 | HKUDS/ClawWork | 7.5k | Framework | IA coworker economico |
| 4 | HKUDS/nanobot | 35.8k | Core Alt | OpenClaw ultra-leve (Python) |
| 5 | Gen-Verse/OpenClaw-RL | 4.1k | ML/RL | Treinamento por conversas |
| 6 | grp06/openclaw-studio | 1.8k | Dashboard | UI de gerenciamento |
| 7 | dataelement/Clawith | 2.2k | Enterprise | Multi-agente para equipes |
| 8 | abhi1693/openclaw-mission-control | 3k | Orquestracao | Dashboard de operacoes |
| 9 | DenchHQ/DenchClaw | 1.3k | CRM | CRM + outreach |
| 10 | giorgosn/openclaw-crm | 43 | CRM | CRM com IA integrada |
| 11 | FreedomIntelligence/OpenClaw-Medical-Skills | 1.6k | Saude | 869 skills medicos |
| 12 | ComposioHQ/secure-openclaw | 1.4k | Seguranca | 500+ integracoes seguras |
| 13 | memovai/mimiclaw | 4.8k | IoT/Hardware | OpenClaw em chip de $5 |
| 14 | freema/openclaw-mcp | 106 | Integracao | Bridge MCP para Claude |
| 15 | mergisi/awesome-openclaw-agents | 1.8k | Templates | 187 agentes prontos |
| 16 | VoltAgent/awesome-openclaw-skills | 41.3k | Catalogo | 5.211 skills curados |
| 17 | hesamsheikh/awesome-openclaw-usecases | 27k | Use Cases | Casos de uso reais |
| 18 | Laso37/clawbot | 3 | Deploy | Deploy economico producao |
| 19 | coollabsio/openclaw | 318 | Infra | Docker automatizado |
| 20 | digitalknk/openclaw-runbook | 967 | Operacoes | Guia operacional |
| 21 | coolmanns/openclaw-memory-architecture | 38 | Memoria | 12 camadas de memoria |
| 22 | LeoYeAI/openclaw-master-skills | 2k | Skills | 387+ skills curados |
| 23 | Helms-AI/openclaw-mcp-server | 10 | Integracao | MCP para Claude Code |
| 24 | hustcc/nano-claw | 48 | Core Alt | OpenClaw minimalista TS |

---

## Conclusoes e Recomendacoes para Negocios

### Ecossistema Maduro
O ecossistema OpenClaw ja e robusto o suficiente para uso empresarial. Com 333k stars e 64.8k forks no repo principal, o projeto tem massa critica para sustentabilidade.

### Pontos de Entrada para Negocios

1. **CRM + Automacao de Vendas:** DenchClaw (#9) e openclaw-crm (#10) oferecem CRM com IA integrada, self-hosted e gratuitos.

2. **Equipes e Enterprise:** Clawith (#7) e Mission Control (#8) fornecem multi-tenant, RBAC, audit logs e workflows de aprovacao.

3. **Deploy Rapido:** coollabsio/openclaw (#19) para Docker automatizado, clawbot (#18) para deploy economico, runbook (#20) para operacoes.

4. **Skills e Templates Prontos:** awesome-openclaw-agents (#15) com 187 templates em 24 categorias, e awesome-openclaw-skills (#16) com 5.211 skills filtrados.

5. **Verticais Especializadas:** Medical Skills (#11) para saude, ClawWork (#3) para avaliacao de ROI, OpenClaw-RL (#5) para treinamento continuo.

6. **IoT e Hardware:** MimiClaw (#13) demonstra que agentes OpenClaw podem rodar em dispositivos de $5.

### Relevancia para Vialum/Genesis Marcas
- **openclaw-crm** e **DenchClaw** podem servir de referencia para automacao de gestao de clientes
- **Clawith** como modelo de multi-tenant para multiplos escritorios/clientes
- **mergisi/awesome-openclaw-agents** tem templates para Legal e Compliance diretamente aplicaveis a propriedade intelectual
- **OpenClaw-Medical-Skills** como referencia de como criar skills verticais especializados (ex: skills INPI)
- **openclaw-runbook** como guia operacional para deploy em VPS

