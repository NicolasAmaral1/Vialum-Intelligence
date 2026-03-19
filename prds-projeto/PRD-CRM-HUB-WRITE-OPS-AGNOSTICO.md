# PRD — CRM Hub Write Operations (Abordagem Agnostica)

> Analise de escalabilidade e decisao arquitetural para write operations no CRM Hub.
> Versao: 1.0.0 | Data: 2026-03-17 | Status: Aprovado


---

## 1. Problema

O CRM Hub é read-only. Para o fluxo de protocolo (e qualquer automacao futura),
ele precisa **escrever** em sistemas externos (criar tasks, atualizar status, anexar
arquivos, comentar, atribuir).

A questao nao é "como chamar a API do ClickUp" — isso é trivial.
A questao é: **como expor isso sem acoplar todo o ecossistema ao ClickUp?**


---

## 2. Abordagem errada: rotas por provider

```
POST /crm/api/v1/clickup/tasks
PUT  /crm/api/v1/clickup/tasks/:id/status
POST /crm/api/v1/clickup/tasks/:id/comments
POST /crm/api/v1/pipedrive/deals
```

### Por que é errado

| Cenario | Consequencia |
|---------|-------------|
| Tenant A usa ClickUp, tenant B usa Asana | Dois conjuntos de rotas, dois conjuntos de SDKs |
| Migrar de ClickUp pra Linear | Mudar todos os consumidores (squads, portal, media service) |
| Novo provider (Monday, Notion) | Criar rotas novas, atualizar todos os consumidores |
| Audit trail | Espalhado por rotas diferentes, dificil agregar |

Todo consumidor fica acoplado ao nome do provider na URL. Trocar o provider = mudar tudo.


---

## 3. Abordagem correta: rotas por dominio

```
POST /crm/api/v1/tasks                    ← criar tarefa
PUT  /crm/api/v1/tasks/:id/status         ← atualizar status
POST /crm/api/v1/tasks/:id/comments       ← comentar
POST /crm/api/v1/tasks/:id/attachments    ← anexar arquivo
PUT  /crm/api/v1/tasks/:id/fields/:key    ← setar campo customizado
PUT  /crm/api/v1/tasks/:id/assignees      ← atribuir
POST /crm/api/v1/tasks/:id/tags           ← adicionar tag

POST /crm/api/v1/deals                    ← criar deal
PUT  /crm/api/v1/deals/:id                ← atualizar deal
POST /crm/api/v1/deals/:id/notes          ← adicionar nota

POST /crm/api/v1/folders                  ← criar pasta
GET  /crm/api/v1/folders?name=X           ← buscar pasta
```

O consumidor chama `/tasks`. O CRM Hub resolve qual provider usar baseado na
configuracao do tenant:

```
Tenant Genesis → provider_configs[category=tasks] = "clickup"  → ClickUpProvider
Tenant Futuro  → provider_configs[category=tasks] = "linear"   → LinearProvider
Tenant Outro   → provider_configs[category=tasks] = "asana"    → AsanaProvider
```


---

## 4. Arquitetura

```
Squad / Portal / Media Service
        │
        │  POST /crm/api/v1/tasks
        │  { name, status, ... }
        │
        ▼
┌────────────────────────────────────────────┐
│              CRM Hub (router)               │
│                                             │
│  1. JWT → accountId                         │
│  2. provider_configs[accountId, "tasks"]    │
│     → provider: "clickup"                  │
│  3. Provider Registry → ClickUpProvider     │
│  4. ClickUpProvider.createTask(config, ...) │
│  5. Auditar operacao em provider_operations │
│  6. Retornar resultado normalizado          │
└──────────┬──────────────────────────────────┘
           │
     ┌─────┴──────────┐
     │ Provider        │
     │ Registry        │
     ├─────────────────┤
     │ clickup    ●    │ ← implementado (v1)
     │ linear          │ ← futuro
     │ asana           │ ← futuro
     │ notion          │ ← futuro
     │ monday          │ ← futuro
     └─────────────────┘
```


---

## 5. Interface do provider (contrato interno)

```typescript
// providers/task-provider.interface.ts

interface TaskProvider {
  readonly name: string;

  // --- Read (parcialmente existente) ---
  search(config: ProviderConfig, params: SearchParams): Promise<TaskResource[]>;
  getTask(config: ProviderConfig, taskId: string): Promise<TaskResource>;

  // --- Write (novo) ---
  createTask(config: ProviderConfig, params: CreateTaskParams): Promise<TaskResource>;
  updateTask(config: ProviderConfig, taskId: string, params: UpdateTaskParams): Promise<TaskResource>;
  updateStatus(config: ProviderConfig, taskId: string, status: string): Promise<TaskResource>;
  addComment(config: ProviderConfig, taskId: string, text: string, mentionUserId?: string): Promise<void>;
  addAttachment(config: ProviderConfig, taskId: string, fileUrl: string, filename: string): Promise<void>;
  setField(config: ProviderConfig, taskId: string, fieldKey: string, value: any): Promise<void>;
  setAssignees(config: ProviderConfig, taskId: string, assigneeIds: string[]): Promise<void>;
  addTag(config: ProviderConfig, taskId: string, tag: string): Promise<void>;
  removeTag(config: ProviderConfig, taskId: string, tag: string): Promise<void>;
  getMembers(config: ProviderConfig): Promise<ProviderMember[]>;
}

interface CrmProvider {
  readonly name: string;

  search(config: ProviderConfig, params: SearchParams): Promise<CrmResource[]>;
  getResource(config: ProviderConfig, resourceType: string, id: string): Promise<CrmResource>;

  createDeal(config: ProviderConfig, params: CreateDealParams): Promise<CrmResource>;
  updateDeal(config: ProviderConfig, dealId: string, params: UpdateDealParams): Promise<CrmResource>;
  addNote(config: ProviderConfig, dealId: string, content: string): Promise<void>;
}

interface DocumentProvider {
  readonly name: string;

  searchFolders(config: ProviderConfig, query: string): Promise<FolderResource[]>;
  createFolder(config: ProviderConfig, name: string, parentId?: string): Promise<FolderResource>;
  uploadFile(config: ProviderConfig, folderId: string, fileUrl: string, filename: string): Promise<FileResource>;
}
```


---

## 6. Parametros de criacao

```typescript
interface CreateTaskParams {
  // --- Campos genericos (qualquer provider entende) ---
  name: string;
  description?: string;
  status?: string;
  assignees?: string[];           // emails ou IDs genericos
  tags?: string[];

  // --- Campos customizados (generico, cada provider mapeia) ---
  customFields?: Array<{
    key: string;                  // campo generico (ex: "valor", "forma_pagamento")
    value: any;
  }>;

  // --- Provider-specific (escape hatch) ---
  providerParams?: {
    listId?: string;              // ClickUp
    projectId?: string;           // Linear
    boardId?: string;             // Asana
    databaseId?: string;          // Notion
    [key: string]: any;
  };
}

interface UpdateTaskParams {
  name?: string;
  description?: string;
  status?: string;
  assignees?: {
    add?: string[];
    remove?: string[];
  };
  tags?: {
    add?: string[];
    remove?: string[];
  };
}
```


---

## 7. Configuracao por tenant

```
PUT /crm/api/v1/providers/tasks
Authorization: Bearer <JWT>

{
  "provider": "clickup",
  "config": {
    "apiToken": "pk_...",
    "defaults": {
      "listId": "901322069698",
      "assigneeMap": {
        "contato@avelumia.com": 12345678
      },
      "customFieldMap": {
        "valor": "d660b997",
        "forma_pagamento": "c833a0a0",
        "parcelas": "91595fd2",
        "classes": "28f75c34",
        "conversation_id": "xxxxxx",
        "documentos_inseridos": "842296be"
      }
    }
  }
}
```

### customFieldMap

Permite que o consumidor use nomes genericos (`"valor"`, `"forma_pagamento"`) em vez
de IDs especificos do ClickUp (`"d660b997"`). O provider traduz automaticamente:

```typescript
// O consumidor chama:
POST /crm/api/v1/tasks
{
  "name": "ACME",
  "customFields": [
    { "key": "valor", "value": 1500 },
    { "key": "forma_pagamento", "value": "pix_manual" }
  ]
}

// O ClickUpProvider traduz internamente pra:
POST https://api.clickup.com/api/v2/list/{listId}/task
{
  "name": "ACME",
  "custom_fields": [
    { "id": "d660b997", "value": 1500 },
    { "id": "c833a0a0", "value": "pix_manual" }
  ]
}
```

Se amanha trocar pra Linear, o LinearProvider faz a mesma traducao com os IDs do Linear.
O consumidor continua usando `"valor"` e `"forma_pagamento"`.

### assigneeMap

Converte email (generico) pra ID do provider:

```typescript
// Consumidor chama:
PUT /crm/api/v1/tasks/:id/assignees
{ "assignees": ["contato@avelumia.com"] }

// ClickUpProvider traduz:
PUT https://api.clickup.com/api/v2/task/{id}
{ "assignees": { "add": [12345678] } }
```


---

## 8. Resposta normalizada

Todos os providers retornam o mesmo formato:

```typescript
interface TaskResource {
  id: string;                    // ID no provider externo
  provider: string;              // "clickup", "linear", etc
  name: string;
  description?: string;
  status: string;
  assignees: string[];           // emails (resolvidos pelo assigneeMap reverso)
  tags: string[];
  customFields: Record<string, any>;  // chaves genericas, nao IDs do provider
  externalUrl: string;           // link direto pro provider
  createdAt: string;
  updatedAt: string;
}
```


---

## 9. Auditoria

Cada write operation gera um registro:

```sql
CREATE TABLE provider_operations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL,
  provider      VARCHAR(50) NOT NULL,
  category      VARCHAR(30) NOT NULL,     -- tasks, crm, documents
  operation     VARCHAR(50) NOT NULL,     -- create_task, update_status, add_comment...
  entity_id     VARCHAR(255),             -- ID no provider externo
  params        JSONB,                    -- o que foi enviado (sanitizado)
  result        JSONB,                    -- o que o provider retornou
  status        VARCHAR(20) NOT NULL,     -- success, failed, rate_limited
  error         TEXT,
  caller        VARCHAR(100),             -- squad:protocolo, portal, media-service
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_account ON provider_operations(account_id, created_at DESC);
CREATE INDEX idx_po_entity ON provider_operations(account_id, provider, entity_id);
CREATE INDEX idx_po_caller ON provider_operations(account_id, caller, created_at DESC);
```


---

## 10. Rate limiting e resiliencia

### Por provider

| Provider | Rate Limit | Nossa margem |
|----------|-----------|-------------|
| ClickUp | 100 req/min | 90 req/min |
| Pipedrive | 80 req/2s | 30 req/s |
| Linear | 2000 req/h | 1800 req/h |
| Google Drive | 300 req/min | 250 req/min |

### Implementacao

```typescript
abstract class BaseTaskProvider implements TaskProvider {
  protected rateLimiter: RateLimiter;

  constructor(limits: { maxPerMinute: number }) {
    this.rateLimiter = new RateLimiter(limits);
  }

  protected async callWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.rateLimiter.acquire();
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err)) {
        // Registrar no audit, aguardar, retry
        await this.rateLimiter.backoff();
        return await fn();
      }
      throw err;
    }
  }
}

class ClickUpTaskProvider extends BaseTaskProvider {
  constructor() {
    super({ maxPerMinute: 90 });
  }

  async createTask(config, params) {
    return this.callWithRateLimit(() =>
      this.api.post(`/list/${listId}/task`, payload)
    );
  }
}
```


---

## 11. Rotas finais do CRM Hub

### Tasks (category: tasks)

```
POST   /crm/api/v1/tasks                        ← criar task
GET    /crm/api/v1/tasks/:id                     ← buscar task
GET    /crm/api/v1/tasks?search=X&listId=Y       ← buscar por nome
PUT    /crm/api/v1/tasks/:id                     ← atualizar task
PUT    /crm/api/v1/tasks/:id/status              ← atualizar status
POST   /crm/api/v1/tasks/:id/comments            ← adicionar comentario
POST   /crm/api/v1/tasks/:id/attachments         ← anexar arquivo
PUT    /crm/api/v1/tasks/:id/fields/:key         ← setar campo customizado
PUT    /crm/api/v1/tasks/:id/assignees           ← atribuir
POST   /crm/api/v1/tasks/:id/tags                ← adicionar tag
DELETE /crm/api/v1/tasks/:id/tags/:tag           ← remover tag
GET    /crm/api/v1/tasks/members                 ← listar membros do workspace
```

### Deals (category: crm)

```
POST   /crm/api/v1/deals                         ← criar deal
GET    /crm/api/v1/deals/:id                      ← buscar deal
PUT    /crm/api/v1/deals/:id                      ← atualizar deal
POST   /crm/api/v1/deals/:id/notes               ← adicionar nota
```

### Folders (category: documents)

```
POST   /crm/api/v1/folders                        ← criar pasta
GET    /crm/api/v1/folders?name=X                 ← buscar pasta
POST   /crm/api/v1/folders/:id/files              ← upload arquivo
```

### Rotas existentes que continuam

```
POST   /crm/api/v1/identity/resolve               ← resolver identidade
POST   /crm/api/v1/agent/query                     ← consulta inteligente
GET    /crm/api/v1/agent/status                    ← status rapido

GET    /crm/api/v1/providers                       ← listar providers
PUT    /crm/api/v1/providers/:provider             ← configurar provider
POST   /crm/api/v1/providers/:provider/test        ← testar conexao

GET    /crm/api/v1/contacts/:id                    ← buscar contato
POST   /crm/api/v1/contacts/lookup                 ← find or create
```

### Rotas especificas de provider (deprecar gradualmente)

```
GET    /crm/api/v1/clickup/search                  ← migrar pra GET /tasks?search=X
GET    /crm/api/v1/pipedrive/search                ← migrar pra GET /deals?search=X
GET    /crm/api/v1/gdrive/search                   ← migrar pra GET /folders?name=X
```

Manter as rotas antigas funcionando durante transicao, mas novos consumidores
devem usar as rotas agnosticas.


---

## 12. Impacto em cada consumidor

| Consumidor | Chama | Nunca sabe |
|---|---|---|
| @protocolo (supersquad) | `GET /tasks?status=preparação contratual` | Que é ClickUp |
| @qualificacao | `PUT /tasks/:id/fields/conversation_id` | Que é ClickUp |
| @contrato | `POST /tasks/:id/attachments` | Que é ClickUp |
| @verificador | `POST /tasks/:id/tags { tag: "PAGO" }` | Que é ClickUp |
| @documentos | `POST /tasks/:id/comments` | Que é ClickUp |
| Portal Engine | `POST /tasks { name: "ACME" }` | Que é ClickUp |
| Media Service | `POST /tasks/:id/attachments` (via webhook) | Que é ClickUp |
| CRM Hub interno | `PUT /tasks/:id/assignees` | Que é ClickUp |

Se trocar ClickUp por Linear: muda **1 arquivo** (LinearProvider), configura tenant, tudo funciona.


---

## 13. Resumo de mudancas no codigo

| Arquivo | Mudanca |
|---------|---------|
| `src/providers/task-provider.interface.ts` (NOVO) | Interface generica TaskProvider |
| `src/providers/crm-provider.interface.ts` (EVOLUCAO) | Adicionar write methods |
| `src/providers/document-provider.interface.ts` (NOVO) | Interface generica DocumentProvider |
| `src/providers/clickup/clickup.task-provider.ts` (NOVO) | ClickUp implementa TaskProvider |
| `src/providers/pipedrive/pipedrive.crm-provider.ts` (EVOLUCAO) | Pipedrive implementa CrmProvider write |
| `src/providers/gdrive/gdrive.document-provider.ts` (EVOLUCAO) | GDrive implementa DocumentProvider write |
| `src/modules/tasks/tasks.routes.ts` (NOVO) | Rotas agnosticas /tasks |
| `src/modules/tasks/tasks.service.ts` (NOVO) | Service que roteia pro provider correto |
| `src/modules/deals/deals.routes.ts` (NOVO) | Rotas agnosticas /deals |
| `src/modules/folders/folders.routes.ts` (NOVO) | Rotas agnosticas /folders |
| `src/lib/rate-limiter.ts` (NOVO) | Rate limiter reutilizavel |
| `prisma/schema.prisma` | + tabela provider_operations |


---

## 14. Fases de implementacao

### Fase 1: TaskProvider + ClickUp (story 2.3)
- Interface TaskProvider
- ClickUpTaskProvider (8 write methods)
- Rotas /tasks (12 endpoints)
- Rate limiter
- Audit trail (provider_operations)

### Fase 2: CrmProvider write + PipedriveProvider (story futura)
- Evolucao da interface
- Write methods no Pipedrive
- Rotas /deals

### Fase 3: DocumentProvider write + GDriveProvider (story futura)
- Interface DocumentProvider
- Write methods no GDrive
- Rotas /folders

### Fase 4: Deprecar rotas por provider (migracao)
- Mover /clickup/search → /tasks?search=X
- Mover /pipedrive/search → /deals?search=X
- Mover /gdrive/search → /folders?name=X
- Manter rotas antigas como aliases temporarios
