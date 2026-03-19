# PRD — CRM Hub Evolucoes (v2.1)

> Evolucoes necessarias no CRM Hub para suportar o fluxo de protocolo completo.
> Versao: 2.1.0 | Data: 2026-03-17 | Status: Proposta


## 1. Resumo das evolucoes

O CRM Hub v2 é read-only. Para o fluxo de protocolo, precisa ganhar:

| Evolucao | Prioridade | Descricao |
|----|----|----|
| ID Universal + Organizacoes | ALTA | Modelo unificado de entidades (pessoas + organizacoes) com ID universal |
| ClickUp write operations | ALTA | Criar task, atualizar status, anexar arquivo, setar custom field, comentar, atribuir |
| Webhook receiver | ALTA | Receber eventos do ClickUp, Pipedrive e Media Service |
| Action dispatcher | ALTA | Reagir a eventos com acoes automaticas |
| Pipedrive write operations | MEDIA | Criar deal, atualizar deal |


## 1.1 ID Universal + Organizacoes

### Problema

O CRM Hub tem `crm_contacts` para pessoas, mas nao tem conceito de **organizacao** (PJ).
No fluxo de protocolo, um representante legal (PF) age em nome de uma empresa (PJ).
O mesmo representante pode registrar varias marcas para a mesma empresa, ou representar
empresas diferentes. Sem um modelo de organizacao, cada card trata a empresa como texto
solto na descricao.

### Modelo

```
crm_contacts (pessoas)              crm_organizations (empresas)
  id (UUID) ◄──── universal ────►     id (UUID)
  name                                legal_name (razao social)
  phone, email                        trade_name (nome fantasia)
  lifecycle_stage                     cnpj
            │                                  │
            └──── contact_organizations ───────┘
                  (N:N, com role)
```

### Novas tabelas

```sql
CREATE TABLE crm_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  legal_name      VARCHAR(500),
  trade_name      VARCHAR(500),
  cnpj            VARCHAR(20),
  lifecycle_stage VARCHAR(50) DEFAULT 'lead',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_org_cnpj ON crm_organizations(account_id, cnpj)
  WHERE cnpj IS NOT NULL;
CREATE INDEX idx_org_account ON crm_organizations(account_id);

CREATE TABLE organization_aliases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES crm_organizations(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL,
  type              VARCHAR(30) NOT NULL,    -- cnpj, trade_name, ie (inscricao estadual)
  value             VARCHAR(255) NOT NULL,
  is_primary        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, type, value)
);

CREATE TABLE contact_organizations (
  contact_id        UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES crm_organizations(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL,
  role              VARCHAR(100) DEFAULT 'representante',
  is_primary        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, organization_id)
);
```

### Evolucao do crm_integrations

Adicionar campo `entity_type` para suportar integracao tanto de contatos quanto organizacoes:

```sql
ALTER TABLE crm_integrations
  ADD COLUMN entity_type VARCHAR(20) DEFAULT 'contact',  -- contact | organization
  ADD COLUMN organization_id UUID REFERENCES crm_organizations(id);

-- Integracao pode ser de contato OU organizacao
-- Se entity_type = 'contact': usa crm_contact_id (existente)
-- Se entity_type = 'organization': usa organization_id (novo)
```

### Evolucao do /identity/resolve

```
POST /identity/resolve

-- Resolve por CNPJ (novo)
{ "cnpj": "51.829.412/0001-70" }
→ Retorna organizacao + representantes vinculados + integracoes

-- Resolve por CPF (existente, evoluido)
{ "cpf": "123.456.789-00" }
→ Retorna contato + organizacoes que participa + integracoes

-- Resolve por phone (existente, evoluido)
{ "phone": "+5543988740276" }
→ Retorna contato + organizacoes + integracoes

Response evoluida:
{
  "contact": { id, name, phone, email, lifecycle_stage },
  "organizations": [
    {
      "id": "org_uuid",
      "legal_name": "ACME LTDA",
      "trade_name": "ACME",
      "cnpj": "12.345.678/0001-99",
      "role": "socio-administrador",
      "is_primary": true
    }
  ],
  "integrations": {
    "pipedrive": [...],
    "clickup": [...],
    "gdrive": [...]
  },
  "meta": { "resolvedVia": "phone", "syncedAt": "..." }
}
```

### Novas rotas

```
POST   /crm/api/v1/organizations              → criar organizacao
GET    /crm/api/v1/organizations/:id           → buscar por ID
GET    /crm/api/v1/organizations?cnpj=X        → buscar por CNPJ
PATCH  /crm/api/v1/organizations/:id           → atualizar

POST   /crm/api/v1/contacts/:contactId/organizations
  Body: { organizationId, role }               → vincular pessoa a org

GET    /crm/api/v1/contacts/:contactId/organizations  → listar orgs da pessoa
GET    /crm/api/v1/organizations/:orgId/contacts       → listar pessoas da org
DELETE /crm/api/v1/contacts/:contactId/organizations/:orgId  → desvincular
```


---

## 2. ClickUp Write Operations

### 2.1 Novos metodos no ClickUpProvider

```typescript
// Nao alterar a interface CrmProvider (continua read-only)
// Adicionar metodos especificos no ClickUpProvider

class ClickUpProvider extends BaseProvider {
  // --- EXISTENTES (read) ---
  async search(accountId, params): Promise<ProviderResource[]>
  async getTask(accountId, taskId): Promise<any>

  // --- NOVOS (write) ---
  async createTask(accountId: string, listId: string, data: CreateTaskParams): Promise<ClickUpTask>
  async updateTask(accountId: string, taskId: string, data: UpdateTaskParams): Promise<ClickUpTask>
  async updateTaskStatus(accountId: string, taskId: string, status: string): Promise<ClickUpTask>
  async addComment(accountId: string, taskId: string, comment: string, assigneeId?: number): Promise<void>
  async addAttachment(accountId: string, taskId: string, fileUrl: string, filename: string): Promise<void>
  async setCustomField(accountId: string, taskId: string, fieldId: string, value: any): Promise<void>
  async assignTask(accountId: string, taskId: string, assigneeIds: number[]): Promise<void>
  async getListMembers(accountId: string, listId: string): Promise<ClickUpMember[]>
}
```

### 2.2 Interfaces

```typescript
interface CreateTaskParams {
  name: string;
  description?: string;
  status?: string;
  assignees?: number[];
  tags?: string[];
  customFields?: Array<{ id: string; value: any }>;
}

interface UpdateTaskParams {
  name?: string;
  description?: string;
  status?: string;
  assignees?: { add?: number[]; rem?: number[] };
  tags?: string[];
}
```

### 2.3 Novas rotas

```
POST   /crm/api/v1/clickup/tasks
  Body: { listId, name, description, status, assignees, tags, customFields }
  → Cria task no ClickUp

PUT    /crm/api/v1/clickup/tasks/:taskId
  Body: { name?, description?, status?, assignees?, tags? }
  → Atualiza task

PUT    /crm/api/v1/clickup/tasks/:taskId/status
  Body: { status: "aguardando assinatura" }
  → Atualiza apenas status

POST   /crm/api/v1/clickup/tasks/:taskId/comments
  Body: { text, assigneeId? }
  → Adiciona comentario (com @mention se assigneeId)

POST   /crm/api/v1/clickup/tasks/:taskId/attachments
  Body: { fileUrl, filename }
  → Anexa arquivo (URL pre-assinada do Media Service)

PUT    /crm/api/v1/clickup/tasks/:taskId/custom-fields/:fieldId
  Body: { value }
  → Seta custom field

PUT    /crm/api/v1/clickup/tasks/:taskId/assignees
  Body: { assigneeIds: [123] }
  → Atribui task
```

### 2.4 ClickUp API endpoints usados

```
POST   https://api.clickup.com/api/v2/list/{listId}/task          → createTask
PUT    https://api.clickup.com/api/v2/task/{taskId}                → updateTask
POST   https://api.clickup.com/api/v2/task/{taskId}/comment        → addComment
POST   https://api.clickup.com/api/v2/task/{taskId}/attachment     → addAttachment
POST   https://api.clickup.com/api/v2/task/{taskId}/field/{fieldId} → setCustomField
```


---

## 3. Webhook Receiver

### 3.1 Endpoint generico

```
POST /crm/api/v1/webhooks/:source
  source: "clickup" | "pipedrive" | "media" | "classification" | "portal"

Headers:
  X-Webhook-Secret: <hmac_signature>    (verificacao)

Body: (payload do provider)
```

### 3.2 Processamento

```typescript
// webhooks/webhook.service.ts

async processWebhook(accountId: string, source: string, payload: any) {
  // 1. Normalizar evento
  const event = normalizeEvent(source, payload);
  // event = { source, type, entityId, entityType, data, raw }

  // 2. Persistir (audit trail)
  await prisma.webhookEvent.create({ data: { accountId, ...event } });

  // 3. Despachar para Action Dispatcher
  await actionDispatcher.evaluate(accountId, event);
}
```

### 3.3 Eventos normalizados

| Source | Raw Event | Normalized Type |
|----|----|----|
| ClickUp | taskStatusUpdated | `task.status_changed` |
| ClickUp | taskCreated | `task.created` |
| ClickUp | taskCommentPosted | `task.comment_added` |
| ClickUp | taskAttachmentCreated | `task.attachment_added` |
| Pipedrive | deal.updated | `deal.updated` |
| Pipedrive | deal.won | `deal.won` |
| Media | file.created | `file.created` |
| Classification | classification.completed | `classification.completed` |
| Portal | form.submitted | `form.submitted` |

### 3.4 Database

```sql
CREATE TABLE webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  source      VARCHAR(50) NOT NULL,
  event_type  VARCHAR(100) NOT NULL,
  entity_id   VARCHAR(255),
  entity_type VARCHAR(50),
  payload     JSONB NOT NULL,
  processed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wh_account ON webhook_events(account_id, created_at DESC);
CREATE INDEX idx_wh_entity ON webhook_events(account_id, entity_type, entity_id);
```


---

## 4. Action Dispatcher

O cerebro reativo do sistema. Recebe eventos e executa acoes.

### 4.1 Definicao de regras

```typescript
interface ActionRule {
  id: string;
  accountId: string;
  name: string;
  active: boolean;
  trigger: {
    source: string;             // clickup, pipedrive, media, classification, portal
    eventType: string;          // task.status_changed, file.created, etc
    conditions: Condition[];    // AND logic
  };
  actions: ActionStep[];
}

interface Condition {
  field: string;               // "data.status", "data.tags", "data.label"
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'exists';
  value: any;
}

interface ActionStep {
  type: string;
  params: Record<string, any>;
  delay?: number;              // ms antes de executar (debounce)
}
```

### 4.2 Tipos de acao

```
clickup.create_task      { listId, name, description, status, customFields }
clickup.update_status    { taskId, status }
clickup.add_comment      { taskId, text }
clickup.add_attachment   { taskId, fileId }  → busca URL no Media Service
clickup.set_field        { taskId, fieldId, value }
clickup.assign           { taskId, assigneeEmail }
clickup.add_tag          { taskId, tag }

pipedrive.update_deal    { dealId, data }

vialum_chat.send_message { phone, content, mode }
vialum_chat.start_treeflow { phone, treeflowSlug }

media.classify           { fileId, classifier }

webhook.send             { url, payload }
```

### 4.3 Regras pre-configuradas para Genesis (protocolo)

```yaml
# Regra 1: Comprovante de pagamento detectado → tag PAGO + verificar gate
- name: "Pagamento detectado"
  trigger:
    source: classification
    eventType: classification.completed
    conditions:
      - field: "data.classifier"
        operator: equals
        value: "payment_proof"
      - field: "data.result.label"
        operator: in
        value: ["COMPROVANTE_PIX", "COMPROVANTE_TED", "BOLETO_PAGO"]
  actions:
    - type: clickup.add_tag
      params: { taskId: "{{data.contextId}}", tag: "PAGO" }
    - type: action_dispatcher.evaluate_gate
      params: { taskId: "{{data.contextId}}", gate: "assinado_e_pago" }

# Regra 2: Gate assinado + pago → mover para aguardando documentos
- name: "Gate assinado+pago"
  trigger:
    source: internal
    eventType: gate.evaluate
    conditions:
      - field: "data.gate"
        operator: equals
        value: "assinado_e_pago"
  actions:
    - type: clickup.check_conditions
      params:
        taskId: "{{data.taskId}}"
        conditions:
          - hasTag: "PAGO"
          - hasTag: "ASSINADO"
        onSuccess:
          - type: clickup.update_status
            params: { taskId: "{{data.taskId}}", status: "aguardando documentos" }
          - type: vialum_chat.start_treeflow
            params: { phone: "{{data.clientPhone}}", treeflowSlug: "coleta-documentos" }

# Regra 3: Documento classificado → anexar no ClickUp com tag
- name: "Documento recebido e classificado"
  trigger:
    source: classification
    eventType: classification.completed
    conditions:
      - field: "data.classifier"
        operator: equals
        value: "document_type"
      - field: "data.result.label"
        operator: in
        value: ["RG", "CNH", "CPF", "COMPROVANTE_RESIDENCIA", "CERTIFICADO_PROFISSIONAL"]
  actions:
    - type: clickup.add_attachment
      params: { taskId: "{{data.contextId}}", fileId: "{{data.fileId}}" }
    - type: clickup.add_comment
      params: { taskId: "{{data.contextId}}", text: "📎 {{data.result.label}} recebido (confiança: {{data.result.confidence}})" }

# Regra 4: Todos documentos recebidos → notificar responsavel
- name: "Documentos completos"
  trigger:
    source: internal
    eventType: documents.check_complete
  actions:
    - type: clickup.update_status
      params: { taskId: "{{data.taskId}}", status: "documentos recebidos" }
    - type: clickup.assign
      params: { taskId: "{{data.taskId}}", assigneeEmail: "contato@avelumia.com" }
    - type: clickup.add_comment
      params: { taskId: "{{data.taskId}}", text: "✅ Todos os documentos foram recebidos. Card atribuído para preparação do protocolo." }
    - type: clickup.update_status
      params: { taskId: "{{data.taskId}}", status: "preparação protocolo" }
```

### 4.4 Database

```sql
CREATE TABLE action_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  active      BOOLEAN DEFAULT true,
  trigger     JSONB NOT NULL,
  actions     JSONB NOT NULL,
  run_count   INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE action_executions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  rule_id     UUID REFERENCES action_rules(id),
  event_id    UUID REFERENCES webhook_events(id),
  status      VARCHAR(20) NOT NULL,     -- pending, running, completed, failed
  result      JSONB,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_account ON action_rules(account_id, active);
CREATE INDEX idx_ae_account ON action_executions(account_id, created_at DESC);
CREATE INDEX idx_ae_rule ON action_executions(rule_id, created_at DESC);
```


---

## 5. Pipedrive Write Operations (fase 2)

```typescript
class PipedriveProvider extends BaseProvider {
  // EXISTENTES
  async search(accountId, params)
  async getResource(accountId, resourceType, externalId)

  // NOVOS
  async createDeal(accountId, data: CreateDealParams): Promise<any>
  async updateDeal(accountId, dealId, data: UpdateDealParams): Promise<any>
  async addNote(accountId, dealId, content: string): Promise<void>
}
```

Rotas:

```
POST /crm/api/v1/pipedrive/deals          → criar deal
PUT  /crm/api/v1/pipedrive/deals/:dealId  → atualizar deal
POST /crm/api/v1/pipedrive/deals/:dealId/notes → adicionar nota
```


---

## 6. Resumo de mudancas no codigo

| Arquivo | Mudanca |
|----|----|
| `prisma/schema.prisma` | + 6 tabelas (crm_organizations, organization_aliases, contact_organizations, webhook_events, action_rules, action_executions) + campo entity_type em crm_integrations |
| `src/modules/organizations/` (NOVO) | CRUD de organizacoes + vinculo com contatos |
| `src/modules/identity/identity.service.ts` | Evolucao: resolver por CNPJ, retornar organizacoes |
| `src/providers/clickup/clickup.provider.ts` | + 7 metodos write |
| `src/modules/clickup/clickup.routes.ts` | + 7 rotas |
| `src/modules/webhooks/` (NOVO) | Webhook receiver + normalizer |
| `src/modules/actions/` (NOVO) | Action dispatcher + rule engine |
| `src/providers/pipedrive/pipedrive.provider.ts` | + 3 metodos write |
| `src/modules/pipedrive/pipedrive.routes.ts` | + 3 rotas |
| `src/lib/http.ts` | Usar apiPost/apiPut (ja existem, sem uso) |


