# PRD — Vialum Portal Engine

> Engine multi-tenant de portais operacionais internos.
> Versao: 1.0.0 | Data: 2026-03-17 | Status: Proposta


---

## 1. Visao

Um servico que permite criar portais internos com formularios configuraveis por tenant. Cada portal é uma colecao de formularios que disparam acoes no ecossistema (criar card no ClickUp, enviar mensagem no WhatsApp, etc.).

Nao é um form builder generico — é um **engine operacional** onde cada formulario tem um proposito de negocio e se conecta ao restante do sistema.


---

## 2. Conceitos

| Conceito | Descricao |
|----|----|
| **Portal** | Um site/app com branding e formularios (ex: "Portal Genesis") |
| **Form** | Um formulario com campos, validacoes e actions (ex: "Novo Faturamento") |
| **Field** | Um campo do formulario com tipo, validacao e mapeamento |
| **Action** | O que acontece quando o form é submetido (criar task, enviar msg, etc.) |
| **Submission** | Um registro de formulario enviado (audit trail) |


---

## 3. Arquitetura

```
                    ┌───────────────────────────────┐
                    │      VIALUM PORTAL ENGINE      │
                    │          (Fastify)             │
                    │                                 │
  Browser (time) → │  GET  /portals/:slug            │ ← renderiza portal
                    │  GET  /portals/:slug/forms/:id  │ ← renderiza form
                    │  POST /portals/:slug/forms/:id  │ ← submete form
                    │                                 │
  Admin API    →   │  CRUD /api/v1/portals           │
                    │  CRUD /api/v1/portals/:id/forms │
                    │  GET  /api/v1/submissions       │
                    │                                 │
                    └──────────┬─────────────────────┘
                               │ Actions
                    ┌──────────▼─────────────────────┐
                    │  CRM Hub / Vialum Chat / etc    │
                    └────────────────────────────────┘
```


---

## 4. API — Configuracao (Admin)

### 4.1 Portais

```
POST /portal/api/v1/portals
Authorization: Bearer <JWT>

{
  "name": "Portal Genesis",
  "slug": "genesis",
  "branding": {
    "logoUrl": "https://...",
    "primaryColor": "#9FEC14",
    "darkMode": true
  },
  "authRequired": true
}
```

### 4.2 Formularios

```
POST /portal/api/v1/portals/:portalId/forms
Authorization: Bearer <JWT>

{
  "name": "Novo Faturamento",
  "slug": "faturamento",
  "description": "Lancar nova ordem de servico para emissao de contrato",
  "fields": [
    {
      "name": "nome_marca",
      "label": "Nome da Marca",
      "type": "text",
      "required": true,
      "placeholder": "Ex: Aquavitta"
    },
    {
      "name": "nome_cliente",
      "label": "Nome do Cliente",
      "type": "text",
      "required": true
    },
    {
      "name": "telefone",
      "label": "Telefone (WhatsApp)",
      "type": "phone",
      "required": true,
      "placeholder": "+55 43 99999-9999"
    },
    {
      "name": "tipo_pessoa",
      "label": "Tipo de Pessoa",
      "type": "select",
      "required": true,
      "options": [
        { "value": "PF", "label": "Pessoa Física" },
        { "value": "PJ", "label": "Pessoa Jurídica" }
      ]
    },
    {
      "name": "classes_mode",
      "label": "Definicao de Classes",
      "type": "select",
      "required": true,
      "options": [
        { "value": "quantity", "label": "Número de classes" },
        { "value": "specific", "label": "Classes específicas" }
      ]
    },
    {
      "name": "classes_value",
      "label": "Classes NCL",
      "type": "text",
      "required": true,
      "placeholder": "Ex: 2 ou 35, 42, 45",
      "helpText": "Informe a quantidade ou os numeros separados por virgula"
    },
    {
      "name": "valor",
      "label": "Valor do Contrato",
      "type": "currency",
      "required": true,
      "currency": "BRL"
    },
    {
      "name": "forma_pagamento",
      "label": "Forma de Pagamento",
      "type": "select",
      "required": true,
      "options": [
        { "value": "cartao", "label": "Cartão de Crédito" },
        { "value": "pix_manual", "label": "PIX Manual" },
        { "value": "pix_auto", "label": "PIX Automático" },
        { "value": "boleto_manual", "label": "Boleto Manual" },
        { "value": "boleto_auto", "label": "Boleto Automático" }
      ]
    },
    {
      "name": "parcelas",
      "label": "Parcelas",
      "type": "number",
      "required": false,
      "showWhen": { "field": "forma_pagamento", "operator": "equals", "value": "cartao" }
    }
  ],
  "actions": [
    {
      "type": "crm_hub.clickup.create_task",
      "params": {
        "listId": "901322069698",
        "name": "{{nome_marca}}",
        "description": "**Cliente:** {{nome_cliente}}\n**Telefone:** {{telefone}}\n**Tipo:** {{tipo_pessoa}}",
        "status": "preparação contratual",
        "customFields": [
          { "id": "d660b997", "value": "{{valor}}" },
          { "id": "c833a0a0", "value": "{{forma_pagamento}}" },
          { "id": "91595fd2", "value": "{{parcelas}}" },
          { "id": "28f75c34", "value": "{{classes_value}}" }
        ]
      }
    },
    {
      "type": "crm_hub.identity.resolve",
      "params": {
        "phone": "{{telefone}}",
        "name": "{{nome_cliente}}"
      }
    },
    {
      "type": "vialum_chat.send_message",
      "params": {
        "phone": "{{telefone}}",
        "mode": "direct",
        "content": "Olá, {{nome_cliente}}! Para darmos continuidade ao registro da marca *{{nome_marca}}*, precisamos de alguns dados seus. Vou te fazer algumas perguntas rápidas, tudo bem?"
      }
    },
    {
      "type": "vialum_chat.start_treeflow",
      "params": {
        "phone": "{{telefone}}",
        "treeflowSlug": "coleta-qualificacao",
        "variables": {
          "nome_marca": "{{nome_marca}}",
          "tipo_pessoa": "{{tipo_pessoa}}",
          "classes": "{{classes_value}}",
          "classes_mode": "{{classes_mode}}",
          "valor": "{{valor}}",
          "forma_pagamento": "{{forma_pagamento}}",
          "parcelas": "{{parcelas}}",
          "clickup_task_id": "{{_action_results.0.taskId}}"
        }
      }
    }
  ],
  "tracking": {
    "enabled": true,
    "source": "clickup",
    "listId": "901322069698",
    "displayFields": ["name", "status", "date_created"],
    "statusColors": {
      "preparação contratual": "#808080",
      "aguardando assinatura": "#FFA500",
      "aguardando documentos": "#4169E1",
      "documentos recebidos": "#90EE90",
      "preparação protocolo": "#9370DB",
      "protocolo inpi": "#4682B4",
      "acompanhamento": "#FFD700",
      "completo": "#32CD32"
    }
  }
}
```


---

## 5. Frontend

Reutiliza a abordagem do genesis-form-laudos: HTML/CSS/JS estatico renderizado pelo servidor.

### 5.1 Paginas

| Rota | Pagina |
|----|----|
| `/portal/:slug/login` | Login (mesmo sistema de auth) |
| `/portal/:slug` | Dashboard (lista de forms + tracking) |
| `/portal/:slug/forms/:formSlug` | Formulario |
| `/portal/:slug/tracking` | Acompanhamento (cards do ClickUp) |
| `/portal/:slug/admin` | Gestao de usuarios |

### 5.2 Rendering

O engine renderiza os campos dinamicamente a partir da definicao do form:

```typescript
// Cada field type tem um renderer
const fieldRenderers = {
  text:     (field) => `<input type="text" name="${field.name}" ...>`,
  phone:    (field) => `<input type="tel" name="${field.name}" ...>`,
  select:   (field) => `<select name="${field.name}">${field.options.map(o => ...)}</select>`,
  currency: (field) => `<input type="text" name="${field.name}" inputmode="decimal" ...>`,
  number:   (field) => `<input type="number" name="${field.name}" ...>`,
  textarea: (field) => `<textarea name="${field.name}" ...></textarea>`,
};

// showWhen: renderiza campo mas hidden, JS no frontend controla visibilidade
```

### 5.3 Branding

CSS variables injetadas do config do portal:

```css
:root {
  --primary: {{branding.primaryColor}};
  --dark: #070707;
  --logo: url('{{branding.logoUrl}}');
}
```


---

## 6. Database (schema `portal` no Postgres compartilhado)

```sql
CREATE TABLE portals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  branding    JSONB DEFAULT '{}',
  auth_required BOOLEAN DEFAULT true,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE TABLE portal_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id   UUID NOT NULL REFERENCES portals(id),
  account_id  UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description TEXT,
  fields      JSONB NOT NULL,           -- array de field definitions
  actions     JSONB NOT NULL,           -- array de action definitions
  tracking    JSONB,                    -- tracking config (opcional)
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, slug)
);

CREATE TABLE portal_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES portal_forms(id),
  account_id  UUID NOT NULL,
  data        JSONB NOT NULL,           -- dados submetidos
  action_results JSONB,                 -- resultado de cada action
  status      VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
  submitted_by VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth (mesmo sistema do genesis-form-laudos mas em DB)
CREATE TABLE portal_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       UUID NOT NULL REFERENCES portals(id),
  account_id      UUID NOT NULL,
  username        VARCHAR(100) NOT NULL,
  display_name    VARCHAR(255),
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) DEFAULT 'user',  -- admin, user
  must_change_pwd BOOLEAN DEFAULT true,
  active          BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, username)
);
```


---

## 7. Seguranca

* Auth por portal (usuarios isolados)
* Sessoes via cookie httpOnly com HMAC
* Passwords com scrypt (mesmo padrao genesis-form-laudos)
* CSRF protection (origin check)
* Rate limiting por IP e por portal


---

## 8. Tech Stack

* **Runtime**: Node.js 20 + Fastify
* **Template**: Server-side rendering (EJS ou template literals)
* **Frontend**: HTML/CSS/JS puro (sem framework — mesmo padrao genesis-form-laudos)
* **Database**: PostgreSQL (schema `portal`)
* **ORM**: Prisma
* **Estilo**: CSS reutilizado do genesis-form-laudos (dark theme, Sora font)
* **Container**: Docker, \~128MB memory limit
* **Port**: 3003


