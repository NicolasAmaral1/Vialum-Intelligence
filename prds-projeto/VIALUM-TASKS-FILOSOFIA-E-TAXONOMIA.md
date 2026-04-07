# Vialum Tasks — Filosofia, Taxonomia e Arquitetura

> **Data:** 2026-03-27
> **Versao:** 1.0
> **Autor:** Nicolas Amaral / Vialum Intelligence
> **Status:** Documento vivo — atualizar conforme decisoes evoluem

---

## 1. O que é o Vialum Tasks

O Vialum Tasks é um **sistema de orquestração de workflows** que combina trabalho de IA, pessoas e automações para executar processos operacionais de backoffice. Ele nasce de uma necessidade real: operações reguladas (como registro de marcas no INPI) exigem processos auditáveis, com múltiplos atores, decisões humanas em pontos críticos, e interação com clientes via WhatsApp.

O sistema não é um chatbot, nem um agente autônomo, nem uma ferramenta de project management. É um **motor de decisão** que sabe:

- O que precisa ser feito (workflow definition)
- Quem faz cada coisa (executor: ai, human, system)
- Quando pausar para aprovação humana (HITL)
- Quando esperar o cliente responder (wait_for)
- Quem no time é responsável (assignee)
- Como evoluir de IA cara para automação barata (modelo cimento)

---

## 2. Princípios fundamentais

### 2.1 HITL como princípio organizador

A maioria dos sistemas adiciona Human-in-the-Loop como um "flag" em cima de uma ação de IA. No Vialum Tasks, é o contrário: **a estrutura do workflow existe em função do HITL**.

Um Step não é "uma ação que pode ter HITL". Um Step é **a menor unidade que faz sentido pausar para um humano avaliar**. Se não precisa de pausa humana entre duas ações, elas são o mesmo Step. Se precisa, são Steps diferentes.

Isso inverte a lógica: não é "o que a IA faz e onde o humano interfere", é "onde o humano precisa agir e como a IA o apoia entre esses pontos".

### 2.2 Declarativo, não código

Workflows são definidos em YAML, não em código. Isso permite que:

- Não-desenvolvedores entendam o fluxo
- O mesmo engine execute qualquer workflow de qualquer domínio
- Mudanças no processo não exijam deploy
- O workflow seja documentação viva do processo

### 2.3 Executor explícito

Cada Step declara **quem executa**: `ai`, `human`, ou `system`. Não existe ambiguidade. O engine sabe exatamente o que fazer com cada Step.

| Executor | O que é | Exemplo |
|----------|---------|---------|
| `ai` | LLM (squad hoje, LangChain amanhã, script depois) | Preparar mensagem personalizada |
| `human` | Pessoa do time com nome e sobrenome | Revisar contrato, analisar estratégia |
| `system` | Código determinístico, sem LLM | Upload no Drive, mover card no ClickUp |

### 2.4 Modelo cimento (migração progressiva)

Cada Step começa no runtime mais flexível e migra para o mais eficiente conforme o processo amadurece:

```
SQUAD (molhado)  →  LANGCHAIN (úmido)  →  SCRIPT (seco)
  Flexível            Prompt fixo           Determinístico
  ~$0.10/exec         ~$0.02/exec           ~$0.00/exec
  Bom pra descobrir   Bom quando estável    Bom quando previsível
```

A regra de migração: **quando o humano para de editar o output da IA por 20 execuções consecutivas, o Step está pronto pra migrar**.

### 2.5 ClickUp como UI, não como cérebro

O ClickUp é o board visual onde o time vê o que está acontecendo. Mas a **lógica do workflow** não vive no ClickUp — vive no YAML e no engine. O ClickUp é espelho, não fonte de verdade (no MVP, é fonte de verdade temporariamente; no futuro, o banco do Vialum Tasks assume).

### 2.6 Domain-agnostic, multi-tenant

O engine não sabe o que é "registro de marca" ou "laudo de viabilidade". Ele sabe o que é Workflow, Stage, Task, Step, Action. O domínio vem do YAML. Isso permite que o mesmo sistema sirva para PI, jurídico, contabilidade, cartórios, ou qualquer operação regulada.

Multi-tenancy (accountId em tudo) está presente desde o primeiro dia, não como afterthought.

---

## 3. Taxonomia — Os 5 níveis

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   WORKFLOW                                                      │
│   └── STAGE                                                     │
│       └── TASK                                                  │
│           └── STEP                                              │
│               └── ACTION                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Workflow

**O que é:** O processo completo, do início ao fim, para um caso específico.

**Analogia:** Um "caso" ou "projeto" — tudo que precisa acontecer para entregar o resultado final.

**No ClickUp:** Corresponde a 1 card (task principal). O nome do card é o identificador do caso (ex: nome da marca).

**Exemplo:** Protocolo de Registro da marca "Aquapulse" para o cliente Carlos Mendes.

**Atributos:**
- `id` — identificador único
- `definition_id` — qual YAML de workflow define este caso
- `stage` — em que fase está agora
- `status` — idle, running, hitl, paused, completed, cancelled, failed
- `client_data` — dados do caso (marca, cliente, classes, etc.)
- `contact_phone` — telefone do cliente (link com WhatsApp)
- `conversation_id` — conversa no Vialum Chat
- `external_task_id` — ID do card no ClickUp

**Ciclo de vida:**
```
idle → running → [hitl ↔ running] → completed
                                   → cancelled
                                   → failed
```

**Regras:**
- 1 Workflow = 1 caso = 1 card no ClickUp
- Se o cliente tem 3 marcas, são 3 Workflows
- Um Workflow segue exatamente 1 definition (YAML)

---

### 3.2 Stage

**O que é:** Uma fase macro do processo. Representa uma etapa com objetivo claro que, quando concluída, move o caso visivelmente para a próxima fase.

**Analogia:** Uma coluna no quadro Kanban. Quando o card se move de coluna, mudou de Stage.

**No ClickUp:** Corresponde ao status do card E a uma subtask dentro do card (para rastrear steps internos).

**Exemplo:** "Qualificação", "Contrato e Procuração", "Aguardando Assinatura", "Documentos do Cliente", etc.

**Atributos:**
- `id` — identificador (ex: `qualificacao`)
- `name` — nome legível (ex: "Qualificação")
- `clickup_status` — nome do status correspondente no ClickUp
- `tasks` — lista de Tasks que compõem este Stage
- `position` — ordem no fluxo

**Regras:**
- Stages são **estritamente sequenciais** — cada um depende do anterior
- Um card está em **exatamente 1 Stage** por vez
- Avança de Stage quando todos os Steps do Stage estão concluídos (inclusive o gate)
- O último Step de um Stage geralmente é um **gate** — uma ação humana que libera o avanço

---

### 3.3 Task

**O que é:** Um bloco de trabalho com objetivo específico dentro de um Stage. Agrupa Steps relacionados que trabalham em prol do mesmo objetivo.

**Analogia:** Uma "atividade" ou "entrega" — algo que, quando feito, produz um resultado tangível.

**No ClickUp:** Corresponde a uma sub-subtask (filho da subtask do Stage). Ou, em Stages simples, pode ser equivalente ao próprio Stage.

**Exemplo:** "Coletar dados do cliente" (dentro do Stage Qualificação), "Confeccionar documentos" (dentro do Stage Contrato e Procuração).

**Atributos:**
- `id` — identificador
- `name` — nome legível
- `steps` — lista de Steps que compõem esta Task

**Regras:**
- Tasks dentro de um Stage são geralmente sequenciais, mas podem ser paralelas
- Uma Task pode ter 1 ou muitos Steps
- Em Stages simples (ex: Pagamento GRUs), pode existir apenas 1 Task = o Stage inteiro

---

### 3.4 Step

**O que é:** A unidade rastreável do workflow. É o que aparece no ClickUp como item individual com status, assignee, e tags. É o nível onde o operador interage.

**Analogia:** Uma "tarefa" no sentido clássico — algo que alguém (ou algo) precisa fazer, com início e fim claros.

**No ClickUp:** Corresponde a uma sub-sub-subtask (3o nível de aninhamento). Tem status próprio, assignee, tags.

**Exemplo:** "Enviar mensagem de qualificação no WhatsApp", "Revisar documentos gerados", "Validar comprovante de pagamento".

**Atributos:**
- `id` — identificador
- `name` — nome legível
- `executor` — quem executa: `ai`, `human`, `system`
- `approval` — se precisa de aprovação humana: `required`, `none`
- `wait_for` — se pausa esperando alguém: `client`, `null`
- `assignee` — papel no time responsável: `operador`, `analista`, `financeiro`
- `runtime` — como é executado hoje: `squad`, `langchain`, `script`, `human`
- `migrate_to` — pra onde migrar no futuro
- `gate` — se é o Step que libera avanço de Stage
- `condition` — condição para ser executado (ex: "campos_faltantes.length > 0")
- `loop` — configuração de loop (back_to, max_iterations)
- `follow_up` — configuração de follow-up para Steps com wait_for: client

**Status no ClickUp:**

| Status | Significado | Quem atua |
|--------|-------------|-----------|
| `pendente` | Na fila, ainda não começou | Ninguém |
| `preparando` | IA ou sistema trabalhando | Engine |
| `aprovar` | Esperando humano aprovar/editar | Assignee (tag `aprovar`) |
| `enviado` | Executado/enviado | — |
| `aguardando-cliente` | Bola com o cliente | Engine monitora |
| `concluido` | Feito | — |
| `rejeitado` | Humano rejeitou, volta pra preparando | Engine |

**Regras:**
- 1 Step = 1 item rastreável no ClickUp
- Cada Step tem exatamente 1 executor principal
- Se tem `approval: required`, o Step recebe tag `aprovar` e assignee no ClickUp
- Se tem `wait_for: client`, o Step recebe tag `aguardando-cliente`
- Steps dentro de uma Task são sequenciais (exceto quando condition/loop indica diferente)

**Princípio fundamental:**

> **Step = menor unidade que faz sentido pausar para um humano avaliar.**

---

### 3.5 Action

**O que é:** Uma operação atômica dentro de um Step. É o que o engine executa internamente, sem que o operador veja cada uma individualmente.

**Analogia:** Os "micro-passos" de um Step. Se o Step é "Enviar mensagem de qualificação", as Actions são: preparar mensagem, aprovar, enviar, aguardar resposta.

**No ClickUp:** **Invisível.** O operador vê o Step mudar de status conforme as Actions avançam, mas não vê as Actions individualmente. A exceção são Actions humanas (HITL), que manifestam-se como status `aprovar` do Step.

**Exemplo:**

```
Step: "Enviar mensagem de qualificação no WhatsApp"

  Actions internas:
    1. Ler dados do card (system)
    2. Preparar mensagem personalizada (ai)
    3. Aprovar/editar mensagem (human — HITL)
    4. Enviar via WhatsApp (system)
```

**Atributos:**
- `id` — identificador
- `executor` — `ai`, `human`, `system`, `wait`
- `description` — o que faz
- `tools` — quais APIs/ferramentas usa

**Regras:**
- Actions são **sempre sequenciais** dentro de um Step
- O engine gerencia Actions internamente
- O operador nunca interage diretamente com uma Action — ele interage com o Step (via status)
- A Action do tipo `human` (HITL) causa a mudança de status do Step para `aprovar`
- Quando o humano aprova, o engine continua com as Actions seguintes

---

## 4. Como os níveis se relacionam

```
WORKFLOW: Protocolo de Registro — Aquapulse (Carlos Mendes)
│
├── STAGE: Qualificação                        ← status do card no ClickUp
│   │
│   └── TASK: Coletar dados do cliente         ← sub-subtask no ClickUp
│       │
│       ├── STEP: Preencher termos             ← sub-sub-subtask no ClickUp
│       │   └── ACTION: preencher (human)         [invisível no ClickUp]
│       │
│       ├── STEP: Enviar msg qualificação      ← sub-sub-subtask no ClickUp
│       │   ├── ACTION: ler dados (system)        [invisível]
│       │   ├── ACTION: preparar msg (ai)         [invisível]
│       │   ├── ACTION: aprovar msg (human/HITL)  [status: "aprovar"]
│       │   ├── ACTION: enviar (system)           [status: "enviado"]
│       │   └── ACTION: aguardar (wait)           [status: "aguardando-cliente"]
│       │
│       ├── STEP: Interpretar respostas        ← sub-sub-subtask no ClickUp
│       │   └── ACTION: interpretar (ai)          [invisível]
│       │
│       ├── STEP: Consolidar no ClickUp        ← sub-sub-subtask no ClickUp
│       │   └── ACTION: atualizar card (system)   [invisível]
│       │
│       └── STEP: Revisar dados (gate)         ← sub-sub-subtask no ClickUp
│           └── ACTION: revisar (human)           [assignee: operador]
│
├── STAGE: Contrato e Procuração
│   └── ...
│
└── ...
```

### Mapeamento no ClickUp

| Nível | No ClickUp | Visível pra quem |
|-------|-----------|------------------|
| Workflow | Card (task principal) | Todo mundo |
| Stage | Status do card + Subtask | Todo mundo (coluna do board) |
| Task | Sub-subtask | Todo mundo |
| Step | Sub-sub-subtask | Operador (My Tasks) |
| Action | Invisível (engine interno) | Ninguém (só engine) |

---

## 5. HITL — Human-in-the-Loop

### 5.1 O que é HITL no Vialum Tasks

HITL é o momento em que o workflow **pausa** e espera uma **decisão humana** antes de prosseguir. No Vialum Tasks, existem dois tipos de HITL:

**HITL de aprovação:** A IA preparou algo (mensagem, documento, guia de dados) e precisa que um humano revise e aprove antes de efetivar a ação.

**HITL de ação direta:** O humano faz a ação ele mesmo (revisar contrato, analisar estratégia, protocolar no INPI).

### 5.2 Padrão de HITL de aprovação

Toda vez que a IA precisa enviar algo para o cliente (mensagem, documento, GRU), o padrão é:

```
IA prepara  →  Humano aprova/edita  →  Sistema envia  →  Aguarda cliente
   (ai)           (human/HITL)          (system)          (wait)
```

Esse padrão se repete **12 vezes** no workflow de protocolo de registro. É sempre o mesmo ciclo.

### 5.3 Como HITL aparece no ClickUp

Quando um Step entra em modo HITL:

1. O engine muda o status da sub-sub-subtask para `aprovar`
2. O engine adiciona a tag `aprovar`
3. O engine seta o assignee (ex: Luan Mendes)
4. O engine posta um comentário no card com o conteúdo a ser aprovado

O operador:
1. Abre ClickUp → filtra "My Tasks" → vê os Steps com status `aprovar`
2. Lê o comentário com o conteúdo preparado pela IA
3. Decide: **aprovar** (muda status para `aprovado`), **editar** (comenta com texto correto), ou **rejeitar** (muda status para `rejeitado`)

O engine detecta a mudança e continua.

### 5.4 Decisões humanas

| Decisão | O que acontece |
|---------|----------------|
| **Aprovar** | Engine executa a ação (envia mensagem, etc.) |
| **Editar** | Engine usa o texto editado pelo humano em vez do original |
| **Rejeitar** | Engine volta para a Action de preparação (IA refaz) |

### 5.5 Filtragem por assignee e tag

O ClickUp suporta filtragem de sub-sub-subtasks por assignee e por tag. Isso foi **testado e confirmado via API**:

```
GET /team/{teamId}/task?assignees[]={userId}&tags[]=aprovar&subtasks=true
→ Retorna só os Steps atribuídos ao operador com tag "aprovar"
```

O operador Luan vê apenas o que precisa dele. Limpo, sem ruído.

---

## 6. Wait for — Quando a bola está com o cliente

### 6.1 O que é

Muitos Steps envolvem esperar o cliente responder: enviar dados, enviar documentos, assinar contrato, pagar GRU, aprovar proposta. O workflow não pode ficar "rodando" enquanto espera — ele **pausa** com status `aguardando-cliente`.

### 6.2 Follow-up automático

Quando um Step está em `wait_for: client`, o engine ativa follow-ups automáticos:

```yaml
follow_up:
  schedule: [1, 3, 5]     # dias após envio
  skip_weekends: true
  max_attempts: 5
  escalate_after: 10       # dias sem resposta → notifica operador
```

Cada follow-up segue o mesmo padrão HITL: IA prepara lembrete → humano aprova → sistema envia.

### 6.3 Detecção de resposta

O engine monitora a conversa do cliente (via Vialum Chat) e o card no ClickUp. Quando detecta:
- Mensagem nova do cliente → `interpretar respostas` (ai)
- Media recebida → `classificar documento` (ai via Classification Hub / Switch)
- Status mudou no ClickUp → reagir ao evento

---

## 7. Executores — Quem faz o quê

### 7.1 ai — Inteligência Artificial

Usa LLM (squad/LangChain) para tarefas que exigem interpretação, geração de texto, ou decisão baseada em contexto.

**Exemplos:**
- Preparar mensagem de qualificação personalizada
- Interpretar respostas do cliente e extrair dados
- Classificar documento recebido (RG? CNH? Comprovante?)
- Preparar dados mastigados para operador copiar/colar no e-INPI
- Formatar proposta de depósito para envio

**Custo:** ~$0.02-0.10 por execução (depende do modelo)

**Migração:** Pode migrar para `script` quando o processo se estabiliza.

### 7.2 human — Pessoa do time

Trabalho que exige julgamento humano, expertise, ou acesso a sistemas sem API.

**Exemplos:**
- Revisar contrato gerado
- Validar assinatura nos documentos
- Analisar estratégia de depósito (decisão jurídica)
- Cadastrar titular no e-INPI (sistema do governo)
- Validar comprovante de pagamento

**Papéis no time:**

| Papel | Quem | Tipo de trabalho |
|-------|------|-----------------|
| `operador` | contato@avelumia.com | Revisão, aprovação, INPI manual |
| `analista` | (definir) | Análise estratégica, propostas |
| `financeiro` | (definir) | Validação de pagamentos |

### 7.3 system — Automação determinística

Código que sempre faz a mesma coisa, sem LLM. API calls, scripts, upload de arquivos.

**Exemplos:**
- Gerar PDFs (assemble_contract.py)
- Upload no Google Drive
- Atualizar custom fields no ClickUp
- Enviar mensagem via Vialum Chat API (após aprovação)
- Anexar documentos no card ClickUp

**Custo:** $0.00 por execução

---

## 8. O engine — Como funciona

### 8.1 O loop principal

O engine roda periodicamente (cron a cada 5-30 min) ou em resposta a eventos (webhooks). Para cada Workflow ativo:

```
1. Ler YAML da definition
2. Consultar ClickUp (1 chamada, subtasks=true) → estado atual
3. Identificar próximo Step executável:
   - Status == pendente
   - Steps anteriores == concluído
   - Conditions avaliadas como true
4. Despachar por executor:
   - ai → squad prepara
   - human → garantir assignee, esperar
   - system → executar API call
5. Se HITL → pausar, aguardar decisão humana
6. Se wait_for: client → configurar follow-up, pausar
7. Se gate concluído → mover card pro próximo Stage
8. Atualizar ClickUp (status, tags, comentários, assignee)
```

### 8.2 Triggers

| Trigger | Quando | O que faz |
|---------|--------|-----------|
| **Cron** | A cada N minutos | Varre todos os workflows ativos |
| **Webhook ClickUp** | Status/subtask mudou | Reage a ação do operador |
| **Webhook Chat** | Cliente enviou mensagem/media | Reage a resposta do cliente |

### 8.3 Execução via Squad

No MVP, o engine é um **Squad AIOS** (`@registro`). O operador roda no terminal:

```bash
@registro *processar       # avança tudo que puder
@registro *status          # mostra estado de todos os cards
@registro *iniciar "Marca" "Cliente"  # cria novo workflow
```

O squad lê o YAML, consulta o ClickUp, decide o que fazer, executa, e atualiza. É o "cérebro" rodando via Claude Code CLI.

No futuro, pode migrar para um serviço standalone (Vialum Tasks engine) com cron na VPS.

---

## 9. Separação de responsabilidades

### 9.1 Ecossistema Vialum

```
┌──────────────────────────────────────────────────────────┐
│ Vialum Tasks (cérebro)                                    │
│   Sabe: workflow, stages, steps, HITL, decisões           │
│   Faz: orquestra, delega, decide, avança                  │
└───────────┬──────────┬──────────┬──────────┬─────────────┘
            │          │          │          │
            ▼          ▼          ▼          ▼
      ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
      │ CRM Hub  │ │ Vialum │ │ Media  │ │  Switch  │
      │          │ │ Chat   │ │Service │ │          │
      │ Registra │ │ Envia  │ │ Upload │ │ Classif. │
      │ Estado   │ │ Msgs   │ │ Docs   │ │ OCR      │
      │ Sync CRM │ │ Recebe │ │ S3     │ │ Transcrv │
      └──────────┘ └────────┘ └────────┘ └──────────┘
```

| Serviço | Filosofia | Pergunta que responde |
|---------|-----------|----------------------|
| **Tasks** | Decisão e orquestração | "O que fazer a seguir?" |
| **Hub** | Registro e estado | "O que esse contato/caso tem?" |
| **Chat** | Comunicação | "O que o cliente disse?" |
| **Media** | Storage | "Onde está esse arquivo?" |
| **Switch** | Processamento | "O que é esse documento?" |

### 9.2 Regras de separação

- **Tasks nunca fala direto com ClickUp** — sempre via Hub
- **Hub não sabe o que é workflow** — só registra fatos
- **Hub emite fatos** ("document.received") → **Tasks consome e decide**
- **Chat não sabe o que é protocolo** — só envia/recebe mensagens
- **Switch não sabe o que é RG** — só classifica media genericamente

---

## 10. Modelo cimento — Migração progressiva

### 10.1 Os 3 níveis de maturidade

| Nível | Nome | Runtime | Custo | Quando usar |
|-------|------|---------|-------|-------------|
| 1 | Molhado | Squad (Claude Code) | ~$0.10/exec | Processo novo, descobrindo edge cases |
| 2 | Úmido | LangChain (prompt fixo) | ~$0.02/exec | Processo estável, precisa de LLM |
| 3 | Seco | Script/API | ~$0.00/exec | Processo 100% previsível |

### 10.2 Regra de migração

> Um Step migra quando o humano **para de editar o output da IA** por 20 execuções consecutivas.

Se o operador aprova sem editar 20 vezes seguidas, o processo é previsível o suficiente para fixar em prompt template (LangChain) ou script.

### 10.3 O engine é agnóstico de runtime

```yaml
- step: enviar-msg-qualificacao
  executor: ai
  runtime: squad             # como executa HOJE
  migrate_to: langchain      # próximo nível planejado
  migrate_when: "20+ execuções sem edição"
```

O YAML define **o quê** fazer. O `runtime` define **como**. Trocar o runtime não muda o workflow.

### 10.4 Fases de migração

```
Fase 1 (semanas 1-4): Tudo squad
  → Descobrir o processo, ajustar prompts

Fase 2 (mês 2-3): Steps estáveis → LangChain
  → Msg de qualificação, follow-ups, msg de conclusão
  → Custo cai 80%

Fase 3 (mês 3-4): Steps determinísticos → Script
  → Extração de CPF/CNPJ (regex), classificação (Hub), templates
  → Custo cai pra zero

Fase 4 (futuro): Automação INPI via Playwright
  → Cadastrar titular, gerar GRUs, protocolar
  → Maior impacto em redução de trabalho humano
```

---

## 11. Posicionamento — Por que isso é diferente

### 11.1 vs Frameworks de agentes (LangGraph, CrewAI, AutoGen)

Esses frameworks focam em **agentes autônomos para desenvolvedores**. O Vialum Tasks foca em **processos auditáveis para operações**. A diferença fundamental:

- Eles: agente decide o fluxo em runtime
- Vialum: fluxo é declarativo, engine impõe, agente não pode pular aprovação

### 11.2 vs Workflow engines (Temporal, Prefect, Airflow)

Esses são **workflow-as-code** — você escreve o fluxo em Python/Go. O Vialum Tasks é **workflow-as-YAML** — não precisa de dev para modificar o processo.

### 11.3 vs BPMN (ISO 19510)

O BPMN é de 2011 e distingue User Task vs Service Task. O Vialum Tasks adiciona IA como terceiro executor e HITL como aprovação dentro de Steps de IA. É essencialmente **BPMN 3.0 para a era de agentes**.

### 11.4 vs ClickUp/Jira/Linear

Esses são **ferramentas de project management**. Não sabem executar nada — só rastreiam. O Vialum Tasks **executa**: prepara mensagens, envia WhatsApp, classifica documentos, gera PDFs. O ClickUp é usado como UI visual, não como engine.

### 11.5 vs OpenClaw

O OpenClaw é um assistente conversacional que executa skills pontuais. Não tem conceito de workflow, HITL formal, ou estado persistente de processo. E a comunidade reporta problemas de segurança e autonomia excessiva (agente ignorando confirmações).

---

## 12. Base acadêmica

A taxonomia e filosofia do Vialum Tasks foram fundamentadas em pesquisa de 12 papers acadêmicos e 10 frameworks de mercado. O estudo completo está em:

`prds-projeto/ESTUDO-HITL-TAXONOMIA-WORKFLOWS.md`

Principais referências:

| Paper/Fonte | Contribuição para o Vialum Tasks |
|-------------|----------------------------------|
| Zou et al. (2025) — LLM-Based Human-Agent Collaboration Survey | Taxonomia de 5 dimensões para HITL |
| Masters et al. (2025) — Orchestrating Human-AI Teams | Manager Agent e task graphs |
| Anthropic (2025) — Measuring Agent Autonomy | Progressive autonomy (approval → monitoring) |
| Knight/Columbia — Levels of Autonomy | 5 papéis humanos (operator → observer) |
| BPMN 2.0 (ISO 19510) | Process > Sub-Process > Task, User Task vs Service Task |

---

## 13. Documentos relacionados

| Documento | O que contém |
|-----------|-------------|
| `ESTUDO-HITL-TAXONOMIA-WORKFLOWS.md` | Pesquisa acadêmica + frameworks de mercado |
| `TAXONOMIA-WORKFLOW-PROTOCOLO-REGISTRO.md` | Taxonomia aplicada ao workflow de protocolo |
| `WORKFLOW-ENGINE-PROTOCOLO.md` | YAML completo do workflow + design do engine |
| `PROPOSTA-SQUAD-REGISTRO.md` | Proposta de squads (orquestrador + sub-squads) |
| `PLANO-IMPLEMENTACAO-SQUAD-REGISTRO.md` | Plano de execução em 12 fases |
| `ANALISE-STEPS-EXECUTORES.md` | Análise de cada step com executor, HITL, gaps |

Todos em `vialum-intelligence/prds-projeto/`.

---

*Este documento é a referência central da filosofia e taxonomia do Vialum Tasks. Todos os outros documentos derivam dele.*
