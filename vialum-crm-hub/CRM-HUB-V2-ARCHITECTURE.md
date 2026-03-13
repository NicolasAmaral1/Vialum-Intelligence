# Vialum CRM Hub v2 — Arquitetura & Casos de Uso

> Documento de referência: banco de dados, API, providers e fluxos reais.
> Atualizado em: 2026-03-11

---

## Banco de Dados

### Estado Atual na VPS (pré-deploy v2)

```
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│  crm_contacts   │──<│  crm_integrations    │   │ provider_configs │
│                 │   │                      │   │                  │
│ id (PK)         │   │ id (PK)              │   │ id (PK)          │
│ vialum_contact_id│  │ crm_contact_id (FK)  │   │ account_id       │
│ account_id      │   │ provider             │   │ provider         │
│ phone           │   │ external_id          │   │ config (JSON)    │
│ email           │   │ external_url         │   │ active           │
│ name            │   │ resource_type        │   │ ❌ SEM category  │
│ tags[]          │   │ resource_name        │   └──────────────────┘
│ metadata (JSON) │   │ status / stage       │
│ created/updated │   │ value (decimal)      │
└─────────────────┘   │ synced_at            │
                      │ raw_data (JSON)      │
                      └──────────────────────┘
```

- 3 tabelas: `crm_contacts`, `crm_integrations`, `provider_configs`
- `provider_configs` ainda **não tem** coluna `category`
- Tabelas `contact_aliases` e `oauth_tokens` **não existem**
- 1 migration registrada: `20260306162317_init`

### Após Deploy v2 (migrations 0001 + 0002)

```
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│  crm_contacts   │──<│  crm_integrations    │   │ provider_configs │
│                 │   └──────────────────────┘   │ + category ✅    │
│                 │                               └──────────────────┘
│                 │──<┌──────────────────────┐   ┌──────────────────┐
│                 │   │  contact_aliases ✅  │   │ oauth_tokens ✅  │
└─────────────────┘   │                      │   │                  │
                      │ id (PK)              │   │ id (PK)          │
                      │ crm_contact_id (FK)  │   │ account_id       │
                      │ account_id           │   │ provider         │
                      │ type (phone|email|   │   │ access_token     │
                      │       cpf|cnpj)      │   │ refresh_token    │
                      │ value (normalizado)  │   │ expires_at       │
                      │ is_primary           │   │ token_type       │
                      │ UNIQUE(acc,type,val) │   │ scope            │
                      └──────────────────────┘   │ raw_response     │
                                                 │ UNIQUE(acc,prov) │
                                                 └──────────────────┘
```

**O que muda:**
- `provider_configs` ganha coluna `category` (VARCHAR 30, default 'crm')
- Nova tabela `contact_aliases` — lookup multi-identificador (N phones, emails, CPFs por contato)
- Nova tabela `oauth_tokens` — storage genérico de tokens OAuth com auto-refresh
- **Backfill automático:** phones e emails existentes em `crm_contacts` são copiados para `contact_aliases` como `is_primary = true`

---

## Esquema Detalhado das Tabelas

### crm_contacts
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| vialum_contact_id | UUID | link ao Vialum Chat |
| account_id | UUID | tenant isolation |
| phone | VARCHAR(50) | nullable |
| email | VARCHAR(255) | nullable |
| name | VARCHAR(255) | nullable |
| tags | TEXT[] | array de strings |
| metadata | JSONB | dados arbitrários |
| created_at / updated_at | TIMESTAMPTZ | auto |

**Unique:** `(account_id, vialum_contact_id)`
**Indexes:** `phone`, `email`

### contact_aliases (NOVO)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| crm_contact_id | UUID (FK) | CASCADE on delete |
| account_id | UUID | tenant isolation |
| type | VARCHAR(30) | phone, email, cpf, cnpj |
| value | VARCHAR(255) | normalizado (E.164 / lowercase) |
| is_primary | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | auto |

**Unique:** `(account_id, type, value)` — um identificador só pertence a 1 contato por conta
**Indexes:** `(account_id, value)`, `(crm_contact_id)`

### crm_integrations
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| crm_contact_id | UUID (FK) | CASCADE on delete |
| provider | VARCHAR(50) | pipedrive, clickup, gdrive, rdstation |
| external_id | VARCHAR(255) | ID no sistema externo |
| external_url | TEXT | link direto |
| resource_type | VARCHAR(50) | deal, person, task, folder, contact, organization |
| resource_name | VARCHAR(255) | nome legível |
| status | VARCHAR(100) | status no provider |
| stage | VARCHAR(100) | stage/fase |
| value | DECIMAL(12,2) | valor monetário |
| synced_at | TIMESTAMPTZ | última sincronização |
| raw_data | JSONB | resposta completa do provider |
| created_at / updated_at | TIMESTAMPTZ | auto |

**Unique:** `(crm_contact_id, provider, external_id)`
**Indexes:** `provider`, `external_id`

### provider_configs
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| account_id | UUID | tenant isolation |
| provider | VARCHAR(50) | nome do provider |
| category | VARCHAR(30) | crm, tasks, documents, marketing **(NOVO)** |
| config | JSONB | { apiKey, apiToken, domain, clientId, clientSecret, ... } |
| active | BOOLEAN | default true |
| created_at / updated_at | TIMESTAMPTZ | auto |

**Unique:** `(account_id, provider)`
**Index:** `(account_id, category, active)`

### oauth_tokens (NOVO)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID (PK) | auto-generated |
| account_id | UUID | tenant isolation |
| provider | VARCHAR(50) | rdstation, etc. |
| access_token | TEXT | token atual |
| refresh_token | TEXT | nullable |
| expires_at | TIMESTAMPTZ | quando expira |
| token_type | VARCHAR(30) | default 'Bearer' |
| scope | TEXT | escopos autorizados |
| raw_response | JSONB | resposta completa do OAuth |
| created_at / updated_at | TIMESTAMPTZ | auto |

**Unique:** `(account_id, provider)`

---

## Mapa Completo da API

**Base URL:** `https://api.luminai.ia.br/crm/api/v1`

### Sem Autenticação

| Método | Rota | Função |
|--------|------|--------|
| GET | `/crm/health` | Health check |
| GET | `/crm/api/v1/oauth/:provider/callback` | Callback OAuth (redirect externo) |

### Com JWT (`Authorization: Bearer <token>`)

#### Identity & Agent — Endpoints para IAs

| Método | Rota | Body / Query | Função |
|--------|------|-------------|--------|
| **POST** | `/identity/resolve` | `{ phone?, email?, name?, cpf?, externalId?, provider?, forceSync? }` | Resolve qualquer identificador → perfil unificado com todas as integrações |
| **POST** | `/agent/query` | `{ intent, identifier: { phone?, email?, name? }, filters?: { provider?, status? } }` | Query por intent — filtra recursos automaticamente |
| **GET** | `/agent/status` | `?phone=X` ou `?email=X` ou `?name=X` | Atalho para full_profile |

**Intents disponíveis:**

| Intent | Filtra por | Categoria |
|--------|-----------|-----------|
| `deal_status` | resourceType = deal | crm |
| `open_tasks` | resourceType = task | tasks |
| `documents` | resourceType = folder | documents |
| `full_profile` | sem filtro (tudo) | todas |
| `client_info` | resourceType = person, contact | crm |

#### Contacts — CRUD + Auto-sync

| Método | Rota | Função |
|--------|------|--------|
| GET | `/contacts/:vialumContactId` | Contato completo + integrações |
| GET | `/contacts/:vialumContactId/summary?phone=X&name=Y&email=Z` | Resumo compacto + auto-sync de providers |
| POST | `/contacts/lookup` | Find or create CRM contact por vialumContactId |
| PATCH | `/contacts/:id` | Atualizar tags e/ou metadata |

#### Providers — Configuração de Credenciais

| Método | Rota | Função |
|--------|------|--------|
| GET | `/providers` | Listar providers configurados para a conta |
| PUT | `/providers/:provider` | Configurar credenciais (apiKey, clientId, etc.) |
| POST | `/providers/:provider/test` | Testar conexão com o provider |
| DELETE | `/providers/:provider` | Desativar provider (soft delete) |

#### Provider-Specific — Busca e Vinculação Direta

| Método | Rota | Função |
|--------|------|--------|
| GET | `/pipedrive/search?phone=X` | Busca direta na API do Pipedrive |
| POST | `/pipedrive/link` | Vincular deal/person a contato CRM |
| GET | `/clickup/search?name=X` | Busca direta na API do ClickUp |
| POST | `/clickup/link` | Vincular task a contato CRM |
| GET | `/gdrive/search?name=X` | Busca direta na API do Google Drive |
| POST | `/gdrive/link` | Vincular folder a contato CRM |

#### OAuth

| Método | Rota | Função |
|--------|------|--------|
| GET | `/oauth/:provider/authorize` | Redireciona para tela de autorização OAuth (requer JWT) |

---

## Providers Registrados

| Provider | Categoria | searchByPhone | searchByEmail | searchByName | hasOAuth | Resources |
|----------|-----------|:---:|:---:|:---:|:---:|-----------|
| **pipedrive** | crm | ✅ | ❌ | ❌ | ❌ | person, deal |
| **clickup** | tasks | ❌ | ❌ | ✅ | ❌ | task |
| **gdrive** | documents | ❌ | ❌ | ✅ | ❌ | folder |
| **rdstation** | marketing | ✅ | ✅ | ❌ | ✅ | contact, deal, organization |

### Como o auto-sync funciona

1. Quando um endpoint precisa de dados atualizados, verifica `syncedAt` das integrações
2. Se **stale** (>30 minutos) ou **sem integrações**, dispara sync
3. O sync itera por **todos os providers ativos** da conta
4. Cada provider só é chamado se **suporta** o identificador disponível (phone, email, name)
5. Resultados são salvos/atualizados em `crm_integrations` via upsert
6. Novo provider adicionado = **zero mudanças** no código de sync

---

## Casos de Uso Reais

### Caso 1: ClickUp — Gestão de Clientes e Processos

**Cenário:** Atendente no Vialum Chat recebe mensagem de cliente existente. Precisa saber os processos em andamento.

**Request:**
```http
POST /crm/api/v1/agent/query
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "intent": "open_tasks",
  "identifier": { "phone": "+5511999887766" }
}
```

**Fluxo interno:**
1. `identity.resolve()` normaliza phone → `5511999887766`
2. Busca em `contact_aliases` (type=phone, value=5511999887766)
3. Encontra `crm_contact_id` → carrega integrações
4. Se stale (>30min), auto-sync: `ClickUp.search(name=...)` → busca tasks
5. Filtra por `resourceType = 'task'` (intent = open_tasks)

**Response:**
```json
{
  "data": {
    "contact": {
      "id": "a1b2c3d4-...",
      "name": "Marca XYZ Ltda",
      "phone": "5511999887766",
      "email": "contato@xyz.com"
    },
    "resources": [
      {
        "externalId": "86aft0umj",
        "resourceType": "task",
        "resourceName": "Marca XYZ",
        "status": "contrato + proc",
        "externalUrl": "https://app.clickup.com/t/86aft0umj"
      },
      {
        "externalId": "86bgt1vnk",
        "resourceType": "task",
        "resourceName": "Marca ABC",
        "status": "protocolo",
        "externalUrl": "https://app.clickup.com/t/86bgt1vnk"
      }
    ],
    "meta": {
      "resolvedVia": "phone",
      "syncedAt": "2026-03-11T14:30:00Z",
      "providers": ["clickup"]
    }
  }
}
```

**O agente IA responde:** *"Você tem 2 processos: Marca XYZ está em 'contrato + procuração', e Marca ABC está em fase de 'protocolo'."*

---

### Caso 2: Pipedrive / RD Station — Pipeline de SDR

**Cenário:** SDR recebe lead por WhatsApp. Quer saber se já existe no CRM e qual o status do deal.

**Request:**
```http
POST /crm/api/v1/agent/query
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "intent": "deal_status",
  "identifier": { "phone": "+5521988776655" }
}
```

**Fluxo interno:**
1. Identity resolve busca em aliases → não encontra
2. Busca em `crm_contacts.phone` → não encontra
3. **Cria contato novo** + alias (phone, is_primary=true)
4. Auto-sync dispara em paralelo:
   - `Pipedrive.search(phone=5521988776655)` → encontra person + 2 deals
   - `RDStation.search(phone=5521988776655)` → encontra contact + 1 deal
   - ClickUp: **skip** (não busca por phone)
   - GDrive: **skip** (não busca por phone)
5. Upsert em `crm_integrations`
6. Filtra por `resourceType = 'deal'` (intent = deal_status)

**Response:**
```json
{
  "data": {
    "contact": {
      "id": "e5f6g7h8-...",
      "name": "João Silva",
      "phone": "5521988776655",
      "email": null
    },
    "resources": [
      {
        "externalId": "123",
        "resourceType": "deal",
        "resourceName": "João Silva - Registro Marca",
        "status": "open",
        "stage": "Proposta Enviada",
        "value": 1500.00,
        "externalUrl": "https://genesis.pipedrive.com/deal/123"
      },
      {
        "externalId": "456",
        "resourceType": "deal",
        "resourceName": "João Silva - Consultoria",
        "status": "won",
        "stage": "Fechado",
        "value": 3000.00,
        "externalUrl": "https://genesis.pipedrive.com/deal/456"
      },
      {
        "externalId": "rd-789",
        "resourceType": "deal",
        "resourceName": "João Silva",
        "status": "in_progress",
        "stage": "Qualificação",
        "value": null,
        "externalUrl": null
      }
    ],
    "meta": {
      "resolvedVia": "phone",
      "syncedAt": "2026-03-11T15:00:00Z",
      "providers": ["pipedrive", "rdstation"]
    }
  }
}
```

**O SDR sabe:** *"Lead já existe. 1 deal aberto no Pipedrive (R$1.500, Proposta Enviada), 1 ganho (R$3.000), e 1 em qualificação no RD Station."*

**Filtrar só Pipedrive:**
```json
{
  "intent": "deal_status",
  "identifier": { "phone": "+5521988776655" },
  "filters": { "provider": "pipedrive" }
}
```

**Filtrar só deals abertos:**
```json
{
  "intent": "deal_status",
  "identifier": { "phone": "+5521988776655" },
  "filters": { "status": "open" }
}
```

---

### Caso 3: Vialum Chat — Perfil Completo para Atendimento

**Cenário:** IA do chat precisa de contexto completo antes de responder um cliente.

**Request (atalho):**
```http
GET /crm/api/v1/agent/status?phone=+5511999887766
Authorization: Bearer <jwt>
```

**Response (full_profile — todas as integrações, sem filtro):**
```json
{
  "data": {
    "contact": {
      "id": "a1b2c3d4-...",
      "name": "Maria Empresa",
      "phone": "5511999887766",
      "email": "maria@empresa.com"
    },
    "resources": [
      {
        "externalId": "42",
        "resourceType": "person",
        "resourceName": "Maria Empresa",
        "externalUrl": "https://genesis.pipedrive.com/person/42"
      },
      {
        "externalId": "789",
        "resourceType": "deal",
        "resourceName": "Registro Marca Maria",
        "status": "open",
        "stage": "Em Análise",
        "value": 2000.00,
        "externalUrl": "https://genesis.pipedrive.com/deal/789"
      },
      {
        "externalId": "86xyz123",
        "resourceType": "task",
        "resourceName": "Maria Empresa",
        "status": "docs + gru",
        "externalUrl": "https://app.clickup.com/t/86xyz123"
      },
      {
        "externalId": "folder-abc",
        "resourceType": "folder",
        "resourceName": "Maria Empresa",
        "externalUrl": "https://drive.google.com/drive/folders/abc"
      }
    ],
    "meta": {
      "resolvedVia": "phone",
      "syncedAt": "2026-03-11T14:45:00Z",
      "providers": ["pipedrive", "clickup", "gdrive"]
    }
  }
}
```

**A IA do chat monta contexto:** *"Cliente Maria Empresa: deal de R$2.000 em análise no Pipedrive, processo na fase 'docs + gru' no ClickUp, documentos disponíveis no Google Drive."*

---

### Caso 4: Identity Resolve — Múltiplos Identificadores

**Cenário:** Sistema recebe email de um lead e quer saber se já é cliente.

**Request:**
```http
POST /crm/api/v1/identity/resolve
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "email": "joao@empresa.com.br",
  "cpf": "123.456.789-00",
  "forceSync": true
}
```

**Response:**
```json
{
  "data": {
    "crmContactId": "e5f6g7h8-...",
    "name": "João da Silva",
    "phone": "5521988776655",
    "email": "joao@empresa.com.br",
    "aliases": [
      { "type": "phone", "value": "5521988776655", "isPrimary": true },
      { "type": "email", "value": "joao@empresa.com.br", "isPrimary": true },
      { "type": "cpf", "value": "12345678900", "isPrimary": false }
    ],
    "providers": {
      "pipedrive": [
        { "externalId": "42", "resourceType": "person", "resourceName": "João da Silva" },
        { "externalId": "123", "resourceType": "deal", "resourceName": "Registro Marca", "status": "open", "value": 1500 }
      ],
      "clickup": [
        { "externalId": "86abc", "resourceType": "task", "resourceName": "João da Silva", "status": "em processo" }
      ],
      "rdstation": [
        { "externalId": "rd-456", "resourceType": "contact", "resourceName": "João da Silva" }
      ]
    },
    "lastSyncedAt": "2026-03-11T15:10:00Z"
  }
}
```

**Poder:** Na próxima vez que esse contato aparecer por **qualquer** um dos 3 identificadores (phone, email ou CPF), o sistema resolve instantaneamente para o mesmo `crmContactId`. Sem duplicatas.

---

### Caso 5: Configuração de Provider — Setup Inicial

**Cenário:** Admin configura Pipedrive para a conta.

**Passo 1 — Salvar credenciais:**
```http
PUT /crm/api/v1/providers/pipedrive
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "apiToken": "abc123...",
  "domain": "genesis"
}
```

**Passo 2 — Testar conexão:**
```http
POST /crm/api/v1/providers/pipedrive/test
Authorization: Bearer <jwt>
```
```json
{ "data": { "provider": "pipedrive", "connected": true } }
```

**Para RD Station (OAuth):**
```http
PUT /crm/api/v1/providers/rdstation
{ "clientId": "xxx", "clientSecret": "yyy" }
```
Depois acessar: `GET /crm/api/v1/oauth/rdstation/authorize` → redireciona para RD Station → callback salva tokens automaticamente.

---

### Caso 6: Sidebar do Vialum Chat — Resumo Rápido

**Cenário:** Chat abre conversa e sidebar precisa mostrar dados do contato.

**Request:**
```http
GET /crm/api/v1/contacts/550e8400-e29b-41d4-a716-446655440000/summary?phone=+5511999887766&name=Maria+Empresa
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "data": {
    "crmContactId": "a1b2c3d4-...",
    "tags": ["cliente-ativo", "marca-registrada"],
    "metadata": { "segmento": "PI", "origem": "indicacao" },
    "integrations": [
      {
        "provider": "pipedrive",
        "resourceType": "deal",
        "resourceName": "Registro Marca Maria",
        "status": "open",
        "stage": "Em Análise",
        "value": "2000.00",
        "externalUrl": "https://genesis.pipedrive.com/deal/789"
      },
      {
        "provider": "clickup",
        "resourceType": "task",
        "resourceName": "Maria Empresa",
        "status": "docs + gru"
      }
    ]
  }
}
```

---

## Fluxo de Dados — Visão Geral

```
                    ┌─────────────┐
                    │ Vialum Chat │
                    │   (agente)  │
                    └──────┬──────┘
                           │ POST /agent/query
                           │ POST /identity/resolve
                           │ GET  /agent/status
                           │ GET  /contacts/:id/summary
                           ▼
                    ┌──────────────┐
                    │   CRM Hub    │
                    │  (Fastify)   │
                    │  port 3100   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌────────────┐ ┌─────────┐ ┌─────────┐
       │ contact_   │ │  crm_   │ │provider_│
       │ aliases    │ │contacts │ │configs  │
       │ (lookup)   │ │ (base)  │ │(creds)  │
       └────────────┘ └────┬────┘ └────┬────┘
                           │           │
                    ┌──────┴───────┐   │ getConfig()
                    │    crm_      │   │
                    │ integrations │   │
                    │  (cache)     │   │
                    └──────────────┘   │
                                       │
              ┌─────────┬──────────┬───┴────────┐
              ▼         ▼          ▼            ▼
         Pipedrive  ClickUp   GDrive    RD Station
         (API key)  (API key) (API key)  (OAuth 2)
```

### Fluxo de Identity Resolution

```
Identificador (phone/email/cpf/externalId)
         │
         ▼
  ┌──────────────────┐
  │ 1. contact_aliases│ ── match? ──→ crmContactId encontrado
  │    (indexed)      │
  └────────┬─────────┘
           │ não
           ▼
  ┌──────────────────┐
  │ 2. crm_integrations│ ── match externalId+provider? ──→ crmContactId
  │    (fallback)      │
  └────────┬───────────┘
           │ não
           ▼
  ┌──────────────────┐
  │ 3. crm_contacts   │ ── match phone/email direto? ──→ crmContactId
  │    (legacy compat) │
  └────────┬───────────┘
           │ não
           ▼
  ┌──────────────────┐
  │ 4. CRIAR contato  │ ──→ novo crmContactId
  │    + aliases       │     + auto-sync todos os providers
  └────────────────────┘
```

---

## Estrutura de Diretórios (src/)

```
src/
  index.ts                          # Entry point, rotas, JWT scope
  config/
    env.ts                          # Variáveis de ambiente
    database.ts                     # Prisma client singleton
    vialum-db.ts                    # Conexão ao banco do Vialum Chat
  lib/
    http.ts                         # Helper HTTP genérico
    oauth.ts                        # OAuthHelper (getValidToken, refresh, store)
    phone.ts                        # Normalização E.164
    rate-limiter.ts                 # Sliding window in-memory
    sync.ts                         # Auto-sync genérico (isStale, syncProviders)
  middleware/
    jwt-auth.ts                     # JWT validation hook
  providers/                        # Provider Abstraction Layer
    provider.interface.ts           # CrmProvider interface + types
    provider.base.ts                # BaseProvider<T> abstract class
    provider.registry.ts            # Map<string, CrmProvider> registry
    index.ts                        # initProviders() — registra todos
    pipedrive/
      pipedrive.provider.ts         # PipedriveProvider extends BaseProvider
      pipedrive.types.ts
    clickup/
      clickup.provider.ts           # ClickUpProvider extends BaseProvider
      clickup.types.ts
    gdrive/
      gdrive.provider.ts            # GDriveProvider extends BaseProvider
      gdrive.types.ts
    rdstation/
      rdstation.provider.ts         # RDStationProvider extends BaseProvider
      rdstation.types.ts
  modules/
    contacts/
      contacts.routes.ts            # GET/:id, GET/:id/summary, POST/lookup, PATCH/:id
      contacts.service.ts           # findByVialumContactId, getSummary, lookup, update
    integrations/
      integrations.routes.ts        # Rotas de integrações diretas
      integrations.service.ts
    identity/
      identity.routes.ts            # POST /identity/resolve
      identity.service.ts           # resolve() — identity resolution engine
    agent/
      agent.routes.ts               # POST /agent/query, GET /agent/status
      agent.service.ts              # query() — intent-based filtering
    oauth/
      oauth.routes.ts               # GET /oauth/:provider/authorize|callback
    providers.ts                    # GET|PUT|POST|DELETE /providers/:provider
    pipedrive/
      pipedrive.routes.ts           # Thin wrapper → PipedriveProvider
    clickup/
      clickup.routes.ts             # Thin wrapper → ClickUpProvider
    gdrive/
      gdrive.routes.ts              # Thin wrapper → GDriveProvider
```

---

## Deploy

**Infraestrutura:**
- VPS: `api.luminai.ia.br` (Traefik + SSL)
- Container: `vialum-crm-hub` (Node.js 20 Alpine)
- Porta: 3100
- DB: PostgreSQL (`crm_hub`)

**Comando de deploy:**
```bash
docker compose build crm-hub && docker compose up -d crm-hub
```

**Migrations rodam automaticamente** no startup via `deploy-migrate.sh`:
1. Tenta `prisma migrate deploy`
2. Se falhar (tabelas já existem), marca 0000_initial e 0001_add_category como "applied"
3. Executa migrations pendentes (0002_identity_and_oauth)

**RD Station setup pós-deploy:**
1. Criar app no RD Station → obter clientId + clientSecret
2. `PUT /providers/rdstation` com credenciais
3. `GET /oauth/rdstation/authorize` → autorizar → tokens salvos automaticamente
