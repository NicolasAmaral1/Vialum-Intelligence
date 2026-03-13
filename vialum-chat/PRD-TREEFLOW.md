Now I have a complete understanding of the existing PRD. Let me design the comprehensive TreeFlow/TalkFlow addendum.


---

# PRD Addendum — TreeFlow/TalkFlow: Motor de Conversas Inteligentes

## Documento Tecnico de Design — Vialum Chat v1.5

**Versao:** 1.0.0
**Data:** 2026-03-02
**Status:** Draft
**Dependencia:** PRD Vialum Chat v1.0.0


---

## 1. Modelo de Dados

### 1.1 Novas Tabelas — DDL SQL

```sql
-- ============================================================
-- vialum-chat — 002_treeflow.sql
-- TreeFlow/TalkFlow engine tables
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABELA: tree_flows
-- Template/blueprint imutavel de uma arvore de conversa.
-- Cada tree_flow tem versoes (tree_flow_versions).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tree_flows (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            VARCHAR(255)  NOT NULL,
  slug            VARCHAR(100)  NOT NULL,          -- URL-friendly: 'onboarding-marca'
  description     TEXT,
  category        VARCHAR(100),                     -- sales | support | onboarding | custom
  active_version_id UUID,                           -- FK preenchido apos primeira versao
  settings        JSONB         NOT NULL DEFAULT '{}',
  -- settings: {
  --   auto_mode_enabled: bool,
  --   confidence_threshold: number (0.0-1.0),  -- acima = auto-send, abaixo = HITL
  --   inactivity_timeout_minutes: number,       -- default: 1440 (24h)
  --   max_objection_retries: number,            -- default: 3
  --   allow_sub_treeflows: bool,
  --   default_labels: UUID[],                   -- labels auto-aplicadas ao criar Talk
  -- }
  is_archived     BOOLEAN       NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tree_flows_account ON tree_flows (account_id);
CREATE INDEX IF NOT EXISTS idx_tree_flows_slug    ON tree_flows (account_id, slug);

DROP TRIGGER IF EXISTS trg_tree_flows_updated_at ON tree_flows;
CREATE TRIGGER trg_tree_flows_updated_at
  BEFORE UPDATE ON tree_flows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: tree_flow_versions
-- Versoes imutaveis de um TreeFlow. Suporte a A/B testing.
-- Uma vez publicada, a versao NAO pode ser alterada (append-only).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tree_flow_versions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_flow_id    UUID          NOT NULL REFERENCES tree_flows(id) ON DELETE CASCADE,
  version_number  INTEGER       NOT NULL,          -- 1, 2, 3...
  status          VARCHAR(50)   NOT NULL DEFAULT 'draft',
  -- draft | published | deprecated
  definition      JSONB         NOT NULL,
  -- definition: TreeFlowDefinition (ver TypeScript interface abaixo)
  -- Contem: steps[], transitions[], initial_step_id
  ab_weight       INTEGER       NOT NULL DEFAULT 100,  -- peso para A/B: 0-100
  -- Quando ha 2 versoes published, weight controla distribuicao
  notes           TEXT,                             -- changelog da versao
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(tree_flow_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_tree_flow_versions_tree_flow ON tree_flow_versions (tree_flow_id);
CREATE INDEX IF NOT EXISTS idx_tree_flow_versions_status    ON tree_flow_versions (status);

DROP TRIGGER IF EXISTS trg_tree_flow_versions_updated_at ON tree_flow_versions;
CREATE TRIGGER trg_tree_flow_versions_updated_at
  BEFORE UPDATE ON tree_flow_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Agora adicionar FK para active_version_id
ALTER TABLE tree_flows
  ADD CONSTRAINT fk_tree_flows_active_version
  FOREIGN KEY (active_version_id) REFERENCES tree_flow_versions(id);

-- ────────────────────────────────────────────────────────────
-- TABELA: objections
-- Banco de objecoes por account. TreeFlows referenciam por ID.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objections (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            VARCHAR(255)  NOT NULL,          -- 'preco-alto', 'sem-urgencia'
  category        VARCHAR(100),                     -- price | timing | trust | competitor | custom
  description     TEXT,                             -- descricao humana da objecao
  detection_hints JSONB         NOT NULL DEFAULT '[]',
  -- detection_hints: string[]
  -- Frases/palavras-chave que indicam essa objecao:
  -- ["muito caro", "nao tenho dinheiro", "valor alto"]
  rebuttal_strategy TEXT,                           -- estrategia de contra-argumento
  rebuttal_examples JSONB       NOT NULL DEFAULT '[]',
  -- rebuttal_examples: string[]
  -- Exemplos de respostas para essa objecao
  severity        VARCHAR(50)   NOT NULL DEFAULT 'medium',
  -- low | medium | high | critical
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_objections_account  ON objections (account_id);
CREATE INDEX IF NOT EXISTS idx_objections_category ON objections (category);

DROP TRIGGER IF EXISTS trg_objections_updated_at ON objections;
CREATE TRIGGER trg_objections_updated_at
  BEFORE UPDATE ON objections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: tree_flow_objections
-- Vincula TreeFlow a objecoes que ele sabe tratar.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tree_flow_objections (
  tree_flow_id    UUID          NOT NULL REFERENCES tree_flows(id) ON DELETE CASCADE,
  objection_id    UUID          NOT NULL REFERENCES objections(id) ON DELETE CASCADE,
  step_ids        JSONB         NOT NULL DEFAULT '[]',
  -- step_ids: string[] — em quais steps essa objecao e relevante (vazio = todos)
  priority        INTEGER       NOT NULL DEFAULT 0,  -- ordem de prioridade
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tree_flow_id, objection_id)
);

CREATE INDEX IF NOT EXISTS idx_tfo_tree_flow ON tree_flow_objections (tree_flow_id);
CREATE INDEX IF NOT EXISTS idx_tfo_objection ON tree_flow_objections (objection_id);

-- ────────────────────────────────────────────────────────────
-- TABELA: talks
-- Sessao de conversa com um contato, governada por um TreeFlow.
-- Um contato pode ter multiplos Talks simultaneos.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talks (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id   UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id        UUID          NOT NULL REFERENCES contacts(id),
  tree_flow_id      UUID          NOT NULL REFERENCES tree_flows(id),
  tree_flow_version_id UUID      NOT NULL REFERENCES tree_flow_versions(id),
  parent_talk_id    UUID          REFERENCES talks(id),  -- Talk pai (quando e sub-Talk)
  status            VARCHAR(50)   NOT NULL DEFAULT 'active',
  -- active | paused | completed | closed_inactivity | closed_manual | archived
  priority          INTEGER       NOT NULL DEFAULT 0,    -- stack ordering
  metadata          JSONB         NOT NULL DEFAULT '{}',
  -- metadata: { trigger_source, trigger_message_id, ab_variant, ... }
  started_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paused_at         TIMESTAMPTZ,
  resumed_at        TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  last_activity_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  inactivity_timeout_minutes INTEGER NOT NULL DEFAULT 1440,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talks_account       ON talks (account_id);
CREATE INDEX IF NOT EXISTS idx_talks_conversation  ON talks (conversation_id);
CREATE INDEX IF NOT EXISTS idx_talks_contact       ON talks (contact_id);
CREATE INDEX IF NOT EXISTS idx_talks_tree_flow     ON talks (tree_flow_id);
CREATE INDEX IF NOT EXISTS idx_talks_status        ON talks (status);
CREATE INDEX IF NOT EXISTS idx_talks_parent        ON talks (parent_talk_id);
CREATE INDEX IF NOT EXISTS idx_talks_active        ON talks (contact_id, status) WHERE status IN ('active', 'paused');
CREATE INDEX IF NOT EXISTS idx_talks_inactivity    ON talks (last_activity_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_talks_updated_at ON talks;
CREATE TRIGGER trg_talks_updated_at
  BEFORE UPDATE ON talks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: talk_flows
-- Estado runtime mutavel de um Talk. Uma row por Talk (1:1).
-- Armazena o progresso do lead dentro do TreeFlow.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talk_flows (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_id         UUID          NOT NULL UNIQUE REFERENCES talks(id) ON DELETE CASCADE,
  current_step_id VARCHAR(100)  NOT NULL,          -- ID do step atual no TreeFlow definition
  state           JSONB         NOT NULL DEFAULT '{}',
  -- state: TalkFlowState (ver TypeScript interface)
  -- Contem: filled_actions, collected_inputs, step_history, variables
  objections_encountered JSONB  NOT NULL DEFAULT '[]',
  -- objections_encountered: Array<{ objection_id, step_id, timestamp, resolved }>
  escape_attempts INTEGER       NOT NULL DEFAULT 0,
  confidence_history JSONB      NOT NULL DEFAULT '[]',
  -- confidence_history: Array<{ step_id, confidence, timestamp, auto_sent }>
  snapshot        JSONB,                            -- snapshot completo ao fechar (para resume futuro)
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talk_flows_talk ON talk_flows (talk_id);

DROP TRIGGER IF EXISTS trg_talk_flows_updated_at ON talk_flows;
CREATE TRIGGER trg_talk_flows_updated_at
  BEFORE UPDATE ON talk_flows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: talk_events
-- Audit log imutavel de todas as mudancas de estado de um Talk.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talk_events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_id         UUID          NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  event_type      VARCHAR(100)  NOT NULL,
  -- talk_created | step_entered | step_completed | action_filled |
  -- objection_detected | objection_resolved | escape_attempt |
  -- message_routed | auto_sent | hitl_queued | hitl_approved | hitl_rejected |
  -- talk_paused | talk_resumed | talk_completed | talk_closed_inactivity |
  -- sub_talk_spawned | sub_talk_returned | confidence_recorded |
  -- treeflow_switched | agent_override
  data            JSONB         NOT NULL DEFAULT '{}',
  -- data: payload especifico do event_type
  actor_type      VARCHAR(50)   NOT NULL DEFAULT 'system',
  -- system | ai | agent | automation
  actor_id        UUID,                             -- user_id se agent
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talk_events_talk       ON talk_events (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_events_type       ON talk_events (event_type);
CREATE INDEX IF NOT EXISTS idx_talk_events_created_at ON talk_events (created_at DESC);

-- ────────────────────────────────────────────────────────────
-- TABELA: talk_messages
-- Vincula mensagens a Talks especificos (roteamento).
-- Uma mensagem pode pertencer a um Talk (ou nenhum, se pre-Talk).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talk_messages (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_id         UUID          NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  message_id      UUID          NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  routing_confidence NUMERIC(3,2),  -- 0.00 a 1.00: confianca do roteamento
  routed_by       VARCHAR(50)   NOT NULL DEFAULT 'ai',
  -- ai | manual | system (auto quando so ha 1 talk)
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(message_id)  -- cada mensagem pertence a no maximo 1 Talk
);

CREATE INDEX IF NOT EXISTS idx_talk_messages_talk    ON talk_messages (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_messages_message ON talk_messages (message_id);
```

### 1.2 Modificacoes em Tabelas Existentes

```sql
-- ────────────────────────────────────────────────────────────
-- ALTERACAO: conversations
-- Adicionar referencia ao Talk ativo da conversa.
-- ────────────────────────────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS active_talk_id UUID REFERENCES talks(id);

CREATE INDEX IF NOT EXISTS idx_conversations_active_talk
  ON conversations (active_talk_id) WHERE active_talk_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- ALTERACAO: ai_suggestions
-- Vincular sugestoes a Talks especificos.
-- ────────────────────────────────────────────────────────────
ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS talk_id UUID REFERENCES talks(id),
  ADD COLUMN IF NOT EXISTS talk_step_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS auto_mode BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_talk
  ON ai_suggestions (talk_id) WHERE talk_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- ALTERACAO: automation_rules
-- Novos eventos e acoes para TreeFlow.
-- ────────────────────────────────────────────────────────────
-- Nenhuma alteracao de schema necessaria:
-- Novos event_names: 'talk_created', 'talk_step_changed', 'talk_completed'
-- Nova acao type: 'create_talk' com params: { tree_flow_slug }
-- Tudo suportado pelo JSONB existente.
```

### 1.3 TypeScript Interfaces

```typescript
// ============================================================
// src/modules/treeflow/treeflow.types.ts
// ============================================================

// ── TreeFlow Definition (stored in tree_flow_versions.definition) ──

export interface TreeFlowDefinition {
  initial_step_id: string;
  steps: TreeFlowStep[];
  global_instructions?: string;  // instrucoes que valem para TODOS os steps
}

export interface TreeFlowStep {
  id: string;                     // ex: 'abertura', 'qualificacao', 'proposta'
  name: string;                   // nome legivel
  description?: string;
  type: 'standard' | 'decision' | 'closing' | 'handoff';
  instructions: string;           // instrucoes especificas para a IA neste step
  actions: TreeFlowAction[];      // acoes/informacoes a coletar neste step
  transitions: TreeFlowTransition[];
  max_messages_in_step?: number;  // limite de msgs antes de forcar transicao
  labels_to_apply?: string[];     // label IDs para auto-aplicar ao entrar neste step
  sub_treeflow_slug?: string;     // se preenchido, spawna sub-Talk ao entrar
}

export interface TreeFlowAction {
  id: string;                     // ex: 'nome_marca', 'cnpj', 'classes_inpi'
  name: string;
  type: 'text_input' | 'choice' | 'confirmation' | 'file_upload' | 'custom';
  required: boolean;
  validation?: {
    pattern?: string;             // regex
    min_length?: number;
    max_length?: number;
    options?: string[];           // para type 'choice'
  };
  extraction_hint: string;        // instrucao para a IA extrair do texto do lead
}

export interface TreeFlowTransition {
  id: string;
  target_step_id: string;
  condition: TransitionCondition;
  priority: number;               // menor = avaliado primeiro
}

export interface TransitionCondition {
  type: 'all_actions_filled' | 'specific_action_filled' | 'choice_selected'
      | 'objection_resolved' | 'escape_detected' | 'manual' | 'always';
  params?: Record<string, unknown>;
  // Exemplos:
  //   { type: 'specific_action_filled', params: { action_id: 'cnpj' } }
  //   { type: 'choice_selected', params: { action_id: 'tipo_servico', value: 'registro' } }
}

// ── TalkFlow State (stored in talk_flows.state) ──

export interface TalkFlowState {
  filled_actions: Record<string, TalkFlowFilledAction>;
  // key = action_id, value = dados preenchidos
  step_history: TalkFlowStepEntry[];
  variables: Record<string, unknown>;  // variaveis computadas durante o fluxo
  messages_in_current_step: number;
}

export interface TalkFlowFilledAction {
  value: unknown;
  filled_at: string;           // ISO timestamp
  source_message_id?: string;  // mensagem de onde foi extraido
  confidence: number;          // confianca da extracao
  confirmed: boolean;          // lead confirmou explicitamente?
}

export interface TalkFlowStepEntry {
  step_id: string;
  entered_at: string;
  exited_at?: string;
  exit_reason?: 'transition' | 'sub_treeflow' | 'agent_override' | 'timeout';
}

// ── AI Analysis Response (structured JSON from LLM) ──

export interface TreeFlowAIResponse {
  message_analysis: {
    intent: string;                // 'answer' | 'question' | 'objection' | 'escape' | 'off_topic' | 'greeting'
    sentiment: 'positive' | 'neutral' | 'negative';
    summary: string;               // resumo de 1 linha do que o lead disse
  };
  extracted_data: Record<string, {
    value: unknown;
    confidence: number;            // 0.0 - 1.0
  }>;
  objection_detected?: {
    objection_id: string;          // ID da objecao identificada
    confidence: number;
  };
  escape_detected: boolean;
  step_transition?: {
    target_step_id: string;
    reason: string;
  };
  suggested_response: {
    content: string;
    confidence: number;            // confianca geral da resposta
    reasoning: string;             // explicacao interna (nao enviada ao lead)
  };
  state_diff: {
    filled_actions?: Record<string, {
      value: unknown;
      confidence: number;
    }>;
    variables?: Record<string, unknown>;
  };
}

// ── Talk Entity ──

export type TalkStatus = 'active' | 'paused' | 'completed' | 'closed_inactivity' | 'closed_manual' | 'archived';

export interface Talk {
  id: string;
  account_id: string;
  conversation_id: string;
  contact_id: string;
  tree_flow_id: string;
  tree_flow_version_id: string;
  parent_talk_id?: string;
  status: TalkStatus;
  priority: number;
  metadata: Record<string, unknown>;
  started_at: string;
  paused_at?: string;
  resumed_at?: string;
  closed_at?: string;
  last_activity_at: string;
  inactivity_timeout_minutes: number;
}

// ── Talk Event Types ──

export type TalkEventType =
  | 'talk_created'
  | 'step_entered'
  | 'step_completed'
  | 'action_filled'
  | 'objection_detected'
  | 'objection_resolved'
  | 'escape_attempt'
  | 'message_routed'
  | 'auto_sent'
  | 'hitl_queued'
  | 'hitl_approved'
  | 'hitl_rejected'
  | 'talk_paused'
  | 'talk_resumed'
  | 'talk_completed'
  | 'talk_closed_inactivity'
  | 'sub_talk_spawned'
  | 'sub_talk_returned'
  | 'confidence_recorded'
  | 'treeflow_switched'
  | 'agent_override';

// ── Message Routing ──

export interface MessageRoutingResult {
  talk_id: string;
  confidence: number;
  reasoning: string;
}
```


---

## 2. TreeFlow Engine Architecture

### 2.1 Diagrama do Pipeline

```
Mensagem Incoming (webhook:process worker — ja existente)
    |
    v
[1] TALK ROUTER  ──────────────────────────────────────────────
    |  Input: message, contact_id, conversation_id
    |  Busca: talks ativos/pausados do contact
    |
    ├── 0 talks ativos → mensagem nao pertence a nenhum Talk
    |                     (segue fluxo normal do PRD existente)
    |
    ├── 1 talk ativo   → roteamento automatico (confidence: 1.0)
    |
    └── 2+ talks       → chama AI Router (prompt leve)
                          retorna: { talk_id, confidence, reasoning }
    |
    v
[2] TALKFLOW LOADER  ──────────────────────────────────────────
    |  Carrega:
    |    - Talk + TalkFlow (estado atual)
    |    - TreeFlow definition (versao ativa)
    |    - Objecoes vinculadas ao TreeFlow
    |    - Ultimas N mensagens do Talk (via talk_messages)
    |    - Dados do contato
    |
    v
[3] AI ANALYZER  ──────────────────────────────────────────────
    |  Monta prompt (system + context + user message)
    |  Chama LLM (GPT-5.1-mini)
    |  Recebe: TreeFlowAIResponse (JSON estruturado)
    |
    v
[4] STATE APPLIER  ─────────────────────────────────────────────
    |  Aplica state_diff no TalkFlow:
    |    - Preenche actions extraidas
    |    - Registra objecao se detectada
    |    - Incrementa escape_attempts se escape detectado
    |    - Avalia transitions do step atual
    |    - Se transition matched → muda current_step_id
    |  Grava: talk_flows UPDATE + talk_events INSERT
    |
    v
[5] DECISION GATE  ─────────────────────────────────────────────
    |
    ├── confidence >= threshold → AUTO MODE
    |   |  Cria ai_suggestion com auto_mode=true, status='sent'
    |   |  Enfileira message:send
    |   |  Emite WebSocket: talk:auto_sent
    |   |  Registra talk_event: auto_sent
    |
    └── confidence < threshold  → HITL MODE
        |  Cria ai_suggestion com auto_mode=false, status='pending'
        |  Emite WebSocket: ai_suggestion:created + talk:hitl_queued
        |  Registra talk_event: hitl_queued
    |
    v
[6] POST-PROCESSING  ──────────────────────────────────────────
    |  - Se step mudou: emite talk:step_changed via WebSocket
    |  - Se step tem sub_treeflow_slug: spawna sub-Talk (Talk pai → paused)
    |  - Se step type='closing' e todas acoes filled: mark talk completed
    |  - Atualiza talk.last_activity_at
    |  - Atualiza conversation.active_talk_id se necessario
    |  - Aplica labels do step (se configurado)
```

### 2.2 Estrutura de Diretorios (novos modulos)

```
src/modules/
├── treeflow/
│   ├── treeflow.routes.ts
│   ├── treeflow.service.ts
│   ├── treeflow.schema.ts
│   └── treeflow.types.ts          -- interfaces acima
├── talks/
│   ├── talks.routes.ts
│   ├── talks.service.ts
│   ├── talks.schema.ts
│   └── talks.types.ts
├── talk-engine/
│   ├── engine.ts                  -- orquestrador principal (pipeline [1]-[6])
│   ├── router.ts                  -- [1] Talk Router
│   ├── loader.ts                  -- [2] TalkFlow Loader
│   ├── analyzer.ts                -- [3] AI Analyzer
│   ├── state-applier.ts           -- [4] State Applier
│   ├── decision-gate.ts           -- [5] Decision Gate
│   ├── post-processor.ts          -- [6] Post Processing
│   └── prompts/
│       ├── routing.prompt.ts      -- template do prompt de roteamento
│       ├── analysis.prompt.ts     -- template do prompt de analise
│       └── schemas.ts             -- JSON schemas para structured output
└── objections/
    ├── objections.routes.ts
    ├── objections.service.ts
    └── objections.schema.ts
```


---

## 3. Sistema de Prompts da IA

### 3.1 Prompt de Roteamento (Router — Step \[1\])

Usado apenas quando o contato tem 2+ Talks ativos. Prompt leve, resposta rapida.

```typescript
// src/modules/talk-engine/prompts/routing.prompt.ts

export function buildRoutingPrompt(params: {
  message: string;
  talks: Array<{
    talk_id: string;
    tree_flow_name: string;
    current_step_name: string;
    last_messages: string[];  // ultimas 3 msgs do Talk
    status: string;
  }>;
}): string {
  return `
Voce e um roteador de mensagens. O contato tem ${params.talks.length} conversas (Talks) simultaneas.
Analise a mensagem recebida e determine a qual Talk ela pertence.

## Talks ativos:

${params.talks.map((t, i) => `
### Talk ${i + 1}: ${t.tree_flow_name}
- ID: ${t.talk_id}
- Step atual: ${t.current_step_name}
- Status: ${t.status}
- Ultimas mensagens:
${t.last_messages.map(m => `  > ${m}`).join('\n')}
`).join('\n')}

## Mensagem recebida:
"${params.message}"

Responda APENAS em JSON:
{
  "talk_id": "UUID do Talk mais provavel",
  "confidence": 0.0 a 1.0,
  "reasoning": "explicacao curta de por que este Talk"
}
`.trim();
}
```

### 3.2 Prompt de Analise (Analyzer — Step \[3\])

Prompt principal. Recebe todo o contexto e retorna a analise estruturada.

```typescript
// src/modules/talk-engine/prompts/analysis.prompt.ts

export function buildAnalysisPrompt(params: {
  globalInstructions: string;
  stepInstructions: string;
  stepActions: TreeFlowAction[];
  currentState: TalkFlowState;
  objections: Array<{
    id: string;
    name: string;
    detection_hints: string[];
    rebuttal_strategy: string;
    rebuttal_examples: string[];
  }>;
  contact: {
    name: string;
    phone: string;
    funnel_stage?: string;
    custom_attributes: Record<string, unknown>;
  };
  messageHistory: Array<{
    role: 'lead' | 'vendedor';
    content: string;
    timestamp: string;
  }>;
  newMessage: string;
  availableTransitions: TreeFlowTransition[];
}): { system: string; user: string } {

  const system = `
Voce e um vendedor especialista em registro de marcas no INPI.
Seu objetivo e conduzir o lead atraves do funil de vendas seguindo o roteiro abaixo.

## Instrucoes Globais
${params.globalInstructions}

## Step Atual: Instrucoes Especificas
${params.stepInstructions}

## Acoes a Coletar Neste Step
${params.stepActions.map(a => `
- **${a.name}** (${a.id}): ${a.extraction_hint}
  - Tipo: ${a.type} | Obrigatorio: ${a.required}
  ${a.validation?.options ? `- Opcoes: ${a.validation.options.join(', ')}` : ''}
`).join('\n')}

## Estado Atual (ja coletado)
${Object.entries(params.currentState.filled_actions).map(([k, v]) =>
  `- ${k}: ${JSON.stringify(v.value)} (confianca: ${v.confidence}, confirmado: ${v.confirmed})`
).join('\n') || '(nenhum dado coletado ainda)'}

## Objecoes Conhecidas
${params.objections.map(o => `
- **${o.name}** (${o.id}):
  - Detectar por: ${o.detection_hints.join(', ')}
  - Estrategia: ${o.rebuttal_strategy}
  - Exemplos de resposta: ${o.rebuttal_examples.join(' | ')}
`).join('\n') || '(nenhuma objecao configurada)'}

## Dados do Lead
- Nome: ${params.contact.name}
- Telefone: ${params.contact.phone}
- Estagio: ${params.contact.funnel_stage || 'novo'}
${Object.entries(params.contact.custom_attributes).map(([k, v]) =>
  `- ${k}: ${v}`
).join('\n')}

## Transicoes Possiveis
${params.availableTransitions.map(t =>
  `- → ${t.target_step_id}: quando ${t.condition.type} ${t.condition.params ? JSON.stringify(t.condition.params) : ''}`
).join('\n')}

## Regras de Resposta
1. Responda em portugues brasileiro, tom profissional e cordial
2. Mensagens para WhatsApp: sem markdown, maximo 3-4 paragrafos
3. Tente extrair informacoes das mensagens do lead naturalmente
4. Se detectar objecao, use a estrategia configurada
5. NAO invente informacoes. Se nao souber, diga que vai verificar
6. Sempre retorne JSON estruturado conforme o schema abaixo

## Schema de Resposta (JSON estrito)
{
  "message_analysis": {
    "intent": "answer|question|objection|escape|off_topic|greeting",
    "sentiment": "positive|neutral|negative",
    "summary": "string"
  },
  "extracted_data": {
    "<action_id>": { "value": "...", "confidence": 0.0-1.0 }
  },
  "objection_detected": { "objection_id": "UUID", "confidence": 0.0-1.0 } | null,
  "escape_detected": false,
  "step_transition": { "target_step_id": "string", "reason": "string" } | null,
  "suggested_response": {
    "content": "texto da mensagem para o lead",
    "confidence": 0.0-1.0,
    "reasoning": "explicacao interna"
  },
  "state_diff": {
    "filled_actions": { "<action_id>": { "value": "...", "confidence": 0.0-1.0 } },
    "variables": {}
  }
}
`.trim();

  const user = `
## Historico da Conversa
${params.messageHistory.map(m =>
  `[${m.role}] ${m.content}`
).join('\n')}

## Nova Mensagem do Lead
${params.newMessage}

Analise a mensagem e responda com o JSON estruturado.
`.trim();

  return { system, user };
}
```

### 3.3 JSON Schema para Structured Output

```typescript
// src/modules/talk-engine/prompts/schemas.ts

export const TREEFLOW_AI_RESPONSE_SCHEMA = {
  name: 'treeflow_analysis',
  strict: true,
  schema: {
    type: 'object',
    required: ['message_analysis', 'extracted_data', 'escape_detected', 'suggested_response', 'state_diff'],
    properties: {
      message_analysis: {
        type: 'object',
        required: ['intent', 'sentiment', 'summary'],
        properties: {
          intent: { type: 'string', enum: ['answer', 'question', 'objection', 'escape', 'off_topic', 'greeting'] },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          summary: { type: 'string' }
        }
      },
      extracted_data: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['value', 'confidence'],
          properties: {
            value: {},
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      },
      objection_detected: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            required: ['objection_id', 'confidence'],
            properties: {
              objection_id: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            }
          }
        ]
      },
      escape_detected: { type: 'boolean' },
      step_transition: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            required: ['target_step_id', 'reason'],
            properties: {
              target_step_id: { type: 'string' },
              reason: { type: 'string' }
            }
          }
        ]
      },
      suggested_response: {
        type: 'object',
        required: ['content', 'confidence', 'reasoning'],
        properties: {
          content: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' }
        }
      },
      state_diff: {
        type: 'object',
        properties: {
          filled_actions: { type: 'object' },
          variables: { type: 'object' }
        }
      }
    }
  }
} as const;

export const ROUTING_RESPONSE_SCHEMA = {
  name: 'message_routing',
  strict: true,
  schema: {
    type: 'object',
    required: ['talk_id', 'confidence', 'reasoning'],
    properties: {
      talk_id: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reasoning: { type: 'string' }
    }
  }
} as const;
```


---

## 4. Auto Mode vs HITL Mode

### 4.1 Fluxo de Decisao

```
                    AI retorna suggested_response
                              |
                              v
                   ┌──────────────────────┐
                   │ confidence >= threshold│
                   │ (tree_flow.settings.  │
                   │  confidence_threshold)│
                   └──────────┬───────────┘
                         ┌────┴────┐
                        SIM       NAO
                         |         |
                         v         v
                  ┌──────────┐ ┌──────────────┐
                  │AUTO MODE │ │  HITL MODE   │
                  └────┬─────┘ └──────┬───────┘
                       |              |
            ┌──────────┴──────┐       |
            │escape_detected? │       |
            └────┬───────┬────┘       |
                SIM     NAO          |
                 |       |            |
                 v       v            v
            ┌────────┐ ┌──────┐ ┌──────────────────┐
            │HITL    │ │ENVIA │ │ai_suggestion      │
            │(forcar)│ │AUTO  │ │status='pending'   │
            └────────┘ └──────┘ │talk_id preenchido │
                                │talk_step_id       │
                                └──────────────────────┘
```

**Regras de negocio:**


1. `auto_mode_enabled` precisa estar `true` no `tree_flows.settings` para auto-send funcionar. Se `false`, TUDO vai para HITL, independente da confianca.
2. Quando `escape_detected = true`, SEMPRE vai para HITL, mesmo que confianca seja alta. O agente precisa intervir em tentativas de escape.
3. Quando `objection_detected` e a objecao tem `severity = 'critical'`, SEMPRE vai para HITL.
4. O `confidence_threshold` default e `0.85`. Configuravel por TreeFlow (no `settings`).

### 4.2 Contexto TreeFlow na Fila HITL

Quando o agente abre uma sugestao na fila HITL que veio de um Talk, ele ve informacoes adicionais:

```
┌───────────────────────────────────────────────────────────────┐
│ SUGESTAO DE IA — Talk: Onboarding Marca ACME                 │
│ Step: Qualificacao (2/5)  │  Confianca: 0.72                 │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Contexto do Talk:                                             │
│  - Lead: Felipe da Silva                                     │
│  - TreeFlow: Onboarding Marca                                │
│  - Dados coletados: nome_marca=ACME, tipo=PJ                │
│  - Objecao detectada: preco-alto (confianca: 0.89)          │
│                                                               │
│ Sugestao:                                                     │
│ "Entendo sua preocupacao com o investimento, Felipe.          │
│  O registro de marca no INPI e valido por 10 anos e          │
│  protege sua marca em todo o territorio nacional..."          │
│                                                               │
│ Raciocinio da IA:                                             │
│ "Lead demonstrou objecao de preco. Usando estrategia          │
│  de valor percebido conforme configurado na objecao           │
│  'preco-alto'."                                               │
│                                                               │
│              [Enviar] [Editar] [Descartar]                    │
│                                                               │
│  Acoes do Talk:  [Pular Step] [Mudar Step ▼] [Pausar Talk]  │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Override do Agente

O agente pode, alem de aprovar/rejeitar a sugestao:

* **Pular Step**: forca transicao para o proximo step sem completar acoes
* **Mudar Step**: seleciona qualquer step do TreeFlow para pular
* **Pausar Talk**: pausa o Talk manualmente (ex: lead pediu para falar depois)
* **Fechar Talk**: encerra o Talk manualmente

Todas essas acoes geram `talk_event` com `actor_type = 'agent'`.


---

## 5. Talk Lifecycle

### 5.1 Diagrama de Estados

```
                                 [Automation/Manual/API]
                                          |
                                          v
                                   ┌──────────┐
                              ┌────│  ACTIVE   │────┐
                              │    └────┬─────┘    │
                              │         │          │
                      sub-Talk │    mensagens   inatividade
                      spawned  │    normais     timeout (cron)
                              │         │          │
                              v         │          v
                         ┌────────┐     │   ┌──────────────────┐
                         │ PAUSED │     │   │CLOSED_INACTIVITY │
                         └───┬────┘     │   └────────┬─────────┘
                             │          │            │
                     sub-Talk│          │            │
                     closes  │          │            v
                             │          │     ┌──────────┐
                             └──────────┼────→│ ARCHIVED │
                                        │     └──────────┘
                                        │            ^
                              all acoes │            │
                              do closing│            │
                              step OK   │     snapshot
                                        │     saved
                                        v            │
                                  ┌───────────┐      │
                                  │ COMPLETED │──────┘
                                  └───────────┘

                              agent manual close
                                        │
                                        v
                                  ┌──────────────┐
                                  │ CLOSED_MANUAL│──→ ARCHIVED
                                  └──────────────┘
```

### 5.2 Talk Creation Triggers

Um Talk pode ser criado por:


1. **Automation Rule**: evento `conversation_created` ou `message_created` com acao `create_talk` e parametro `tree_flow_slug`
2. **API direta**: `POST /accounts/:id/conversations/:id/talks` (agente cria manualmente)
3. **Sub-Talk spawn**: quando um step tem `sub_treeflow_slug` configurado, o engine spawna automaticamente
4. **Webhook externo**: via `POST /webhooks/talk-trigger` (sistemas externos iniciam Talks)

### 5.3 Talk Creation Flow

```typescript
// Pseudocodigo do talk creation
async function createTalk(params: {
  account_id: string;
  conversation_id: string;
  contact_id: string;
  tree_flow_slug: string;
  parent_talk_id?: string;
  trigger_source: string;
  trigger_message_id?: string;
}): Promise<Talk> {

  // 1. Buscar TreeFlow ativo
  const treeFlow = await findActiveTreeFlow(params.account_id, params.tree_flow_slug);

  // 2. Resolver versao (A/B testing)
  const version = await resolveVersion(treeFlow);

  // 3. Se ha parent_talk_id, pausar Talk pai
  if (params.parent_talk_id) {
    await pauseTalk(params.parent_talk_id, 'sub_talk_spawned');
  }

  // 4. Criar Talk
  const talk = await prisma.talks.create({
    data: {
      account_id: params.account_id,
      conversation_id: params.conversation_id,
      contact_id: params.contact_id,
      tree_flow_id: treeFlow.id,
      tree_flow_version_id: version.id,
      parent_talk_id: params.parent_talk_id,
      status: 'active',
      inactivity_timeout_minutes: treeFlow.settings.inactivity_timeout_minutes ?? 1440,
      metadata: {
        trigger_source: params.trigger_source,
        trigger_message_id: params.trigger_message_id,
        ab_variant: version.version_number,
      },
    },
  });

  // 5. Criar TalkFlow (estado inicial)
  const definition = version.definition as TreeFlowDefinition;
  await prisma.talk_flows.create({
    data: {
      talk_id: talk.id,
      current_step_id: definition.initial_step_id,
      state: {
        filled_actions: {},
        step_history: [{
          step_id: definition.initial_step_id,
          entered_at: new Date().toISOString(),
        }],
        variables: {},
        messages_in_current_step: 0,
      },
    },
  });

  // 6. Atualizar conversation.active_talk_id
  await prisma.conversations.update({
    where: { id: params.conversation_id },
    data: { active_talk_id: talk.id },
  });

  // 7. Registrar evento
  await createTalkEvent(talk.id, 'talk_created', {
    tree_flow_slug: treeFlow.slug,
    version_number: version.version_number,
    initial_step_id: definition.initial_step_id,
    trigger_source: params.trigger_source,
  }, 'system');

  // 8. Aplicar labels default (se configurado)
  if (treeFlow.settings.default_labels?.length) {
    await applyLabelsToConversation(params.conversation_id, treeFlow.settings.default_labels);
  }

  // 9. Emitir WebSocket
  emitToRoom(`account:${params.account_id}`, 'talk:created', { talk });

  return talk;
}
```

### 5.4 Talk Closure e Archival

```typescript
async function closeTalk(
  talk_id: string,
  reason: 'completed' | 'closed_inactivity' | 'closed_manual',
): Promise<void> {

  // 1. Carregar TalkFlow completo
  const talkFlow = await prisma.talk_flows.findUnique({ where: { talk_id } });

  // 2. Criar snapshot para resume futuro
  const snapshot = {
    talk_flow_state: talkFlow.state,
    current_step_id: talkFlow.current_step_id,
    objections_encountered: talkFlow.objections_encountered,
    escape_attempts: talkFlow.escape_attempts,
    closed_at: new Date().toISOString(),
    closed_reason: reason,
  };

  // 3. Salvar snapshot no talk_flows
  await prisma.talk_flows.update({
    where: { talk_id },
    data: { snapshot },
  });

  // 4. Atualizar Talk status
  const status = reason === 'completed' ? 'completed' : reason;
  await prisma.talks.update({
    where: { id: talk_id },
    data: { status, closed_at: new Date() },
  });

  // 5. Se ha Talk pai pausado, resume-lo
  const talk = await prisma.talks.findUnique({ where: { id: talk_id } });
  if (talk.parent_talk_id) {
    await resumeTalk(talk.parent_talk_id);
  }

  // 6. Atualizar conversation.active_talk_id
  // Apontar para Talk pai (se existir) ou para null
  const nextActiveTalk = talk.parent_talk_id
    ? talk.parent_talk_id
    : await findNextActiveTalk(talk.conversation_id);

  await prisma.conversations.update({
    where: { id: talk.conversation_id },
    data: { active_talk_id: nextActiveTalk },
  });

  // 7. Registrar evento
  await createTalkEvent(talk_id, `talk_${reason}`, { snapshot_saved: true }, 'system');

  // 8. WebSocket
  emitToRoom(`account:${talk.account_id}`, 'talk:closed', {
    talk_id, reason, parent_talk_id: talk.parent_talk_id,
  });
}
```


---

## 6. Message Routing Logic

### 6.1 Algoritmo de Roteamento

```typescript
// src/modules/talk-engine/router.ts

export async function routeMessage(params: {
  message: MessageEntity;
  contact_id: string;
  conversation_id: string;
  account_id: string;
}): Promise<MessageRoutingResult | null> {

  // 1. Buscar todos os Talks ativos/pausados do contato nesta conversa
  const activeTalks = await prisma.talks.findMany({
    where: {
      contact_id: params.contact_id,
      conversation_id: params.conversation_id,
      status: { in: ['active', 'paused'] },
    },
    include: {
      talk_flows: true,
      tree_flow: true,
    },
    orderBy: { priority: 'desc' },
  });

  // 2. Zero Talks → sem roteamento (fluxo normal)
  if (activeTalks.length === 0) {
    return null;
  }

  // 3. Um Talk ativo → roteamento direto
  const onlyActiveTalks = activeTalks.filter(t => t.status === 'active');
  if (onlyActiveTalks.length === 1) {
    return {
      talk_id: onlyActiveTalks[0].id,
      confidence: 1.0,
      reasoning: 'Unico Talk ativo — roteamento automatico',
    };
  }

  // 4. Multiplos Talks → IA decide
  // Carrega ultimas 3 mensagens de cada Talk para contexto
  const talksWithContext = await Promise.all(
    activeTalks.map(async (talk) => {
      const recentMessages = await prisma.talk_messages.findMany({
        where: { talk_id: talk.id },
        include: { message: true },
        orderBy: { created_at: 'desc' },
        take: 3,
      });
      return {
        talk_id: talk.id,
        tree_flow_name: talk.tree_flow.name,
        current_step_name: getCurrentStepName(talk),
        last_messages: recentMessages.map(m => m.message.content).reverse(),
        status: talk.status,
      };
    })
  );

  const prompt = buildRoutingPrompt({
    message: params.message.content,
    talks: talksWithContext,
  });

  const aiResponse = await callAI(prompt, ROUTING_RESPONSE_SCHEMA);

  // 5. Se confianca do roteamento < 0.6 → fallback
  if (aiResponse.confidence < 0.6) {
    // Fallback: roteia para o Talk mais recente com atividade
    const fallbackTalk = activeTalks.sort(
      (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
    )[0];
    return {
      talk_id: fallbackTalk.id,
      confidence: aiResponse.confidence,
      reasoning: `Routing AI confidence baixa (${aiResponse.confidence}). Fallback para Talk mais recente.`,
    };
  }

  return aiResponse;
}
```

### 6.2 Fallback Behavior

| Cenario | Comportamento |
|----|----|
| 0 Talks ativos | Mensagem segue fluxo normal (sem TreeFlow). Automacoes podem criar Talk. |
| 1 Talk ativo | Roteamento automatico, confidence 1.0 |
| 2+ Talks, AI confidence >= 0.6 | Usa decisao da IA |
| 2+ Talks, AI confidence < 0.6 | Fallback: Talk mais recente. Cria talk_event com flag `low_confidence_routing` para auditoria |
| Talk pausado recebe mensagem | Se AI roteia para Talk pausado, o Talk e automaticamente resumido |
| Mensagem off-topic para todos os Talks | Roteia para o Talk mais recente, AI analysis vai detectar `intent: 'off_topic'` |


---

## 7. BullMQ Workers

### 7.1 Novos Workers

```typescript
// ── Worker: talk-engine ──────────────────────────────────────
// Fila: talk:process
// Trigger: webhook:process worker (apos criar mensagem, se ha Talks ativos)
// Responsabilidade: pipeline completo [1]-[6]

// src/workers/talk-engine.worker.ts
const TALK_ENGINE_CONCURRENCY = 5;

interface TalkProcessJob {
  message_id: string;
  conversation_id: string;
  contact_id: string;
  account_id: string;
}

// ── Worker: talk-inactivity ──────────────────────────────────
// Fila: talk:check-inactivity
// Trigger: cron job a cada 5 minutos
// Responsabilidade: fechar Talks inativos

// src/workers/talk-inactivity.worker.ts
const TALK_INACTIVITY_CONCURRENCY = 1;

interface TalkInactivityJob {
  batch_size: number;  // default: 100
}

// ── Worker: talk-auto-send ───────────────────────────────────
// Fila: talk:auto-send
// Trigger: decision-gate quando auto_mode=true
// Responsabilidade: criar mensagem e enfileirar message:send

// src/workers/talk-auto-send.worker.ts
const TALK_AUTO_SEND_CONCURRENCY = 5;

interface TalkAutoSendJob {
  talk_id: string;
  suggestion_id: string;
  conversation_id: string;
  content: string;
}
```

### 7.2 Tabela Atualizada de Filas

| Fila | Proposito | Retry | Timeout | Concurrency |
|----|----|----|----|----|
| `talk:process` | Pipeline completo do TreeFlow engine | 2x (exponencial) | 45s | 5 |
| `talk:check-inactivity` | Cron: fechar Talks inativos | 1x | 30s | 1 |
| `talk:auto-send` | Envio automatico quando confidence alta | 2x | 15s | 5 |
| *existente* `message:send` | Enviar mensagem via provider | 3x | 30s | 10 |
| *existente* `automation:evaluate` | Avaliar regras (agora tambem `create_talk`) | 2x | 15s | 5 |
| *existente* `ai:generate-suggestion` | Gerar sugestao (agora tambem via TreeFlow) | 1x | 60s | 3 |

### 7.3 Cron Jobs

```typescript
// src/workers/schedulers.ts

// Verificar Talks inativos a cada 5 minutos
await talkInactivityQueue.add(
  'check-inactivity',
  { batch_size: 100 },
  {
    repeat: { pattern: '*/5 * * * *' },
    removeOnComplete: true,
    removeOnFail: 10,
  }
);
```

### 7.4 Modificacao no webhook:process Worker

O worker existente `webhook:process` precisa de uma alteracao para enfileirar o `talk:process` quando aplicavel:

```typescript
// ADICIONADO ao passo final do webhook:process worker (apos step 8)

// Step 9: verificar se ha Talks ativos para este contato/conversa
const activeTalks = await prisma.talks.count({
  where: {
    contact_id: contact.id,
    conversation_id: conversation.id,
    status: { in: ['active', 'paused'] },
  },
});

if (activeTalks > 0) {
  await talkProcessQueue.add('process', {
    message_id: message.id,
    conversation_id: conversation.id,
    contact_id: contact.id,
    account_id: conversation.account_id,
  });
}
```


---

## 8. WebSocket Events

### 8.1 Novos Eventos do Servidor para o Cliente

```typescript
// Adicionar a src/events/socket-events.ts

// ── Talk Events ──
'talk:created'              // Novo Talk criado
// payload: { talk, tree_flow_name, initial_step }

'talk:step_changed'         // Talk mudou de step
// payload: { talk_id, previous_step_id, new_step_id, new_step_name }

'talk:auto_sent'            // Mensagem enviada automaticamente pelo TreeFlow
// payload: { talk_id, message_id, suggestion_id, confidence }

'talk:hitl_queued'          // Sugestao foi para fila HITL
// payload: { talk_id, suggestion_id, confidence, step_id }

'talk:paused'               // Talk pausado (sub-Talk spawned ou manual)
// payload: { talk_id, reason, sub_talk_id? }

'talk:resumed'              // Talk retomado
// payload: { talk_id, from_sub_talk_id? }

'talk:closed'               // Talk fechado
// payload: { talk_id, reason, snapshot_available }

'talk:objection_detected'   // Objecao detectada no Talk
// payload: { talk_id, objection_id, objection_name, step_id }

'talk:state_updated'        // Estado do TalkFlow mudou (actions preenchidas)
// payload: { talk_id, updated_fields: string[] }

'talk:escape_attempt'       // Lead tentou escapar
// payload: { talk_id, attempt_count, step_id }
```

### 8.2 Novas Rooms

```
talk:{talk_id}              -- Agentes acompanhando um Talk especifico
```

### 8.3 Eventos do Cliente para o Servidor

```typescript
'subscribe:talk'            // Agente quer acompanhar um Talk
// payload: { talk_id }

'unsubscribe:talk'          // Agente para de acompanhar Talk
// payload: { talk_id }
```


---

## 9. API Endpoints

### 9.1 TreeFlows CRUD

```
GET    /accounts/:account_id/tree-flows
       Query: ?category=&is_archived=false&page=1&limit=25
       Response: { tree_flows: [...], meta }

POST   /accounts/:account_id/tree-flows
       Body: { name, slug, description?, category?, settings? }
       Response: { tree_flow }

GET    /accounts/:account_id/tree-flows/:tree_flow_id
       Response: { tree_flow, active_version, versions_count, talks_count }

PATCH  /accounts/:account_id/tree-flows/:tree_flow_id
       Body: { name?, description?, category?, settings?, is_archived? }
       Response: { tree_flow }

DELETE /accounts/:account_id/tree-flows/:tree_flow_id
       Response: { ok: true }  -- soft archive, nao deleta Talks existentes
```

### 9.2 TreeFlow Versions

```
GET    /accounts/:account_id/tree-flows/:tree_flow_id/versions
       Response: { versions: [...] }

POST   /accounts/:account_id/tree-flows/:tree_flow_id/versions
       Body: { definition: TreeFlowDefinition, notes?, ab_weight? }
       Response: { version }  -- criado como 'draft'

GET    /accounts/:account_id/tree-flows/:tree_flow_id/versions/:version_id
       Response: { version }

PATCH  /accounts/:account_id/tree-flows/:tree_flow_id/versions/:version_id
       Body: { definition?, notes?, ab_weight? }
       Response: { version }  -- somente se status='draft'

POST   /accounts/:account_id/tree-flows/:tree_flow_id/versions/:version_id/publish
       Response: { version }
       -- Muda status para 'published'
       -- Deprecia versoes anteriores se ab_weight=100
       -- Atualiza tree_flow.active_version_id

POST   /accounts/:account_id/tree-flows/:tree_flow_id/versions/:version_id/deprecate
       Response: { version }

POST   /accounts/:account_id/tree-flows/:tree_flow_id/import
       Body: { definition_json: string }  -- JSON string para import
       Response: { version }  -- cria nova versao como draft

GET    /accounts/:account_id/tree-flows/:tree_flow_id/export/:version_id
       Response: { definition_json: string }  -- export para backup/transfer
```

### 9.3 Talks

```
GET    /accounts/:account_id/talks
       Query: ?status=active&tree_flow_id=&contact_id=&conversation_id=&page=1&limit=25
       Response: { talks: [...], meta }

GET    /accounts/:account_id/conversations/:conversation_id/talks
       Query: ?status=active
       Response: { talks: [...] }

POST   /accounts/:account_id/conversations/:conversation_id/talks
       Body: { tree_flow_slug }
       Response: { talk }
       -- Cria Talk manualmente (agente escolhe TreeFlow)

GET    /accounts/:account_id/talks/:talk_id
       Response: { talk, talk_flow, tree_flow, tree_flow_version, events_summary }

PATCH  /accounts/:account_id/talks/:talk_id
       Body: { status? }  -- apenas: 'paused' | 'closed_manual'
       Response: { talk }

POST   /accounts/:account_id/talks/:talk_id/resume
       Response: { talk }
       -- Retoma Talk pausado

POST   /accounts/:account_id/talks/:talk_id/override-step
       Body: { target_step_id, reason? }
       Response: { talk, talk_flow }
       -- Agente forca mudanca de step (override)
```

### 9.4 TalkFlow (estado runtime — read-only via API)

```
GET    /accounts/:account_id/talks/:talk_id/flow
       Response: { talk_flow, current_step_definition, available_transitions }

GET    /accounts/:account_id/talks/:talk_id/events
       Query: ?event_type=&page=1&limit=50
       Response: { events: [...], meta }

GET    /accounts/:account_id/talks/:talk_id/messages
       Query: ?page=1&limit=50
       Response: { messages: [...], meta }
       -- Mensagens vinculadas a este Talk (via talk_messages)
```

### 9.5 Objections

```
GET    /accounts/:account_id/objections
       Query: ?category=&search=
       Response: { objections: [...] }

POST   /accounts/:account_id/objections
       Body: { name, category?, description?, detection_hints, rebuttal_strategy, rebuttal_examples, severity? }
       Response: { objection }

PATCH  /accounts/:account_id/objections/:objection_id
       Body: { name?, category?, description?, detection_hints?, rebuttal_strategy?, rebuttal_examples?, severity? }
       Response: { objection }

DELETE /accounts/:account_id/objections/:objection_id
       Response: { ok: true }

POST   /accounts/:account_id/tree-flows/:tree_flow_id/objections
       Body: { objection_id, step_ids?, priority? }
       Response: { tree_flow_objection }

DELETE /accounts/:account_id/tree-flows/:tree_flow_id/objections/:objection_id
       Response: { ok: true }
```


---

## 10. Integracao com Sistemas Existentes

### 10.1 Integracao: Automation Builder → TreeFlow

O Automation Builder existente ganha uma nova acao:

```typescript
// Nova acao no automation_rules.actions JSONB:
{
  type: 'create_talk',
  params: {
    tree_flow_slug: 'onboarding-marca'  // slug do TreeFlow a iniciar
  }
}
```

**Exemplo de regra de automacao:**

```
Quando: conversation_created
Condicoes: inbox_id = {id_do_inbox_vendas}
Acoes: create_talk(tree_flow_slug='onboarding-marca')
```

O `automation.worker.ts` precisa de um novo handler para `create_talk`:

```typescript
// Adicionar ao switch de acoes no automation.worker.ts
case 'create_talk':
  await talkService.createTalk({
    account_id: rule.account_id,
    conversation_id: event.conversation_id,
    contact_id: event.contact_id,
    tree_flow_slug: action.params.tree_flow_slug,
    trigger_source: 'automation',
  });
  break;
```

### 10.2 Integracao: Labels ↔ TreeFlow

TreeFlow steps podem auto-aplicar labels:

```typescript
// No TreeFlowStep.labels_to_apply: UUID[]
// Quando o engine entra em um step, aplica as labels:

// post-processor.ts
if (step.labels_to_apply?.length) {
  for (const labelId of step.labels_to_apply) {
    await prisma.conversation_labels.upsert({
      where: {
        conversation_id_label_id: {
          conversation_id: talk.conversation_id,
          label_id: labelId,
        },
      },
      create: {
        conversation_id: talk.conversation_id,
        label_id: labelId,
      },
      update: {},
    });
  }
  // Emitir WebSocket conversation:updated com novas labels
}
```

### 10.3 Integracao: AI Suggestions ↔ TreeFlow

Sugestoes geradas pelo TreeFlow fluem pelo **mesmo pipeline** existente de AI HITL:

* TreeFlow gera a sugestao via `analyzer.ts`
* Cria `ai_suggestions` com `talk_id` e `talk_step_id` preenchidos
* Se `auto_mode` e `confidence >= threshold`: `status='sent'`, mensagem enviada
* Se nao: `status='pending'`, vai para fila HITL existente
* Frontend `AISuggestionBar` e `SuggestionQueue` exibem contexto extra quando `talk_id` esta presente
* Agente aprova/rejeita usando o mesmo endpoint `PATCH /ai-suggestions/:id`

**Importante:** o campo `triggered_by` na `ai_suggestions` ganha novo valor: `'treeflow'`, com `trigger_id` apontando para `talk_id`.

### 10.4 Integracao: Conversations ↔ Talks

* `conversations.active_talk_id` aponta para o Talk principal ativo
* Na UI da conversa, um painel lateral mostra o estado do Talk quando `active_talk_id` nao e null
* O painel mostra: step atual, progresso (acoes preenchidas / total), objecoes, timeline de eventos
* Agente pode criar Talk manualmente pela UI

### 10.5 Novos Eventos para Automation Builder

```typescript
// Novos event_names aceitos pelo Automation Builder:
'talk_created'           // Talk criado
'talk_step_changed'      // Talk mudou de step
'talk_completed'         // Talk completado

// Novos campos de condicao:
'talk.tree_flow_slug'    // slug do TreeFlow
'talk.current_step_id'   // step atual
'talk.status'            // status do Talk

// Exemplos de uso:
// "Quando talk_step_changed E talk.current_step_id = 'proposta', entao add_label('proposta-enviada')"
// "Quando talk_completed E talk.tree_flow_slug = 'onboarding-marca', entao trigger_webhook(...)"
```


---

## 11. Frontend: Novos Componentes e Paginas

### 11.1 Novos Componentes

```
src/components/
├── talks/
│   ├── TalkPanel.tsx               -- Painel lateral na conversa com estado do Talk
│   ├── TalkStepProgress.tsx        -- Barra de progresso visual dos steps
│   ├── TalkFlowStateView.tsx       -- Visualizacao do estado (acoes preenchidas)
│   ├── TalkTimeline.tsx            -- Timeline de eventos do Talk
│   ├── TalkCreateModal.tsx         -- Modal para criar Talk manualmente
│   └── TalkOverrideControls.tsx    -- Botoes de override (pular step, pausar, fechar)
├── treeflow/
│   ├── TreeFlowList.tsx            -- Lista de TreeFlows na settings
│   ├── TreeFlowEditor.tsx          -- Editor JSON para definicao (MVP)
│   ├── TreeFlowVersionList.tsx     -- Lista de versoes com status
│   └── TreeFlowSettings.tsx        -- Configuracoes: threshold, timeout, etc
├── objections/
│   ├── ObjectionList.tsx           -- Lista de objecoes
│   └── ObjectionForm.tsx           -- Formulario CRUD de objecao
└── ai-queue/
    └── SuggestionCard.tsx          -- MODIFICADO: exibir contexto Talk quando presente
```

### 11.2 Novas Paginas

```
src/app/(dashboard)/[account_id]/
├── settings/
│   ├── tree-flows/
│   │   ├── page.tsx                -- Lista de TreeFlows
│   │   └── [tree_flow_id]/
│   │       ├── page.tsx            -- Detalhes + editor de versoes
│   │       └── versions/
│   │           └── [version_id]/page.tsx  -- Editor de definicao
│   └── objections/
│       └── page.tsx                -- CRUD de objecoes
└── talks/
    └── page.tsx                    -- Dashboard de Talks ativos (overview)
```

### 11.3 Novos Stores (Zustand)

```
src/store/
├── talks.store.ts                  -- Estado dos Talks por conversa
└── treeflows.store.ts              -- Cache dos TreeFlows da account
```

### 11.4 Novos Hooks

```
src/hooks/
├── useTalks.ts                     -- Hook para carregar Talks de uma conversa
├── useTalkFlow.ts                  -- Hook para estado runtime do Talk
└── useTreeFlows.ts                 -- Hook para lista de TreeFlows
```


---

## 12. Resolucao de A/B Testing

Quando um TreeFlow tem multiplas versoes published com `ab_weight`:

```typescript
// src/modules/talk-engine/engine.ts

function resolveVersion(treeFlow: TreeFlow): TreeFlowVersion {
  const publishedVersions = treeFlow.versions.filter(v => v.status === 'published');

  if (publishedVersions.length === 1) return publishedVersions[0];

  // Weighted random selection
  const totalWeight = publishedVersions.reduce((sum, v) => sum + v.ab_weight, 0);
  let random = Math.random() * totalWeight;

  for (const version of publishedVersions) {
    random -= version.ab_weight;
    if (random <= 0) return version;
  }

  return publishedVersions[0]; // fallback
}
```


---

## 13. Resumo da Estrutura de Modulos do Backend (adicionados)

```
src/modules/
├── treeflow/              -- CRUD de TreeFlow + Versions
├── talks/                 -- CRUD de Talks + lifecycle management
├── talk-engine/           -- Engine de processamento (pipeline)
│   ├── engine.ts          -- Orquestrador
│   ├── router.ts          -- Roteamento de mensagens
│   ├── loader.ts          -- Carrega contexto completo
│   ├── analyzer.ts        -- Chama IA e parseia resposta
│   ├── state-applier.ts   -- Aplica diffs no TalkFlow
│   ├── decision-gate.ts   -- Auto vs HITL
│   ├── post-processor.ts  -- Labels, sub-Talks, WebSocket
│   └── prompts/           -- Templates de prompt
└── objections/            -- CRUD de Objections

src/workers/
├── talk-engine.worker.ts        -- NOVO: pipeline principal
├── talk-inactivity.worker.ts    -- NOVO: cron de inatividade
├── talk-auto-send.worker.ts     -- NOVO: envio automatico
├── automation.worker.ts         -- MODIFICADO: nova acao create_talk
└── (demais workers inalterados)
```


---

## 14. Sequenciamento de Implementacao

| Ordem | Modulo | Dependencia | Estimativa |
|----|----|----|----|
| 1 | Migration SQL (002_treeflow.sql) | 001_init.sql | 1 dia |
| 2 | Prisma schema update | Migration | 0.5 dia |
| 3 | TypeScript interfaces + Zod schemas | - | 1 dia |
| 4 | Objections CRUD (module completo) | Migration | 1 dia |
| 5 | TreeFlows CRUD + Versions (module completo) | Migration | 2 dias |
| 6 | Talks CRUD + lifecycle (module completo) | TreeFlows | 2 dias |
| 7 | Talk Engine: router + loader | Talks | 1 dia |
| 8 | Talk Engine: analyzer + prompts | Router/Loader | 2 dias |
| 9 | Talk Engine: state-applier | Analyzer | 1 dia |
| 10 | Talk Engine: decision-gate | State Applier | 1 dia |
| 11 | Talk Engine: post-processor | Decision Gate | 1 dia |
| 12 | BullMQ workers (3 novos) | Engine completo | 1 dia |
| 13 | Modificacao webhook:process worker | Workers | 0.5 dia |
| 14 | Modificacao automation.worker (create_talk) | Talks | 0.5 dia |
| 15 | WebSocket events (novos) | Workers | 0.5 dia |
| 16 | AI Suggestions: campos talk_id + contexto | Engine | 0.5 dia |
| 17 | Frontend: Settings TreeFlow + Objections | API pronta | 3 dias |
| 18 | Frontend: TalkPanel na conversa | WebSocket | 2 dias |
| 19 | Frontend: SuggestionCard com contexto Talk | TalkPanel | 1 dia |
| 20 | Frontend: Dashboard de Talks | API pronta | 1 dia |
| **Total estimado** |    |    | **\~20 dias** |


---

### Critical Files for Implementation

* `/Users/nicolasamaral/Vialum-Intelligence/vialum-chat/PRD.md` - PRD base que contem todo o schema SQL existente (tabelas accounts, conversations, messages, ai_suggestions, automation_rules), a arquitetura de workers BullMQ, WebSocket events, e a estrutura de diretorios do backend/frontend que serao estendidos pelo TreeFlow.
* A migration `002_treeflow.sql` (a ser criada) - Contera todo o DDL das 8 novas tabelas e alteracoes nas tabelas existentes. Todo o SQL esta especificado na secao 1 deste documento.
* O modulo `src/modules/talk-engine/engine.ts` (a ser criado) - Orquestrador principal do pipeline de 6 etapas (router -> loader -> analyzer -> state-applier -> decision-gate -> post-processor). Este e o arquivo mais critico de toda a feature.
* O modulo `src/modules/talk-engine/prompts/analysis.prompt.ts` (a ser criado) - Template do prompt principal que injeta TreeFlow definition, TalkFlow state, objections, contact data e message history no sistema de IA. A qualidade deste prompt determina a qualidade de todo o sistema.
* O worker `src/workers/talk-engine.worker.ts` (a ser criado) - Worker BullMQ que processa a fila `talk:process`, instanciando o engine para cada mensagem incoming que pertence a um Talk ativo. Ponto de integracao entre o pipeline de mensagens existente e o novo sistema TreeFlow.


