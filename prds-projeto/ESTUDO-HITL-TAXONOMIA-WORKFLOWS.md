# Estudo: HITL em Workflows de Agentes IA — Taxonomia, Frameworks e Estrategia Vialum

> **Autor:** Nicolas Amaral (Genesis Marcas / Avelum / Vialum)
> **Data:** 2026-03-26
> **Versao:** 1.0
> **Objetivo:** Fundamentar a arquitetura de HITL do Vialum Tasks com base em pesquisa academica, frameworks de mercado e analise critica de trade-offs.

---

## 1. Contexto e Motivacao

A Vialum esta construindo uma engine de workflow orchestration que combina execucao por IA e intervencao humana (Human-in-the-Loop / HITL) para operacoes de backoffice reguladas — inicialmente registro de marcas (PI), com expansao para outros dominios.

**Pergunta central:** Como estruturar a taxonomia de workflows para que o HITL seja um cidadao de primeira classe na definicao, nao um add-on?

---

## 2. Taxonomia Proposta pela Vialum

```
Workflow  →  caso/processo completo (ex: Protocolo de Registro de Marca)
  Stage   →  fase macro do pipeline, visivel no board (ex: Preparacao Documental)
    Task  →  bloco de trabalho com objetivo claro (ex: Confeccionar Procuracao)
      Step →  unidade executavel com executor definido (ai | human | ai_then_human)
```

### Principio organizador

> **Step = menor unidade que faz sentido pausar para um humano avaliar.**

Se nao precisa de pausa humana entre duas acoes, elas sao o mesmo Step. Se precisa, sao Steps diferentes. A granularidade atomica (preencher CPF, preencher RG) fica na **implementacao** do Step, nao na **definicao** do workflow.

### Exemplo concreto

```yaml
workflow: protocolo-registro
stages:
  - stage: preparacao-documental
    tasks:
      - task: coletar-dados-cliente
        steps:
          - step: extrair-dados-conversa
            executor: ai
            description: "Ler conversa WhatsApp e extrair CPF, RG, nome, endereco"

          - step: validar-dados-extraidos
            executor: human
            description: "Conferir se dados extraidos batem com documentos"

          - step: preencher-clickup
            executor: ai
            description: "Preencher campos no ClickUp com dados validados"

      - task: confeccionar-procuracao
        steps:
          - step: gerar-documento
            executor: ai

          - step: revisar-documento
            executor: human
```

---

## 3. Panorama Academico

### 3.1 Survey: "LLM-Based Human-Agent Collaboration and Interaction Systems"

- **Autores:** Henry Peng Zou, Yue Huang et al.
- **Fonte:** arXiv:2505.00753 (maio 2025)
- **URL:** https://arxiv.org/abs/2505.00753
- **Contribuicao:** Primeiro survey abrangente de Human-Agent Systems com LLMs. Propoe taxonomia de 5 dimensoes:
  1. Environment & Profiling (papeis, objetivos, capacidades)
  2. Human Feedback (tipos, timing, granularidade)
  3. Interaction Types (colaborativo, competitivo, cooperativo)
  4. Orchestration (sequencial vs paralelo, sincrono vs assincrono)
  5. Communication (estrutura e modo do fluxo de informacao)
- **Relevancia Vialum:** A dimensao "Orchestration" valida a necessidade de definir estrategia de task (sequencial/paralelo) e sincronizacao temporal. A dimensao "Human Feedback" valida que o timing e granularidade do HITL sao decisoes de design, nao afterthoughts.
- **GitHub:** github.com/HenryPengZou/Awesome-Human-Agent-Collaboration-Interaction-Systems

### 3.2 "Orchestrating Human-AI Teams: The Manager Agent"

- **Autores:** Charlie Masters, Advaith Vellanki, Jiangbo Shangguan et al.
- **Fonte:** arXiv:2510.02557 (outubro 2025), publicado no ACM DAI '25
- **URL:** https://arxiv.org/abs/2510.02557
- **Contribuicao:** Formaliza orquestracao de workflow como **Partially Observable Stochastic Game (POSG)**. Propoe o "Autonomous Manager Agent" que:
  - Decompoe objetivos complexos em **task graphs**
  - Aloca tasks entre humanos e agentes IA
  - Monitora progresso e adapta em tempo real
  - Mantem comunicacao transparente com stakeholders
- **4 desafios fundamentais:** (1) raciocinio composicional para decomposicao hierarquica, (2) otimizacao multi-objetivo, (3) coordenacao em times ad hoc, (4) governance by design
- **Artefato:** Libera **MA-Gym**, framework open-source de simulacao
- **Relevancia Vialum:** O conceito de "Manager Agent" e exatamente o que a Vialum Tasks engine faz — orquestrar tasks entre IA e humanos com task graphs. A formalizacao como POSG da base teorica solida.

### 3.3 "Measuring AI Agent Autonomy"

- **Fonte:** Anthropic Research (2025-2026)
- **URL:** https://www.anthropic.com/research/measuring-agent-autonomy
- **Contribuicao:** Duas dimensoes para medir autonomia de agentes:
  - **Risk Score (1-10):** de "sem consequencias" a "dano substancial"
  - **Autonomy Score (1-10):** de "instrucoes explicitas" a "operacao independente"
- **Descoberta-chave:** Usuarios experientes migram naturalmente de **oversight por aprovacao** (revisar cada acao) para **oversight por monitoramento** (intervir quando necessario). Agentes que pedem clarificacao (self-limitation) sao um mecanismo critico de seguranca.
- **Relevancia Vialum:** Fundamenta a evolucao futura de `oversight_mode: approval` → `oversight_mode: monitoring` conforme confianca cresce.

### 3.4 "Levels of Autonomy for AI Agents"

- **Fonte:** Knight First Amendment Institute, Columbia University
- **URL:** https://knightcolumbia.org/content/levels-of-autonomy-for-ai-agents-1
- **Contribuicao:** 5 niveis de autonomia caracterizados pelo papel do humano:

| Nivel | Papel Humano | Mapeamento Vialum |
|-------|-------------|-------------------|
| Operator | Humano faz, IA assiste | `executor: human` com sugestoes da IA |
| Collaborator | Fazem juntos | `executor: ai_then_human` |
| Consultant | IA faz, humano aconselha | `executor: ai` + `oversight: monitoring` |
| Approver | IA propoe, humano aprova | `executor: ai` + `approval: required` |
| Observer | IA age, humano monitora depois | `executor: ai` + review post-hoc |

- **Relevancia Vialum:** Cada Step pode ter um `autonomy_level` que mapeia para um desses papeis, permitindo granularidade fina de controle humano.

### 3.5 "AI Agents vs. Agentic AI: A Conceptual Taxonomy"

- **Fonte:** arXiv:2505.10468 (2025)
- **URL:** https://arxiv.org/abs/2505.10468
- **Contribuicao:** Propoe escala de 6 niveis de autonomia (L0 manual → L5 inovacao generativa), com requisitos decrescentes de supervisao humana por nivel.
- **Relevancia Vialum:** Valida que a escala de autonomia e um conceito emergente no campo, nao uma invencao isolada.

### 3.6 "Taxonomy of Hierarchical Multi-Agent Systems"

- **Fonte:** arXiv:2508.12683 (2025)
- **URL:** https://arxiv.org/html/2508.12683
- **Contribuicao:** 5 eixos para classificar hierarquias multi-agente:
  1. Hierarquia de controle (centralizado / descentralizado / hibrido)
  2. Fluxo de informacao (top-down / bottom-up / peer-to-peer)
  3. Delegacao de papel/task (fixo vs emergente)
  4. Camadas temporais (longo vs curto horizonte)
  5. Estrutura de comunicacao (estatica vs dinamica)
- **Relevancia Vialum:** A Vialum Tasks usa controle centralizado (engine orquestra), fluxo top-down (workflow → step), delegacao fixa (executor definido no YAML), e comunicacao estatica. Isso e valido para operacoes reguladas.

### 3.7 "Human-In-the-Loop Software Development Agents" (HULA)

- **Fonte:** arXiv:2411.12924 (novembro 2024)
- **URL:** https://arxiv.org/abs/2411.12924
- **Contribuicao:** Framework onde engenheiros refinam e guiam LLMs na geracao de planos e codigo. Demonstra HITL em dois niveis distintos: geracao de plano e geracao de codigo.
- **Relevancia Vialum:** Valida a ideia de HITL em multiplos pontos de um mesmo workflow, nao apenas no final.

### 3.8 "AdaptBot: LLM + Knowledge Graph + HITL for Task Decomposition"

- **Fonte:** arXiv:2502.02067 (fevereiro 2025)
- **URL:** https://arxiv.org/html/2502.02067
- **Contribuicao:** Framework que combina LLM + Knowledge Graph + HITL para decomposicao de tasks genericas em especificas. O humano intervem **apenas quando ha ambiguidade nao resolvida** — modelo de HITL por escalacao.
- **Relevancia Vialum:** Inspira o futuro `confidence_threshold` — IA so escala para humano quando nao consegue resolver sozinha.

### 3.9 "Agentic Workflows for Conversational Human-AI Interaction Design"

- **Autores:** Arthur Caetano et al.
- **Fonte:** arXiv:2501.18002 (janeiro 2025)
- **URL:** https://arxiv.org/abs/2501.18002
- **Contribuicao:** Define agentic workflows como "sequencias estruturadas de atividades que envolvem colaboracao e tomada de decisao entre humanos e agentes IA, onde cada participante tem papeis e responsabilidades distintas."
- **Relevancia Vialum:** A definicao formal se alinha quase perfeitamente com o que a Vialum Tasks implementa.

### 3.10 "Building Effective Agents"

- **Fonte:** Anthropic Engineering (2024)
- **URL:** https://www.anthropic.com/engineering/building-effective-agents
- **Contribuicao:** Taxonomia de 3 camadas:
  1. Augmented LLM (bloco basico)
  2. Workflows (caminhos pre-definidos): prompt chaining, routing, paralelizacao, orchestrator-workers, evaluator-optimizer
  3. Agents (dinamicos, auto-dirigidos)
- **Principio:** "Start simple, add complexity only when demonstrably needed."
- **Relevancia Vialum:** Valida que workflows pre-definidos sao um estagio valido e necessario, nao uma muleta. Agentes autonomos sao o proximo nivel, nao um substituto.

### 3.11 "Evaluating Human-AI Collaboration: A Review and Methodological Framework"

- **Fonte:** arXiv:2407.19098 (2024, atualizado 2025)
- **URL:** https://arxiv.org/abs/2407.19098
- **Contribuicao:** Framework de avaliacao com arvore de decisao para selecao de metricas baseada em modos de HAIC: AI-Centric, Human-Centric, e Symbiotico.
- **Relevancia Vialum:** Util para definir KPIs do sistema (taxa de aprovacao, tempo de espera HITL, taxa de rejeicao).

### 3.12 "AFLOW: Automated Workflow Optimization" (ICLR 2025)

- **Fonte:** arXiv:2410.10762
- **URL:** https://arxiv.org/pdf/2410.10762
- **Contribuicao:** Usa Monte Carlo Tree Search para otimizar workflows representados como codigo. Formaliza workflows como estruturas pesquisaveis/otimizaveis.
- **Relevancia Vialum:** Futuro — otimizacao automatica de workflows baseada em dados historicos de execucao.

---

## 4. Panorama de Frameworks de Mercado

### 4.1 LangGraph (LangChain)

- **URL:** https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- **Hierarquia:** Graph > Nodes > Edges > State > Checkpoints
- **Mecanismo HITL:** `interrupt()` pausa execucao, persiste estado via checkpointer, resume com `Command(resume=...)`.
- **3 padroes HITL:**
  1. Approve/Reject — pausa antes de step critico
  2. Human Edit of State — humano modifica estado mid-execution
  3. Human Input/Feedback — grafo solicita informacao
- **Decisoes humanas:** approve | edit | reject
- **Persistencia:** Requer checkpointer (PostgresSaver para producao)
- **Refs adicionais:**
  - https://dev.to/jamesbmour/interrupts-and-commands-in-langgraph-building-human-in-the-loop-workflows-4ngl
  - https://towardsdatascience.com/langgraph-201-adding-human-oversight-to-your-deep-research-agent/

### 4.2 CrewAI

- **URL:** https://docs.crewai.com/en/learn/human-input-on-execution
- **Hierarquia:** Crew > Agents > Tasks (Process.sequential ou Process.hierarchical)
- **Mecanismo HITL:** `human_input=True` na Task, `HumanTool`, `@human_feedback` decorator, ou webhooks para async.
- **Limitacao:** HITL assincrono ainda em evolucao; flag principal e sincrono/blocking.
- **Refs:**
  - https://github.com/crewAIInc/crewAI/issues/2051
  - https://community.crewai.com/t/human-in-the-loop-workaround/7330

### 4.3 AutoGen / AG2 (Microsoft)

- **URL:** https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html
- **Hierarquia:** Agents > Teams > Termination Conditions
- **2 padroes HITL:**
  1. UserProxyAgent (sincrono) — bloqueia ate humano responder. Modos: ALWAYS, TERMINATE, NEVER
  2. HandoffTermination (assincrono) — agente emite HandoffMessage, team pausa, resume com historico completo
- **Microsoft Agent Framework (2025+):** Sucessor do AutoGen, combina com Semantic Kernel. Estado robusto para HITL de longa duracao.
- **Refs:**
  - https://docs.ag2.ai/latest/docs/api-reference/autogen/UserProxyAgent/
  - https://learn.microsoft.com/en-us/agent-framework/overview/

### 4.4 Temporal.io

- **URL:** https://docs.temporal.io/ai-cookbook/human-in-the-loop-python
- **Hierarquia:** Workflow > Activities > Signals > Queries
- **Mecanismo HITL:** `workflow.wait_condition()` com lambda + timeout configuravel. Sistemas externos enviam Signals para aprovar/rejeitar.
- **Diferencial:** **Durable execution** — enquanto espera, consome **zero recursos computacionais**. Suporta esperas de horas, dias, meses.
- **2025:** Temporal entrou na Agentic AI Foundation (AAIF). Tem integracao oficial com OpenAI Agents SDK.
- **Refs:**
  - https://temporal.io/blog/orchestrating-ambient-agents-with-temporal
  - https://temporal.io/blog/using-multi-agent-architectures-with-temporal

### 4.5 Prefect

- **URL:** https://www.prefect.io/ai-teams
- **Mecanismo HITL:** Pause nativo com UI forms auto-gerados. Suporta approval workflows, feedback loops, compliance gates sem infraestrutura custom.
- **Diferencial:** Sem DAGs pre-compilados — segue fluxo Python (while loops, branching em runtime).

### 4.6 LlamaIndex Workflows

- **URL:** https://developers.llamaindex.ai/python/framework/understanding/agent/human_in_the_loop/
- **Hierarquia:** Workflow > Steps > Events
- **Mecanismo HITL:** Event-driven com `InputRequiredEvent` (pausa) e `HumanResponseEvent` (resume).
- **Refs:**
  - https://developers.llamaindex.ai/typescript/workflows/common_patterns/human_in_the_loop/
  - https://www.llamaindex.ai/blog/announcing-workflows-1-0-a-lightweight-framework-for-agentic-systems

### 4.7 OpenAI Agents SDK

- **URL:** https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- **Hierarquia:** Agent > Tools > Runs > Interruptions
- **Mecanismo HITL:** `needsApproval: true` (ou funcao async) por tool. Run pausa, retorna `result.interruptions`, resolve com `approve()` ou `reject()`.
- **Diferencial:** `needsApproval` pode ser funcao — permite logica dinamica.
- **Ref:** https://openai.github.io/openai-agents-python/

### 4.8 Azure Agent Orchestration Patterns

- **URL:** https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- **Catalogo de padroes (atualizado fev 2026):**
  - Sequential (pipeline/prompt chaining)
  - Concurrent (fan-out/fan-in)
  - Group Chat (roundtable, multi-agent debate) — melhor para HITL
  - Handoff (routing, triage, delegacao)
  - Maker-Checker Loops (evaluator-optimizer)
- **Papeis humanos:** observer (group chat), reviewer (maker-checker), escalation target (handoff)

### 4.9 Cloudflare Agents SDK

- **URL:** https://developers.cloudflare.com/agents/concepts/human-in-the-loop/
- **Mecanismo HITL:** `waitForApproval()` / `approveWorkflow()` / `rejectWorkflow()`
- **Persistencia:** Durable Objects para estado.
- **Ref:** https://developers.cloudflare.com/agents/guides/human-in-the-loop/

---

## 5. Startups e Produtos Focados em HITL

| Produto | Foco | Diferencial | URL |
|---------|------|-------------|-----|
| **HumanLayer** | SDK open-source (Apache 2) | `@require_approval()` decorator, `human_as_tool()`, roteamento Slack/Email | https://www.humanlayer.dev/ |
| **Orkes Conductor** | Workflow engine (origem Netflix) | Human Task nativo, 14+ LLM providers. Usado por Tesla, LinkedIn, JP Morgan | https://orkes.io/blog/human-in-the-loop/ |
| **Inngest** | Orquestracao serverless | `step.ai.infer()` + suspend/resume para pausas longas sem perda de estado | https://www.inngest.com/ai |
| **Permit.io** | Authorization-as-a-service | Fluxos de aprovacao como tools chamaveis por LLMs | https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo |
| **OneReach.ai** | Plataforma enterprise agentica | Escalacao humana em tempo real | https://onereach.ai/blog/human-in-the-loop-agentic-ai-systems/ |

---

## 6. BPMN 2.0 — O Padrao ISO Existente (ISO 19510)

- **URL:** https://www.bpmn.org/
- **Hierarquia:** Process > Sub-Process > Task (unidade atomica)
- **Tipos de Task:**
  - **User Task** — humano + software
  - **Manual Task** — so humano
  - **Service Task** — automatizado
  - **Script Task** — script automatico
  - **Business Rule Task** — regra de negocio
  - **Send/Receive Tasks** — comunicacao
- **Relevancia:** A distincao User Task vs Service Task e a versao original da fronteira `executor: human` vs `executor: ai`. O BPMN e de 2011 e nao contempla IA como executor, mas a estrutura hierarquica e a mais proxima do que a Vialum Tasks implementa.

---

## 7. Tabela Comparativa: Frameworks vs Vialum

| Aspecto | LangGraph | CrewAI | Temporal | OpenAI SDK | BPMN | **Vialum Tasks** |
|---------|-----------|--------|----------|------------|------|------------------|
| Taxonomia | Graph>Node>Edge | Crew>Agent>Task | Workflow>Activity>Signal | Agent>Tool>Run | Process>SubProcess>Task | **Workflow>Stage>Task>Step** |
| HITL definido em | Codigo (breakpoints) | Flag na Task | Codigo (wait_condition) | Flag na Tool | Diagrama (User Task) | **YAML declarativo (executor por Step)** |
| Decisoes humanas | approve/edit/reject | input/feedback | Signal approve/reject | approve/reject | N/A (manual) | **approve/edit/reject + executor types** |
| Persistencia | Checkpointer (Postgres) | Webhook-based | Durable execution nativo | Run state | N/A | **DB (Prisma/Postgres)** |
| HITL assincrono | Sim | Parcial | Sim (nativo) | Sim | N/A | **Sim (status idle + polling/webhook)** |
| Multi-tenancy | Nao | Nao | Nao nativo | Nao | N/A | **Sim (accountId em tudo)** |
| Domain-agnostic | Sim (generico) | Sim (generico) | Sim (generico) | Sim (generico) | Sim (generico) | **Sim (workflow YAML define dominio)** |
| Nao-dev entende o fluxo? | Nao | Nao | Nao | Nao | Sim (diagrama) | **Sim (YAML legivel)** |
| Agente pode pular aprovacao? | Depende | Depende | Nao | Depende | N/A | **Nao (engine impoe)** |

---

## 8. Analise de Convergencia e Lacunas

### O que e consenso no mercado e academia

1. **HITL e essencial para agentes em producao.** Todos os frameworks maiores (LangGraph, CrewAI, AutoGen, Anthropic, OpenAI) tem suporte first-class.
2. **Checkpoint + interrupt/resume** e o padrao arquitetural dominante. Nao polling, nao webhook-only.
3. **Vocabulario padrao:** `approve` / `edit` / `reject` e quase universal.
4. **Decomposicao hierarquica** e universal (goal > task > step/action).
5. **State persistence** e obrigatorio para HITL em producao.
6. **Roteamento baseado em risco** (confianca, irreversibilidade, blast radius) determina quem executa.
7. **EU AI Act** (em vigor desde 2024) esta acelerando formalizacao de requisitos de supervisao humana.

### O que NAO tem consenso (oportunidades)

1. **Nao existe taxonomia padronizada** para os niveis da hierarquia. Cada paper/framework usa termos diferentes.
2. **Nao existe consenso sobre quando interromper.** Checkpoints fixos vs adaptativo por confianca vs decisao do agente — todos competem.
3. **Sincrono vs assincrono** e uma divisao real nao resolvida. AutoGen alerta que HITL blocking e problematico para workflows longos.
4. **Paradigma de orquestracao** — manager agent centralizado vs agentes peer vs DAG estatico competem ativamente.
5. **Nenhum framework combina** definicao declarativa + HITL como principio organizador + multi-tenancy + domain-agnostic.

---

## 9. Posicionamento da Vialum: Inovacao vs Mercado

### Onde a Vialum se alinha com o mercado

- Interrupt/resume como padrao
- Approve/edit/reject como vocabulario
- Persistencia em banco de dados
- Decomposicao hierarquica

### Onde a Vialum inova

| Inovacao | Detalhe | Base academica |
|----------|---------|----------------|
| **HITL como principio organizador** | Step existe *porque* precisa de fronteira de executor. Inverso ao mercado (workflow primeiro, HITL depois) | Alinha com Caetano et al. (2025) — "papeis e responsabilidades distintas" como parte da definicao |
| **Definicao declarativa com executor por Step** | `executor: ai/human` no YAML, nao via codigo | Evolucao do BPMN User Task vs Service Task para era de agentes |
| **Regra de granularidade** | "Step = menor unidade que faz sentido pausar para humano" | Nao formalizado em nenhum paper. Heuristica original |
| **Multi-tenancy nativo** | `accountId` em todas as tabelas desde o inicio | Nenhum framework de agentes endereca isso |
| **Domain-agnostic por design** | Mesmo engine roda PI, contabilidade, juridico | Frameworks sao genericos mas sem opiniao; Vialum e opinada |

### Riscos identificados

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| Over-engineering para o momento | Media | Validar com 2-3 workflows reais antes de generalizar |
| YAML vira gargalo em workflows complexos (branching, loops, retry) | Media | Adicionar `on_failure: agent` como escape valve; considerar YAML + codigo hibrido |
| Mercado converge para "agentes sem workflow" | Baixa para operacoes reguladas | Compliance exige processo auditavel; PI/juridico/contabilidade sempre precisarao de workflows definidos |

---

## 10. Recomendacoes Estrategicas

### Para implementar agora (v1)

1. **Manter taxonomia** Workflow > Stage > Task > Step — solidamente fundamentada
2. **Executores fixos:** `executor: ai | human | ai_then_human` — sem complexidade dinamica
3. **Vocabulario de decisao:** `approve | edit | reject` — alinhado com mercado
4. **Engine impoe HITL** — agente nao pode pular aprovacao (diferencial vs LangGraph/OpenAI)

### Para implementar depois (v2)

1. **`on_failure: agent`** — escape valve para quando workflow quebra; agente autonomo assume com contexto
2. **`confidence_threshold`** por Step — IA so escala para humano quando certeza < threshold (inspirado em AdaptBot, arXiv 2502.02067)
3. **Progressive autonomy** — `oversight_mode: approval | monitoring` evolui automaticamente com historico de execucoes (inspirado em Anthropic Research)
4. **`human_as_tool()`** — humano nao e so aprovador, pode ser executor chamado pela IA (inspirado em HumanLayer)

### Para considerar no futuro (v3+)

1. **Replanejamento dinamico** — quando step falha ou humano rejeita, sistema recompoe task graph (inspirado em Masters et al., 2025)
2. **Otimizacao automatica** de workflows baseada em dados historicos (inspirado em AFLOW, ICLR 2025)
3. **Metricas de avaliacao** — taxa de aprovacao, tempo de espera HITL, taxa de rejeicao (inspirado em arXiv 2407.19098)

---

## 11. Conclusao

A Vialum Tasks nao esta reinventando a roda — os mecanismos basicos (interrupt/resume, approve/reject, state persistence) sao consenso. Mas esta **redesenhando o eixo**: ninguem organizou a taxonomia de tasks em funcao do HITL como principio estrutural, de forma declarativa, multi-tenant e domain-agnostic.

O posicionamento mais preciso e: **a Vialum esta fazendo o BPMN 3.0 para a era de agentes IA**, onde a pergunta "quem executa — humano ou maquina?" e respondida na definicao do workflow, nao no codigo.

O mercado tech mainstream (Silicon Valley, dev tools) foca em agentes flexiveis para desenvolvedores. A Vialum foca em **operacoes reguladas de backoffice** onde processo auditavel e obrigatorio. Sao segmentos diferentes, e o da Vialum esta sub-atendido.

---

## 12. Referencias Completas

### Papers Academicos

| # | Titulo | Autores | Fonte | URL |
|---|--------|---------|-------|-----|
| 1 | LLM-Based Human-Agent Collaboration Survey | Zou, Huang et al. | arXiv:2505.00753 | https://arxiv.org/abs/2505.00753 |
| 2 | Orchestrating Human-AI Teams: Manager Agent | Masters et al. | arXiv:2510.02557, ACM DAI '25 | https://arxiv.org/abs/2510.02557 |
| 3 | Measuring AI Agent Autonomy | Anthropic Research | Anthropic (2025-2026) | https://www.anthropic.com/research/measuring-agent-autonomy |
| 4 | Levels of Autonomy for AI Agents | Knight Institute | Columbia University | https://knightcolumbia.org/content/levels-of-autonomy-for-ai-agents-1 |
| 5 | AI Agents vs Agentic AI Taxonomy | — | arXiv:2505.10468 | https://arxiv.org/abs/2505.10468 |
| 6 | Taxonomy of Hierarchical Multi-Agent Systems | — | arXiv:2508.12683 | https://arxiv.org/html/2508.12683 |
| 7 | HULA: Human-In-the-Loop Software Dev Agents | — | arXiv:2411.12924 | https://arxiv.org/abs/2411.12924 |
| 8 | AdaptBot: LLM + KG + HITL Decomposition | — | arXiv:2502.02067 | https://arxiv.org/html/2502.02067 |
| 9 | Agentic Workflows for Human-AI Interaction | Caetano et al. | arXiv:2501.18002 | https://arxiv.org/abs/2501.18002 |
| 10 | Building Effective Agents | Anthropic Engineering | Anthropic (2024) | https://www.anthropic.com/engineering/building-effective-agents |
| 11 | Evaluating Human-AI Collaboration | — | arXiv:2407.19098 | https://arxiv.org/abs/2407.19098 |
| 12 | AFLOW: Automated Workflow Optimization | — | arXiv:2410.10762, ICLR 2025 | https://arxiv.org/pdf/2410.10762 |

### Frameworks e Documentacao

| # | Framework | URL Principal |
|---|-----------|---------------|
| 1 | LangGraph HITL | https://docs.langchain.com/oss/python/langchain/human-in-the-loop |
| 2 | CrewAI HITL | https://docs.crewai.com/en/learn/human-input-on-execution |
| 3 | AutoGen HITL | https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html |
| 4 | Microsoft Agent Framework | https://learn.microsoft.com/en-us/agent-framework/overview/ |
| 5 | Temporal HITL | https://docs.temporal.io/ai-cookbook/human-in-the-loop-python |
| 6 | LlamaIndex HITL | https://developers.llamaindex.ai/python/framework/understanding/agent/human_in_the_loop/ |
| 7 | OpenAI Agents SDK HITL | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ |
| 8 | Azure Agent Patterns | https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns |
| 9 | Cloudflare Agents HITL | https://developers.cloudflare.com/agents/concepts/human-in-the-loop/ |
| 10 | BPMN 2.0 | https://www.bpmn.org/ |

### Startups e Produtos

| # | Produto | URL |
|---|---------|-----|
| 1 | HumanLayer | https://www.humanlayer.dev/ |
| 2 | Orkes Conductor | https://orkes.io/blog/human-in-the-loop/ |
| 3 | Inngest | https://www.inngest.com/ai |
| 4 | Permit.io | https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo |
| 5 | OneReach.ai | https://onereach.ai/blog/human-in-the-loop-agentic-ai-systems/ |

---

*Documento gerado em 2026-03-26. Deve ser revisado conforme novos papers e frameworks surgirem.*
