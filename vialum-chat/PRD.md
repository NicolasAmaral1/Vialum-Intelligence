Tenho todo o contexto necessario. Agora vou produzir o PRD completo e detalhado.


---

# PRD — Vialum Chat

## Documento de Requisitos de Produto (Product Requirements Document)

**Versao:** 1.0.0
**Data:** 2026-03-02
**Status:** Draft — Aprovacao Pendente
**Autor:** Vialum Intelligence (planejado via Claude Code)
**Workspace:** `/Users/nicolasamaral/Vialum-Intelligence/`


---

## Indice


 1. Visao Geral do Produto
 2. Personas e Usuarios
 3. Escopo do MVP e Fases de Desenvolvimento
 4. Funcionalidades Detalhadas com User Stories
 5. Modelo de Dados Completo
 6. API Endpoints Principais
 7. Arquitetura Tecnica
 8. Fluxos de Dados
 9. Sistema AI HITL — Sugestoes de Mensagens
10. Constructor de Automacoes
11. Requisitos de Seguranca
12. Infraestrutura Docker
13. Roteamento Traefik
14. Criterios de Aceite do MVP
15. Riscos e Mitigacoes


---

## 1. Visao Geral do Produto

### 1.1 O que e o Vialum Chat

O Vialum Chat e uma plataforma de engajamento de clientes multicanal, multi-tenant, com foco em WhatsApp — inspirada no Chatwoot, porem projetada desde a base para as necessidades operacionais da Vialum Intelligence.

O produto centraliza todas as conversas de WhatsApp em um unico dashboard, permite que agentes humanos gerenciem conversas em escala, e introduz um sistema HITL (Human-in-the-Loop) de sugestoes de mensagens geradas por IA — onde o agente humano aprova, edita ou rejeita cada sugestao antes de ela ser enviada.

### 1.2 Problema que Resolve

Atualmente, conversas de WhatsApp com clientes da Genesis Registro de Marcas sao gerenciadas de forma dispersa. Nao ha visibilidade centralizada, nao ha historico unificado, nao ha automacao de triagem e nao ha mecanismo sistematico de uso de IA para acelerar respostas — sem abrir mao do controle humano obrigatorio (HITL).

### 1.3 Proposta de Valor

* **Visibilidade total:** Todas as conversas em um dashboard, com status, filtros e busca em tempo real
* **Velocidade com controle:** IA sugere respostas; humano aprova — o melhor dos dois mundos
* **Automacao inteligente:** Regras condicionais automatizam triagem, labels e acoes repetitivas
* **Multi-tenant nativo:** Uma instancia suporta multiplas contas (futuro: clientes SaaS)
* **Provider-agnostico:** Evolution API ou WhatsApp Cloud API — intercambiaveis via abstração

### 1.4 Principios de Design


1. **HITL obrigatorio para IA:** Nenhuma mensagem gerada por IA e enviada sem aprovacao humana explicita
2. **Tempo real como padrao:** WebSocket para todas as atualizacoes criticas
3. **Auditabilidade:** Todo evento relevante e registrado com timestamp e autor
4. **Simplicidade operacional:** Deploy via Docker Compose, sem orquestradores complexos
5. **Consistencia com o ecossistema existente:** Patterns identicos aos dos servicos genesis-protocolo e genesis-laudo ja em producao


---

## 2. Personas e Usuarios

### 2.1 Agente de Atendimento (Papel Principal)

**Quem e:** Colaborador da Genesis Registro de Marcas responsavel por atender clientes via WhatsApp

**Objetivos:**

* Ver todas as conversas abertas em um unico lugar
* Responder rapidamente com o auxilio de sugestoes de IA
* Usar respostas padronizadas (canned responses) para perguntas frequentes
* Classificar conversas com labels para rastreamento

**Dores atuais:**

* Conversas espalhadas em multiplos dispositivos/numeros
* Sem historico centralizado
* Sem templates de resposta
* Sem visao de quais conversas precisam de atencao urgente

**User stories principals:**

* Como agente, quero ver todas as conversas abertas em um dashboard para nao perder nenhuma interacao
* Como agente, quero receber sugestoes de resposta da IA acima do campo de texto para acelerar meu atendimento
* Como agente, quero usar atalhos `/` para inserir respostas prontas sem digitar tudo novamente

### 2.2 Administrador da Conta

**Quem e:** Gestor da operacao da Genesis, responsavel por configurar o sistema

**Objetivos:**

* Configurar inboxes de WhatsApp (conectar numeros)
* Criar regras de automacao para triagem automatica
* Gerenciar agentes e suas permissoes
* Monitorar fila de sugestoes pendentes de IA

**User stories principais:**

* Como admin, quero conectar um numero de WhatsApp via Evolution API para comecar a receber mensagens
* Como admin, quero criar uma regra que atribui label "urgente" quando uma mensagem contem "prazo"
* Como admin, quero ver a fila de sugestoes de IA pendentes para garantir que nenhuma esteja esperando ha muito tempo

### 2.3 Supervisor / Revisor de IA (Papel Futuro — v2)

**Quem e:** Responsavel por revisar sugestoes de IA em bulk, especialmente para disparos outbound

**Objetivos:**

* Revisar e aprovar/rejeitar multiplas sugestoes de uma vez
* Monitorar qualidade das sugestoes ao longo do tempo
* Identificar conversas que precisam de intervencao humana


---

## 3. Escopo do MVP e Fases de Desenvolvimento

### 3.1 MVP — Fase 1 (Vialum Chat v1)

**Entregavel central:** Dashboard funcional de atendimento WhatsApp com IA HITL

**Escopo incluido:**

| Funcionalidade | Descricao | Prioridade |
|----|----|----|
| Unified Inbox | Dashboard com todas as conversas, filtros, busca, status | P0 |
| Mensageria em tempo real | Receber e enviar mensagens WhatsApp via WebSocket | P0 |
| Auth JWT | Login, sessao, refresh token | P0 |
| Multi-tenant basico | Isolamento por account_id | P0 |
| Provider abstraction | Evolution API + Cloud API intercambiaveis | P0 |
| AI HITL inline | Sugestoes acima do input, aprovar/editar/rejeitar | P1 |
| AI Pending Queue | Tela de fila de sugestoes pendentes | P1 |
| Canned Responses | Respostas prontas com atalho `/` | P1 |
| Labels | Labels coloridas em conversas | P1 |
| Automation Builder | Regras evento-condicao-acao | P2 |
| WebSocket real-time | Atualizacoes instantaneas para todos os agentes | P0 |
| Notificacoes de fila | Badges de mensagens nao lidas | P1 |

**Escopo excluido do MVP:**

| Funcionalidade | Versao |
|----|----|
| Contact CRM / custom fields avancados | v2 |
| Teams, assignment round-robin | v2 |
| Relatorios e analytics | v2 |
| Instagram / outros canais | v3 |
| Task/subtask system integrado | Projeto separado via webhook |
| Mobile app | Futuro |

### 3.2 Fase 2 (v2) — CRM e Times

* Contact management com custom_attributes e historico completo
* Teams com assignment automatico (round-robin)
* Relatorios basicos: tempo de resposta, volume por agente, volume por inbox
* Macros: sequencias de acoes em um clique

### 3.3 Fase 3 (v3) — Canais e Integracao Avancada

* Instagram DM como canal adicional
* Integracao bidirecional com ClickUp (tasks criadas a partir de conversas)
* Webhook outbound configuravel para integracao com sistemas externos
* API publica documentada para desenvolvedores


---

## 4. Funcionalidades Detalhadas com User Stories

### 4.1 Unified Inbox

**Descricao:** Dashboard principal que exibe todas as conversas de WhatsApp em colunas ou lista, com indicadores de status, agente atribuido, ultima mensagem e tempo de espera.

**User Stories:**

> US-001: Como agente, quero ver todas as conversas abertas listadas por ordem de ultima atividade, para priorizar as mais antigas sem atendimento.

> US-002: Como agente, quero filtrar conversas por status (aberta/pendente/resolvida/snoozed) para focar no que precisa de atencao agora.

> US-003: Como agente, quero buscar conversas pelo nome do contato ou conteudo da mensagem para encontrar rapidamente um historico especifico.

> US-004: Como agente, quero ver um badge com o numero de mensagens nao lidas em cada conversa para saber onde ha interacao nova.

> US-005: Como agente, quero ver atualizacoes em tempo real quando uma nova mensagem chegar — sem precisar recarregar a pagina.

> US-006: Como agente, quero marcar uma conversa como "resolvida" com um clique para mover ela da fila ativa.

> US-007: Como agente, quero "sonecizar" (snooze) uma conversa por um periodo definido para ela voltar para a fila automaticamente apos o tempo.

**Criterios de Aceite:**

* Conversas ordenadas por `last_activity_at` DESC por padrao
* Filtro por status funciona sem recarregar a pagina (client-side filter sobre dados do WebSocket)
* Busca com debounce de 300ms, busca em `contacts.name`, `contacts.phone`, `messages.content`
* Badge de nao lidas atualizado via WebSocket quando nova mensagem chega
* Mudar status de conversa reflete imediatamente para todos os agentes conectados
* Snooze armazena `snoozed_until: TIMESTAMPTZ`, job BullMQ reabre automaticamente

### 4.2 Thread de Conversa

**Descricao:** Visualizacao completa do historico de mensagens de uma conversa, com input para enviar nova mensagem e area de sugestoes de IA.

**User Stories:**

> US-010: Como agente, quero ver o historico completo de mensagens de uma conversa, com indicacao de status (enviado/entregue/lido), para entender o contexto antes de responder.

> US-011: Como agente, quero enviar mensagens de texto simples, imagens e arquivos para o contato via WhatsApp.

> US-012: Como agente, quero ver notas internas (private messages) visiveis apenas para agentes, diferenciadas visualmente das mensagens enviadas ao cliente.

> US-013: Como agente, quero que ao digitar `/` no campo de mensagem apareca um dropdown com canned responses filtradas pelo que digitei a seguir.

> US-014: Como agente, quero ver sugestoes de IA aparecendo ACIMA do campo de input, com botoes para enviar diretamente, editar antes de enviar, ou descartar.

**Criterios de Aceite:**

* Scroll infinito: carrega ultimas 50 mensagens, "carregar mais" para historico anterior
* Status de mensagem: enviando (spinner) → enviado (check simples) → entregue (check duplo) → lido (check duplo azul)
* Notas internas tem fundo amarelo/cinza diferenciado e icone de cadeado
* Canned response dropdown: filtro em tempo real pelo `short_code` digitado apos `/`, seleciona com Enter ou clique
* Sugestoes de IA: componente acima do input, aparece quando `AISuggestion.status = 'pending'` para aquela conversa, suporte a multiplas sugestoes simultaneas

### 4.3 AI HITL — Sugestoes de Mensagens

**Descricao bidirecional:**

**Modo Inline (dentro da conversa):** Quando uma nova mensagem entra, o sistema de IA analisa o contexto e gera sugestoes que aparecem ACIMA do campo de input. O agente pode: (a) clicar "Enviar" para mandar a sugestao como esta, (b) clicar "Editar" para modificar antes de enviar, (c) clicar "Descartar" para ignorar.

**Modo Fila Pendente (tela separada):** Uma tela dedicada exibe todas as sugestoes com `status = 'pending'` de todas as conversas. Util para revisao em batch ou campanhas outbound. Suporta aprovacao em massa.

**User Stories:**

> US-020: Como agente, quero que o sistema automaticamente gere sugestoes de resposta baseadas no historico da conversa e no estagio do funil, para acelerar meu atendimento sem perder qualidade.

> US-021: Como agente, quero ver as sugestoes destacadas visivelmente ACIMA do campo de texto, nao como rascunhos — para nao confundir com o que eu mesmo estou digitando.

> US-022: Como agente, quero editar uma sugestao de IA antes de enviar, para personalizar quando necessario.

> US-023: Como agente, quero ver na fila de sugestoes: o nome do contato, o conteudo da sugestao, o tempo que esta esperando e o estagio do funil — para priorizar o que revisar primeiro.

> US-024: Como admin, quero configurar em qual estagio do funil o sistema de IA e acionado, para evitar sugestoes desnecessarias em conversas ja resolvidas.

**Criterios de Aceite:**

* Sugestao gerada e armazenada como `AISuggestion.status = 'pending'`
* Push via WebSocket para o frontend assim que a sugestao e criada (evento `ai_suggestion:new`)
* Botao "Enviar" altera `status → 'sent'` e chama a API de envio de mensagem
* Botao "Editar e Enviar" abre textarea inline preenchido com a sugestao, ao confirmar: `status → 'edited'`, `edited_content` preenchido, mensagem enviada
* Botao "Descartar" altera `status → 'rejected'`
* Fila pendente: endpoint `GET /api/v1/ai-suggestions?status=pending` com paginacao
* Aprovacao em massa: `PATCH /api/v1/ai-suggestions/bulk` com array de IDs e nova acao

### 4.4 Canned Responses

**Descricao:** Respostas pre-cadastradas com `short_code` que o agente acessa digitando `/` no campo de mensagem.

**User Stories:**

> US-030: Como admin, quero criar respostas padronizadas com um atalho curto para que agentes possam usa-las rapidamente.

> US-031: Como agente, quero acionar uma canned response digitando `/atalho` no campo de mensagem e selecionar do dropdown.

**Criterios de Aceite:**

* CRUD completo de canned responses por account
* `short_code` unico por account, case-insensitive, apenas alfanumerico e hifen
* Dropdown filtra em tempo real enquanto agente digita apos `/`
* Suporte a variaveis basicas no conteudo: `{{contact.name}}`, `{{agent.name}}`
* Selecionar a canned response substitui o conteudo do campo de input

### 4.5 Labels

**Descricao:** Tags coloridas aplicadas a conversas para categorizar, filtrar e acionar automacoes.

**User Stories:**

> US-035: Como admin, quero criar labels com nome e cor para categorizar conversas da forma que fizer sentido para o meu negocio.

> US-036: Como agente, quero adicionar uma ou mais labels a uma conversa para indicar categoria, urgencia ou estagio.

**Criterios de Aceite:**

* CRUD de labels por account com campo `color` (hexadecimal)
* Multiplas labels por conversa (tabela `conversation_labels`)
* Labels aparecem como pills coloridas na listagem e na thread
* Filtro por label no inbox funciona via WebSocket (sem reload)
* Labels disparam eventos `conversation:updated` via WebSocket

### 4.6 Automation Builder

**Descricao:** Interface de formulario condicional (nao um flow builder visual) onde o admin define regras no formato: Evento → Condicoes → Acoes. Similar ao sistema de automacoes do Chatwoot.

**User Stories:**

> US-040: Como admin, quero criar uma regra que automaticamente adiciona a label "urgente" quando uma mensagem contem as palavras "prazo" ou "vencimento".

> US-041: Como admin, quero criar uma regra que quando uma conversa e criada em determinado inbox, ela e automaticamente atribuida a um agente especifico.

> US-042: Como admin, quero criar uma regra que dispara uma mensagem automatica de boas-vindas quando uma nova conversa e criada.

**Eventos suportados:**

| Evento | Descricao |
|----|----|
| `message_created` | Nova mensagem recebida ou enviada |
| `conversation_created` | Nova conversa criada |
| `conversation_status_changed` | Status da conversa mudou |
| `label_added` | Label adicionada a conversa |

**Operadores de Condicao:**

| Campo | Operadores |
|----|----|
| `message.content` | contains, starts_with, ends_with, matches_regex |
| `conversation.status` | equals, not_equals |
| `conversation.label` | includes, excludes |
| `conversation.inbox_id` | equals |
| `contact.phone` | contains, starts_with |

**Acoes:**

| Acao | Parametros |
|----|----|
| `assign_agent` | agent_id |
| `add_label` | label_id |
| `remove_label` | label_id |
| `send_message` | content, message_type (outgoing/note) |
| `resolve_conversation` | - |
| `create_ai_suggestion` | funnel_stage |
| `trigger_webhook` | url, method, payload_template |

**Criterios de Aceite:**

* Regras armazenadas como JSONB: `{ event, conditions: [...], actions: [...] }`
* Engine de execucao: BullMQ job `automation:evaluate` enfileirado a cada evento relevante
* Condicoes avaliam com logica AND entre os itens (default) ou OR (configuravel)
* Acao `send_message` registra mensagem com `message_type = 'activity'`
* Limite: 50 regras ativas por account no MVP
* Interface: formulario stepwise — Passo 1: escolhe evento, Passo 2: adiciona condicoes, Passo 3: adiciona acoes, Passo 4: salva e ativa


---

## 5. Modelo de Dados Completo

### 5.1 Convencoes Gerais

* Todos os IDs: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
* Campos de auditoria em todas as tabelas: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
* Trigger `set_updated_at()` em todas as tabelas que tem `updated_at` (padrao do genesis-laudo)
* Isolamento multi-tenant: `account_id UUID NOT NULL REFERENCES accounts(id)` em toda entidade-raiz
* Soft delete: `deleted_at TIMESTAMPTZ` em entidades que precisam de historico (contatos, conversas)
* JSONB para configuracoes variaveis (provider_config, custom_attributes, conditions, actions)

### 5.2 Schema DDL Completo

```sql
-- ============================================================
-- vialum-chat — 001_init.sql
-- Schema inicial idempotente
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- FUNCAO: updated_at automatico
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- TABELA: accounts
-- Raiz do tenant. Cada account e uma organizacao isolada.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  slug          VARCHAR(100)  UNIQUE NOT NULL,   -- URL-friendly: 'genesis-marcas'
  plan          VARCHAR(50)   NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  settings      JSONB         NOT NULL DEFAULT '{}',
  -- settings: { timezone, default_language, ai_enabled, ai_provider, ai_model }
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts (slug);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: users
-- Usuarios globais do sistema. Um user pode pertencer a multiplas accounts.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255)  NOT NULL,
  email           VARCHAR(255)  UNIQUE NOT NULL,
  password_hash   VARCHAR(255)  NOT NULL,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: account_users
-- Vinculo many-to-many user <-> account com role.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(50)   NOT NULL DEFAULT 'agent',  -- admin | agent
  availability  VARCHAR(50)   NOT NULL DEFAULT 'online', -- online | busy | offline
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_users_account ON account_users (account_id);
CREATE INDEX IF NOT EXISTS idx_account_users_user    ON account_users (user_id);

-- ────────────────────────────────────────────────────────────
-- TABELA: inboxes
-- Instancias de WhatsApp. Cada inbox e um numero/conexao.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inboxes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name              VARCHAR(255)  NOT NULL,
  channel_type      VARCHAR(50)   NOT NULL DEFAULT 'whatsapp',  -- whatsapp (MVP), instagram (v3)
  provider          VARCHAR(50)   NOT NULL,  -- evolution_api | cloud_api
  provider_config   JSONB         NOT NULL DEFAULT '{}',
  -- evolution_api: { base_url, api_key, instance_name }
  -- cloud_api:     { phone_number_id, access_token, business_account_id, webhook_verify_token }
  working_hours     JSONB         NOT NULL DEFAULT '{}',
  -- { enabled: bool, timezone: string, hours: { mon: { open: '09:00', close: '18:00' } } }
  greeting_message  TEXT,
  out_of_office_message TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inboxes_account ON inboxes (account_id);

DROP TRIGGER IF EXISTS trg_inboxes_updated_at ON inboxes;
CREATE TRIGGER trg_inboxes_updated_at
  BEFORE UPDATE ON inboxes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: contacts
-- Contatos dos clientes finais.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                VARCHAR(255)  NOT NULL,
  phone               VARCHAR(50),
  email               VARCHAR(255),
  avatar_url          TEXT,
  custom_attributes   JSONB         NOT NULL DEFAULT '{}',
  -- custom_attributes: { cpf, cnpj, empresa, cidade, ... }
  funnel_stage        VARCHAR(100),  -- lead | prospect | client | vip
  notes               TEXT,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone   ON contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts (email);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: contact_inboxes
-- Vincula contato a inbox com source_id (numero WhatsApp do contato naquele inbox).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_inboxes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID          NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  inbox_id        UUID          NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  source_id       VARCHAR(255)  NOT NULL,  -- numero WA: 5511999999999@s.whatsapp.net
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(inbox_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_inboxes_contact ON contact_inboxes (contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_inboxes_inbox   ON contact_inboxes (inbox_id);

-- ────────────────────────────────────────────────────────────
-- TABELA: conversations
-- Uma conversa e um thread de mensagens entre um contato e a equipe.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  inbox_id              UUID          NOT NULL REFERENCES inboxes(id),
  contact_id            UUID          NOT NULL REFERENCES contacts(id),
  contact_inbox_id      UUID          REFERENCES contact_inboxes(id),
  assignee_id           UUID          REFERENCES users(id),  -- agente atribuido
  status                VARCHAR(50)   NOT NULL DEFAULT 'open',
  -- open | pending | resolved | snoozed
  unread_count          INTEGER       NOT NULL DEFAULT 0,
  last_activity_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  snoozed_until         TIMESTAMPTZ,
  custom_attributes     JSONB         NOT NULL DEFAULT '{}',
  additional_attributes JSONB         NOT NULL DEFAULT '{}',
  -- additional_attributes: { mail_subject, browser_info, ... }
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_account    ON conversations (account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_inbox      ON conversations (inbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact    ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_assignee   ON conversations (assignee_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status     ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_activity   ON conversations (last_activity_at DESC);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: messages
-- Todas as mensagens de todas as conversas.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id       UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  inbox_id              UUID          NOT NULL REFERENCES inboxes(id),
  sender_type           VARCHAR(50)   NOT NULL,  -- user | contact | bot
  sender_id             UUID,                    -- FK para users.id ou contacts.id dependendo do sender_type
  content               TEXT,
  message_type          VARCHAR(50)   NOT NULL DEFAULT 'incoming',
  -- incoming | outgoing | activity | template
  content_type          VARCHAR(50)   NOT NULL DEFAULT 'text',
  -- text | image | video | audio | document | location | sticker | template
  content_attributes    JSONB         NOT NULL DEFAULT '{}',
  -- Para media: { url, filename, size, mime_type }
  -- Para template: { template_name, language, components }
  -- Para location: { latitude, longitude, address }
  status                VARCHAR(50)   NOT NULL DEFAULT 'sent',
  -- sent | delivered | read | failed
  private               BOOLEAN       NOT NULL DEFAULT false,  -- true = nota interna
  external_message_id   VARCHAR(255),  -- ID da mensagem no provider (WA message_id)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_account      ON messages (account_id);
CREATE INDEX IF NOT EXISTS idx_messages_inbox        ON messages (inbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_external_id  ON messages (external_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages (created_at DESC);

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: labels
-- Tags coloridas configuradas por account.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          VARCHAR(100)  NOT NULL,
  color         VARCHAR(7)    NOT NULL DEFAULT '#6366F1',  -- hexadecimal
  description   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_labels_account ON labels (account_id);

DROP TRIGGER IF EXISTS trg_labels_updated_at ON labels;
CREATE TRIGGER trg_labels_updated_at
  BEFORE UPDATE ON labels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: conversation_labels
-- Relacionamento many-to-many conversas <-> labels.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_labels (
  conversation_id   UUID    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  label_id          UUID    NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_labels_conversation ON conversation_labels (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_labels_label        ON conversation_labels (label_id);

-- ────────────────────────────────────────────────────────────
-- TABELA: canned_responses
-- Respostas prontas com atalho de teclado.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canned_responses (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  short_code    VARCHAR(100)  NOT NULL,  -- atalho sem /, ex: 'boas-vindas'
  content       TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, short_code)
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_account     ON canned_responses (account_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_short_code  ON canned_responses (account_id, short_code);

DROP TRIGGER IF EXISTS trg_canned_responses_updated_at ON canned_responses;
CREATE TRIGGER trg_canned_responses_updated_at
  BEFORE UPDATE ON canned_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: automation_rules
-- Regras evento-condicao-acao armazenadas como JSONB.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          VARCHAR(255)  NOT NULL,
  description   TEXT,
  event_name    VARCHAR(100)  NOT NULL,
  -- message_created | conversation_created | conversation_status_changed | label_added
  conditions    JSONB         NOT NULL DEFAULT '[]',
  -- [{ field, operator, value, logic_operator? }]
  -- field: message.content | conversation.status | conversation.label | etc.
  -- operator: contains | equals | starts_with | etc.
  actions       JSONB         NOT NULL DEFAULT '[]',
  -- [{ type, params }]
  -- type: assign_agent | add_label | send_message | resolve | webhook | create_ai_suggestion
  active        BOOLEAN       NOT NULL DEFAULT true,
  run_count     INTEGER       NOT NULL DEFAULT 0,
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_account ON automation_rules (account_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_event   ON automation_rules (event_name);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active  ON automation_rules (active);

DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: ai_suggestions
-- Sugestoes de mensagem geradas por IA aguardando HITL.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id   UUID          NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  triggered_by      VARCHAR(100),  -- automation_rule | manual | webhook
  trigger_id        UUID,          -- FK para automation_rules.id se aplicavel
  content           TEXT          NOT NULL,  -- conteudo sugerido original
  edited_content    TEXT,                   -- conteudo editado pelo agente (se aplicavel)
  status            VARCHAR(50)   NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | sent | edited
  funnel_stage      VARCHAR(100),  -- lead | prospect | client | custom
  context           JSONB         NOT NULL DEFAULT '{}',
  -- contexto usado para gerar: { last_n_messages, contact_attributes, trigger_message }
  reviewed_by       UUID          REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_account        ON ai_suggestions (account_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_conversation   ON ai_suggestions (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status         ON ai_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending        ON ai_suggestions (account_id, status) WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_ai_suggestions_updated_at ON ai_suggestions;
CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABELA: refresh_tokens
-- Tokens de refresh para autenticacao JWT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255)  UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ   NOT NULL,
  revoked       BOOLEAN       NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token_hash);

-- ────────────────────────────────────────────────────────────
-- TABELA: webhooks
-- Webhooks recebidos dos providers para idempotencia.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id          UUID          NOT NULL REFERENCES inboxes(id),
  provider          VARCHAR(50)   NOT NULL,
  event_type        VARCHAR(100)  NOT NULL,
  idempotency_key   VARCHAR(255)  UNIQUE NOT NULL,  -- provider_message_id
  payload           JSONB         NOT NULL,
  processed         BOOLEAN       NOT NULL DEFAULT false,
  error             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_inbox      ON webhook_events (inbox_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency ON webhook_events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed  ON webhook_events (processed);
```


---

## 6. API Endpoints Principais

### 6.1 Convencoes da API

* Base URL: `https://api.luminai.ia.br/chat/api/v1`
* Autenticacao: `Authorization: Bearer {access_token}` em todos os endpoints protegidos
* Multi-tenancy: `account_id` extraido do JWT claim `sub.account_id`
* Paginacao: `?page=1&limit=25` (default limit: 25, max: 100)
* Erros: padrao `{ "error": "...", "code": "SNAKE_CASE_CODE", "details": {...} }`
* Todos os timestamps em ISO 8601 UTC

### 6.2 Auth

```
POST   /auth/login
       Body: { email, password }
       Response: { access_token, refresh_token, expires_in, user }

POST   /auth/refresh
       Body: { refresh_token }
       Response: { access_token, expires_in }

POST   /auth/logout
       Body: { refresh_token }
       Response: { ok: true }

GET    /auth/me
       Response: { user, account_user (role, availability) }
```

### 6.3 Accounts

```
GET    /accounts/:account_id
       Response: { account }

PATCH  /accounts/:account_id
       Body: { name?, settings? }
       Response: { account }
```

### 6.4 Inboxes

```
GET    /accounts/:account_id/inboxes
       Response: { inboxes: [...] }

POST   /accounts/:account_id/inboxes
       Body: { name, channel_type, provider, provider_config }
       Response: { inbox }

GET    /accounts/:account_id/inboxes/:inbox_id
       Response: { inbox }

PATCH  /accounts/:account_id/inboxes/:inbox_id
       Body: { name?, provider_config?, greeting_message?, working_hours? }
       Response: { inbox }

DELETE /accounts/:account_id/inboxes/:inbox_id
       Response: { ok: true }

POST   /accounts/:account_id/inboxes/:inbox_id/test-connection
       Response: { connected: true, phone_number?, provider_info }
```

### 6.5 Conversations

```
GET    /accounts/:account_id/conversations
       Query: ?status=open&inbox_id=&label_id=&assignee_id=&page=1&limit=25&search=
       Response: { conversations: [...], meta: { total, page, limit } }

POST   /accounts/:account_id/conversations
       Body: { inbox_id, contact_id, assignee_id? }
       Response: { conversation }

GET    /accounts/:account_id/conversations/:conversation_id
       Response: { conversation, contact, inbox, labels, assignee }

PATCH  /accounts/:account_id/conversations/:conversation_id
       Body: { status?, assignee_id?, snoozed_until? }
       Response: { conversation }

POST   /accounts/:account_id/conversations/:conversation_id/labels
       Body: { label_id }
       Response: { conversation_label }

DELETE /accounts/:account_id/conversations/:conversation_id/labels/:label_id
       Response: { ok: true }

POST   /accounts/:account_id/conversations/:conversation_id/resolve
       Response: { conversation }

POST   /accounts/:account_id/conversations/:conversation_id/reopen
       Response: { conversation }
```

### 6.6 Messages

```
GET    /accounts/:account_id/conversations/:conversation_id/messages
       Query: ?before_id=&limit=50
       Response: { messages: [...], meta: { has_more } }

POST   /accounts/:account_id/conversations/:conversation_id/messages
       Body: { content, message_type, content_type, private?, content_attributes? }
       Response: { message }
       -- Enfileira job para envio via provider

PATCH  /accounts/:account_id/conversations/:conversation_id/messages/:message_id
       Body: { content }  -- edicao de nota interna apenas
       Response: { message }
```

### 6.7 Contacts

```
GET    /accounts/:account_id/contacts
       Query: ?search=&page=1&limit=25
       Response: { contacts: [...], meta }

POST   /accounts/:account_id/contacts
       Body: { name, phone?, email?, custom_attributes?, funnel_stage? }
       Response: { contact }

GET    /accounts/:account_id/contacts/:contact_id
       Response: { contact, contact_inboxes, recent_conversations }

PATCH  /accounts/:account_id/contacts/:contact_id
       Body: { name?, phone?, email?, custom_attributes?, funnel_stage? }
       Response: { contact }

DELETE /accounts/:account_id/contacts/:contact_id
       Response: { ok: true }  -- soft delete
```

### 6.8 Labels

```
GET    /accounts/:account_id/labels
       Response: { labels: [...] }

POST   /accounts/:account_id/labels
       Body: { name, color, description? }
       Response: { label }

PATCH  /accounts/:account_id/labels/:label_id
       Body: { name?, color?, description? }
       Response: { label }

DELETE /accounts/:account_id/labels/:label_id
       Response: { ok: true }
```

### 6.9 Canned Responses

```
GET    /accounts/:account_id/canned-responses
       Query: ?search=&short_code=
       Response: { canned_responses: [...] }

POST   /accounts/:account_id/canned-responses
       Body: { short_code, content }
       Response: { canned_response }

PATCH  /accounts/:account_id/canned-responses/:id
       Body: { short_code?, content? }
       Response: { canned_response }

DELETE /accounts/:account_id/canned-responses/:id
       Response: { ok: true }
```

### 6.10 Automation Rules

```
GET    /accounts/:account_id/automation-rules
       Response: { rules: [...] }

POST   /accounts/:account_id/automation-rules
       Body: { name, description?, event_name, conditions, actions, active }
       Response: { rule }

PATCH  /accounts/:account_id/automation-rules/:rule_id
       Body: { name?, conditions?, actions?, active? }
       Response: { rule }

DELETE /accounts/:account_id/automation-rules/:rule_id
       Response: { ok: true }

POST   /accounts/:account_id/automation-rules/:rule_id/toggle
       Response: { rule }
```

### 6.11 AI Suggestions

```
GET    /accounts/:account_id/ai-suggestions
       Query: ?status=pending&conversation_id=&page=1&limit=25
       Response: { suggestions: [...], meta }

GET    /accounts/:account_id/conversations/:conversation_id/ai-suggestions
       Query: ?status=pending
       Response: { suggestions: [...] }

PATCH  /accounts/:account_id/ai-suggestions/:suggestion_id
       Body: { action: 'approve' | 'reject' | 'edit', edited_content? }
       Response: { suggestion }
       -- approve: enfileira job de envio, status → sent
       -- reject: status → rejected
       -- edit: armazena edited_content, enfileira job, status → edited

PATCH  /accounts/:account_id/ai-suggestions/bulk
       Body: { suggestion_ids: [...], action: 'approve' | 'reject' }
       Response: { updated: number }
```

### 6.12 Webhooks de Provider (endpoints publicos, sem auth JWT)

```
POST   /webhooks/evolution/:inbox_id
       -- Recebe eventos da Evolution API
       -- Valida assinatura via header x-evolution-signature

POST   /webhooks/cloud/:inbox_id
       -- Recebe eventos do WhatsApp Cloud API
       -- Valida x-hub-signature-256

GET    /webhooks/cloud/:inbox_id
       -- Verificacao de webhook (Meta challenge)
       -- Query: ?hub.mode=subscribe&hub.verify_token=&hub.challenge=
```

### 6.13 Users e Account Users

```
GET    /accounts/:account_id/agents
       Response: { agents: [...] }  -- users com role na account

POST   /accounts/:account_id/agents
       Body: { email, name, password, role }
       Response: { agent }

PATCH  /accounts/:account_id/agents/:agent_id
       Body: { role?, availability? }
       Response: { agent }

DELETE /accounts/:account_id/agents/:agent_id
       Response: { ok: true }
```


---

## 7. Arquitetura Tecnica

### 7.1 Stack Completa

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js 14)              │
│  App Router + Shadcn/UI + Tailwind CSS              │
│  Zustand (estado global) + TanStack Query (server)  │
│  Socket.io client (real-time)                       │
│  NextAuth.js (auth)                                 │
│  Port: 3000 interno                                 │
└─────────────────────────────────────────────────────┘
                          ↕ REST + WebSocket
┌─────────────────────────────────────────────────────┐
│                 BACKEND (Node.js 20)                │
│  Fastify + TypeScript                               │
│  Prisma ORM                                         │
│  Socket.io server                                   │
│  BullMQ workers (queues)                            │
│  JWT auth (fastify-jwt)                             │
│  Port: 4000 interno                                 │
└─────────────────────────────────────────────────────┘
         ↕ Prisma/SQL          ↕ BullMQ          ↕ HTTP
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │    Redis     │    │ WhatsApp API │
│  (Port 5432) │    │  (Port 6379) │    │(Evolution/   │
│              │    │  queue+cache │    │  Cloud API)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 7.2 Backend: Fastify + TypeScript

**Estrutura de diretorios do backend:**

```
vialum-chat-api/
├── src/
│   ├── app.ts                    -- Fastify instance + plugins registration
│   ├── server.ts                 -- Entry point, listen
│   ├── config/
│   │   ├── env.ts                -- Zod schema para validacao de env vars
│   │   └── database.ts           -- Prisma client singleton
│   ├── plugins/
│   │   ├── auth.ts               -- fastify-jwt plugin + decorators
│   │   ├── socket.ts             -- Socket.io integration
│   │   └── redis.ts              -- Redis connection + BullMQ setup
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts    -- Zod request/response schemas
│   │   ├── conversations/
│   │   │   ├── conversations.routes.ts
│   │   │   ├── conversations.service.ts
│   │   │   └── conversations.schema.ts
│   │   ├── messages/
│   │   │   ├── messages.routes.ts
│   │   │   ├── messages.service.ts
│   │   │   └── messages.schema.ts
│   │   ├── contacts/
│   │   ├── inboxes/
│   │   ├── labels/
│   │   ├── canned-responses/
│   │   ├── automation/
│   │   └── ai-suggestions/
│   ├── providers/
│   │   ├── whatsapp.interface.ts  -- IWhatsAppProvider interface
│   │   ├── evolution/
│   │   │   ├── evolution.adapter.ts
│   │   │   └── evolution.webhook.ts
│   │   └── cloud-api/
│   │       ├── cloud.adapter.ts
│   │       └── cloud.webhook.ts
│   ├── workers/
│   │   ├── message-send.worker.ts
│   │   ├── automation.worker.ts
│   │   ├── ai-suggestion.worker.ts
│   │   └── snooze.worker.ts
│   ├── events/
│   │   └── socket-events.ts      -- Tipagem de todos os eventos WS
│   └── webhooks/
│       ├── evolution.handler.ts
│       └── cloud.handler.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 7.3 Interface do Provider WhatsApp

```typescript
// src/providers/whatsapp.interface.ts

export interface SendMessageOptions {
  to: string;           // numero destino: 5511999999999
  content: string;
  contentType: 'text' | 'image' | 'audio' | 'document' | 'video';
  mediaUrl?: string;
  filename?: string;
  caption?: string;
}

export interface IncomingMessage {
  externalId: string;   // ID da mensagem no provider
  from: string;         // numero do remetente
  content: string;
  contentType: string;
  contentAttributes: Record<string, unknown>;
  timestamp: Date;
}

export interface MessageStatus {
  externalId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
}

export interface IWhatsAppProvider {
  sendMessage(options: SendMessageOptions): Promise<{ externalId: string }>;
  getContactInfo(phone: string): Promise<{ name?: string; avatar_url?: string }>;
  verifyWebhook(payload: unknown, signature: string): boolean;
  normalizeWebhookPayload(raw: unknown): IncomingMessage | MessageStatus | null;
}
```

### 7.4 Frontend: Next.js 14 + App Router

**Estrutura de diretorios do frontend:**

```
vialum-chat-web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           -- Sidebar + providers
│   │   │   ├── [account_id]/
│   │   │   │   ├── conversations/
│   │   │   │   │   ├── page.tsx     -- Inbox list
│   │   │   │   │   └── [id]/page.tsx -- Conversation thread
│   │   │   │   ├── ai-queue/
│   │   │   │   │   └── page.tsx     -- Fila de sugestoes pendentes
│   │   │   │   ├── settings/
│   │   │   │   │   ├── inboxes/page.tsx
│   │   │   │   │   ├── labels/page.tsx
│   │   │   │   │   ├── canned-responses/page.tsx
│   │   │   │   │   ├── automation/page.tsx
│   │   │   │   │   └── agents/page.tsx
│   │   │   │   └── page.tsx         -- Redirect to conversations
│   │   └── api/
│   │       └── [...]/route.ts       -- API proxy se necessario
│   ├── components/
│   │   ├── ui/                      -- Shadcn/UI components
│   │   ├── inbox/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationItem.tsx
│   │   │   └── InboxFilters.tsx
│   │   ├── conversation/
│   │   │   ├── ConversationThread.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── CannedResponseDropdown.tsx
│   │   │   └── AISuggestionBar.tsx  -- Componente critico: sugestoes acima do input
│   │   ├── ai-queue/
│   │   │   ├── SuggestionQueue.tsx
│   │   │   └── SuggestionCard.tsx
│   │   └── automation/
│   │       └── RuleBuilder.tsx
│   ├── lib/
│   │   ├── api.ts                   -- Fetch wrapper com auth
│   │   ├── socket.ts                -- Socket.io client singleton
│   │   └── utils.ts
│   ├── store/
│   │   ├── conversations.store.ts   -- Zustand: conversas ativas
│   │   ├── messages.store.ts        -- Zustand: mensagens por conversa
│   │   └── ui.store.ts              -- Zustand: UI state (selected conversation, filters)
│   └── hooks/
│       ├── useSocket.ts
│       ├── useConversations.ts
│       └── useAISuggestions.ts
├── package.json
└── Dockerfile
```

### 7.5 Queue System (BullMQ + Redis)

**Filas definidas:**

| Fila | Proposito | Retry | Timeout |
|----|----|----|----|
| `message:send` | Enviar mensagem via provider | 3x (exponencial) | 30s |
| `automation:evaluate` | Avaliar regras de automacao | 2x | 15s |
| `ai:generate-suggestion` | Gerar sugestao via LLM | 1x | 60s |
| `snooze:reopen` | Reabrir conversas snoozadas | 1x | 10s |
| `webhook:process` | Processar webhook recebido | 3x | 20s |
| `message:status-update` | Atualizar status da mensagem | 2x | 10s |

**Configuracao de concorrencia:**

```typescript
// Workers: concorrencia por tipo
const MESSAGE_SEND_CONCURRENCY = 10;
const AUTOMATION_CONCURRENCY   = 5;
const AI_SUGGESTION_CONCURRENCY = 3;  // limitado por rate limit do LLM
```

### 7.6 WebSocket Events

**Eventos do servidor para o cliente:**

```typescript
// Prefixo: account:{account_id}

'conversation:created'         // Nova conversa criada
'conversation:updated'         // Status, assignee, labels mudou
'message:created'              // Nova mensagem (incoming ou outgoing)
'message:status:updated'       // Status da mensagem (sent→delivered→read)
'ai_suggestion:created'        // Nova sugestao de IA pendente
'ai_suggestion:updated'        // Status da sugestao mudou
'agent:availability:changed'   // Agente ficou online/offline/busy
```

**Eventos do cliente para o servidor:**

```typescript
'subscribe:conversation'       // Agente abre uma conversa especifica
'unsubscribe:conversation'     // Agente sai da conversa
'typing:start'                 // Agente comecou a digitar
'typing:stop'                  // Agente parou de digitar
```

**Rooms do Socket.io:**

```
account:{account_id}           -- Todos os agentes da account
conversation:{conversation_id} -- Agentes com a conversa aberta
```


---

## 8. Fluxos de Dados

### 8.1 Fluxo: Mensagem Recebida (Incoming)

```
WhatsApp (cliente envia mensagem)
    ↓
Provider (Evolution API ou Cloud API)
    ↓ HTTP POST webhook
Backend /webhooks/{provider}/{inbox_id}
    ↓ 1. Valida assinatura do webhook
    ↓ 2. Verifica idempotency_key em webhook_events (evita duplicata)
    ↓ 3. Responde 200 imediatamente
    ↓ 4. Enfileira job: webhook:process no BullMQ
    ↓
Worker: webhook:process
    ↓ 1. Normaliza payload via provider.normalizeWebhookPayload()
    ↓ 2. Identifica inbox pelo inbox_id da URL
    ↓ 3. Busca/cria Contact por source_id (phone)
    ↓ 4. Busca conversa aberta OU cria nova conversa
    ↓ 5. Insere Message no banco
    ↓ 6. Atualiza conversation.last_activity_at e unread_count
    ↓ 7. Emite evento WebSocket: message:created (room: account:{id})
    ↓ 8. Enfileira: automation:evaluate (event: message_created)
    ↓
Worker: automation:evaluate
    ↓ 1. Carrega regras ativas da account com event_name = 'message_created'
    ↓ 2. Avalia conditions contra a mensagem e conversa
    ↓ 3. Executa actions das regras que passaram nas conditions
    ↓    - assign_agent → UPDATE conversations SET assignee_id
    ↓    - add_label → INSERT conversation_labels
    ↓    - send_message → enfileira message:send
    ↓    - create_ai_suggestion → enfileira ai:generate-suggestion
    ↓
Worker: ai:generate-suggestion (se acionado)
    ↓ 1. Carrega N ultimas mensagens da conversa
    ↓ 2. Carrega dados do contato e funnel_stage
    ↓ 3. Chama LLM (OpenAI/Claude API)
    ↓ 4. Insere AISuggestion com status='pending'
    ↓ 5. Emite WebSocket: ai_suggestion:created (room: account:{id} e conversation:{id})
    ↓
Frontend (agente vendo a conversa)
    ↓ Recebe evento WebSocket ai_suggestion:created
    ↓ Renderiza AISuggestionBar acima do MessageInput
    ↓ Agente: [Enviar] [Editar] [Descartar]
```

### 8.2 Fluxo: Agente Envia Mensagem

```
Agente digita mensagem + clica Enviar
    ↓
Frontend: POST /api/v1/accounts/{id}/conversations/{id}/messages
    ↓
Backend:
    ↓ 1. Valida payload (Zod)
    ↓ 2. Insere Message no banco com status='sending'
    ↓ 3. Retorna message imediatamente (optimistic UI)
    ↓ 4. Emite WebSocket: message:created (para outros agentes)
    ↓ 5. Enfileira job: message:send
    ↓
Worker: message:send
    ↓ 1. Carrega inbox e provider_config
    ↓ 2. Instancia provider adapter (evolution ou cloud)
    ↓ 3. Chama provider.sendMessage()
    ↓ 4. Recebe externalId do provider
    ↓ 5. UPDATE messages SET external_message_id, status='sent'
    ↓ 6. Emite WebSocket: message:status:updated
    ↓
Provider (Evolution/Cloud API)
    ↓ Envia mensagem ao WhatsApp
    ↓ Recebe confirmacao de entrega/leitura
    ↓ Envia webhook de status update
    ↓
Backend /webhooks/{provider}/{inbox_id}
    ↓ Normaliza status webhook
    ↓ UPDATE messages SET status=delivered/read
    ↓ Emite WebSocket: message:status:updated
    ↓
Frontend: icone de check atualiza (enviado → entregue → lido)
```

### 8.3 Fluxo: Agente Aprova Sugestao de IA

```
AISuggestionBar exibe sugestao com status='pending'
    ↓
Agente clica [Enviar] na sugestao
    ↓
Frontend: PATCH /ai-suggestions/{id}  Body: { action: 'approve' }
    ↓
Backend:
    ↓ 1. UPDATE ai_suggestions SET status='sent', reviewed_by, reviewed_at
    ↓ 2. Cria Message usando content da sugestao
    ↓ 3. Enfileira job: message:send
    ↓ 4. Remove sugestao da AISuggestionBar via WebSocket
    ↓
(continua igual ao fluxo de envio de mensagem)
```


---

## 9. Sistema AI HITL — Especificacao Tecnica

### 9.1 Provider de IA

O sistema de IA e configurado por account em `accounts.settings.ai_provider`. Providers suportados no MVP:

* `openai` — GPT-4o via OpenAI API
* `anthropic` — Claude 4.6 Sonnet via Anthropic API

**Interface do provider de IA:**

```typescript
interface AIProvider {
  generateSuggestion(context: AIContext): Promise<string[]>;
}

interface AIContext {
  conversation_id: string;
  contact: {
    name: string;
    funnel_stage?: string;
    custom_attributes?: Record<string, unknown>;
  };
  last_messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  trigger_message: string;
  account_settings: {
    ai_instructions?: string;  // instrucoes customizadas por account
    max_suggestions?: number;  // default: 2
  };
}
```

### 9.2 System Prompt Base

O system prompt e configurado por account via `accounts.settings.ai_instructions`. Valor default:

```
Voce e um assistente de atendimento ao cliente para uma empresa de registro de marcas.
Sua funcao e sugerir respostas profissionais, cordiais e objetivas em portugues brasileiro.
As sugestoes devem ser adequadas para envio via WhatsApp.
Nao use markdown, use apenas texto plano.
Mantenha respostas concisas (maximo 3-4 paragrafos).
```

### 9.3 Componente AISuggestionBar (Frontend)

```
┌─────────────────────────────────────────────────────────┐
│  IA                              [2 sugestoes pendentes] │
├─────────────────────────────────────────────────────────┤
│  Sugestao 1:                                            │
│  "Ola, Felipe! Obrigado pelo contato. Para o registro   │
│   da marca ACME no INPI, preciso de algumas informacoes │
│   adicionais..."                                        │
│                          [Enviar] [Editar] [Descartar]  │
├─────────────────────────────────────────────────────────┤
│  Sugestao 2:                                            │
│  "Oi! Vi que voce tem interesse no registro de marca.   │
│   Qual e o segmento de atividade da sua empresa?"       │
│                          [Enviar] [Editar] [Descartar]  │
└─────────────────────────────────────────────────────────┘
│  [Campo de input da mensagem...]                        │
└─────────────────────────────────────────────────────────┘
```

**Comportamento do botao Editar:**


1. Sugestao vira textarea editavel inline (ocupa o espaco do texto)
2. Botoes mudam para: \[Confirmar e Enviar\] \[Cancelar\]
3. Ao confirmar: envia a versao editada, `edited_content` salvo, `status = 'edited'`
4. Ao cancelar: volta para visualizacao da sugestao original


---

## 10. Automation Builder — Especificacao de UI

### 10.1 Interface de Criacao de Regra

**Passo 1 — Evento Gatilho:**

```
Quando acontecer:
  ( ) Mensagem criada
  ( ) Conversa criada
  ( ) Status da conversa mudou
  ( ) Label adicionada
```

**Passo 2 — Condicoes:**

```
E todas as condicoes forem verdadeiras:  [E] [OU]

  [Conteudo da mensagem] [Contem] [________]   [X]
  [+ Adicionar condicao]
```

Campos de condicao disponiveis:

| Campo | Operators |
|----|----|
| Conteudo da mensagem | Contem, Comeca com, Termina com, E exatamente |
| Status da conversa | E, Nao e |
| Label da conversa | Inclui, Nao inclui |
| Inbox | E |
| Telefone do contato | Contem, Comeca com |
| Estagio do funil | E, Nao e |

**Passo 3 — Acoes:**

```
Executar as acoes:

  [Atribuir agente] [Selecionar agente...]   [X]
  [Adicionar label] [Selecionar label...]    [X]
  [+ Adicionar acao]
```

Acoes disponiveis:

| Acao | Parametros |
|----|----|
| Atribuir agente | Dropdown de agentes |
| Adicionar label | Dropdown de labels |
| Remover label | Dropdown de labels |
| Enviar mensagem | Textarea com conteudo |
| Resolver conversa | - |
| Criar sugestao de IA | Dropdown de estagio de funil |
| Disparar webhook | URL + method |

**Passo 4 — Revisao e Ativacao:**

```
Nome da regra: [________________________]
               
Resumo:
  Quando "Mensagem criada"
  E "Conteudo contem 'prazo'"
  Entao "Adicionar label Urgente"
  
                              [Cancelar] [Salvar e Ativar]
```


---

## 11. Requisitos de Seguranca

### 11.1 Autenticacao e Autorizacao

| Requisito | Implementacao |
|----|----|
| JWT Access Token | Expiracao: 15 minutos, assinado com RS256 |
| Refresh Token | Expiracao: 30 dias, hash SHA-256 no banco |
| Multi-tenant isolation | Middleware extrai account_id do JWT, toda query inclui `WHERE account_id = $account_id` |
| Role-based access | `admin` pode gerenciar configuracoes; `agent` apenas conversas/mensagens |
| Password hashing | bcrypt com cost factor 12 |
| Rate limiting | 100 req/min por IP (via fastify-rate-limit), 30 req/min para /auth endpoints |

### 11.2 Seguranca de Webhooks

| Provider | Validacao |
|----|----|
| Evolution API | HMAC-SHA256 no header `x-evolution-signature`, chave por inbox |
| Cloud API (Meta) | HMAC-SHA256 no header `x-hub-signature-256`, App Secret da Meta |
| Idempotency | `webhook_events.idempotency_key UNIQUE` — rejeita duplicatas silenciosamente |

### 11.3 Seguranca de Dados

* `provider_config` armazenado como JSONB — API keys em campo separado criptografado no futuro (v2: Vault/KMS)
* No MVP: API keys armazenadas como texto no banco (aceitavel para uso interno), rotacionadas periodicamente
* Todos os endpoints de webhook publicos respondem `200` mesmo em caso de erro de validacao para nao vazar informacoes ao provider
* TLS obrigatorio via Traefik (cert resolver Let's Encrypt)
* CORS configurado para aceitar apenas `chat.luminai.ia.br` nos endpoints de API

### 11.4 Logs e Auditoria

* Toda acao de agente (envio de mensagem, mudanca de status, aprovacao de sugestao) registrada com `user_id` e timestamp
* Webhook events armazenados em `webhook_events` por 30 dias (purge job semanal)
* Sem logging de senhas, tokens ou `provider_config` em logs de aplicacao


---

## 12. Infraestrutura Docker

### 12.1 Docker Compose Completo

```yaml
# vialum-chat.yml
# Deploy isolado — nao tocar no aios-infra existente

version: '3.8'

services:
  # ─── Frontend ────────────────────────────────────────────
  vialum-chat-web:
    container_name: vialum-chat-web
    build:
      context: ./web
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=https://api.luminai.ia.br/chat
      - NEXT_PUBLIC_WS_URL=wss://api.luminai.ia.br/chat
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=https://chat.luminai.ia.br
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=proxy"
      - "traefik.http.routers.vialum-chat-web.rule=Host(`chat.luminai.ia.br`)"
      - "traefik.http.routers.vialum-chat-web.entrypoints=websecure"
      - "traefik.http.routers.vialum-chat-web.tls.certresolver=le"
      - "traefik.http.routers.vialum-chat-web-http.rule=Host(`chat.luminai.ia.br`)"
      - "traefik.http.routers.vialum-chat-web-http.entrypoints=web"
      - "traefik.http.services.vialum-chat-web.loadbalancer.server.port=3000"
    networks:
      - proxy
      - chat-internal

  # ─── API Backend ─────────────────────────────────────────
  vialum-chat-api:
    container_name: vialum-chat-api
    build:
      context: ./api
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - PORT=4000
      - NODE_ENV=production
      - DATABASE_URL=postgresql://chat:${DB_PASSWORD}@vialum-chat-db:5432/chat
      - REDIS_URL=redis://vialum-chat-redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CORS_ORIGIN=https://chat.luminai.ia.br
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=proxy"
      - "traefik.http.routers.vialum-chat-api.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/chat`)"
      - "traefik.http.routers.vialum-chat-api.entrypoints=websecure"
      - "traefik.http.routers.vialum-chat-api.tls.certresolver=le"
      - "traefik.http.routers.vialum-chat-api-http.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/chat`)"
      - "traefik.http.routers.vialum-chat-api-http.entrypoints=web"
      - "traefik.http.services.vialum-chat-api.loadbalancer.server.port=4000"
    networks:
      - proxy
      - chat-internal
    depends_on:
      vialum-chat-db:
        condition: service_healthy
      vialum-chat-redis:
        condition: service_healthy

  # ─── PostgreSQL ───────────────────────────────────────────
  vialum-chat-db:
    container_name: vialum-chat-db
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=chat
      - POSTGRES_USER=chat
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - vialum-chat-db-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chat -d chat"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - chat-internal  # apenas rede interna — nunca exposto ao proxy

  # ─── Redis ───────────────────────────────────────────────
  vialum-chat-redis:
    container_name: vialum-chat-redis
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - vialum-chat-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - chat-internal

volumes:
  vialum-chat-db-data:
    name: vialum-chat-db-data
  vialum-chat-redis-data:
    name: vialum-chat-redis-data

networks:
  proxy:
    external: true       # Rede Traefik existente — nao recriar
  chat-internal:
    driver: bridge
    name: chat-internal  # Rede isolada dos demais servicos
```

### 12.2 Variaveis de Ambiente (.env.example)

```bash
# Database
DB_PASSWORD=

# Redis
REDIS_PASSWORD=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

# Frontend
NEXTAUTH_SECRET=

# AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 12.3 Dockerfiles

**API Dockerfile:**

```dockerfile
# api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

**Web Dockerfile:**

```dockerfile
# web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 12.4 Estrutura de Diretorios na VPS

```
/root/vialum-chat/
├── vialum-chat.yml     -- Docker Compose
├── .env                -- Variaveis de producao (nao commitar)
├── api/                -- Backend source
│   ├── Dockerfile
│   ├── src/
│   └── prisma/
├── web/                -- Frontend source
│   ├── Dockerfile
│   └── src/
└── migrations/         -- SQL migrations para initdb
    └── 001_init.sql
```


---

## 13. Roteamento Traefik

### 13.1 Mapa de Rotas

| Host | PathPrefix | Container | Port |
|----|----|----|----|
| `chat.luminai.ia.br` | `/` | vialum-chat-web | 3000 |
| `api.luminai.ia.br` | `/chat` | vialum-chat-api | 4000 |
| `api.luminai.ia.br` | `/laudo` | genesis-laudo | 3001 |
| `api.luminai.ia.br` | `/protocolo` | genesis-protocolo | 3000 |

### 13.2 WebSocket no Traefik

Socket.io requer suporte a upgrade HTTP → WebSocket. O Traefik suporta isso nativamente quando:

* O router aponta para o mesmo servico que a API REST
* Nao ha middleware que quebre o upgrade (ex: compression)
* `traefik.http.services.vialum-chat-api.loadbalancer.sticky.cookie` pode ser necessario se houver multiplas replicas no futuro

```yaml
# Adicionar nos labels do vialum-chat-api se necessario:
- "traefik.http.middlewares.chat-ws.headers.customrequestheaders.X-Forwarded-Proto=https"
```


---

## 14. Criterios de Aceite do MVP

### 14.1 Checklist de Funcionalidades

**Auth e Multi-tenant:**

- [ ] Login com email/password retorna JWT valido
- [ ] Refresh token renova access token sem nova senha
- [ ] Todos os endpoints rejeitam requests sem JWT valido com 401
- [ ] Usuarios so veeem dados da sua propria account

**Inbox e Conversas:**

- [ ] Dashboard carrega lista de conversas abertas
- [ ] Filtros por status funcionam sem reload de pagina
- [ ] Busca por nome/telefone/conteudo retorna resultados em < 500ms
- [ ] Nova mensagem aparece em tempo real via WebSocket para todos os agentes conectados
- [ ] Mudar status de conversa reflete em tempo real no dashboard dos demais agentes
- [ ] Snooze reabre conversa automaticamente no horario configurado

**Mensageria:**

- [ ] Agente envia mensagem de texto → aparece no WhatsApp do contato em < 5s
- [ ] Mensagem recebida do WhatsApp aparece na thread em < 3s
- [ ] Status de mensagem atualiza (enviado → entregue → lido) em tempo real
- [ ] Nota interna (private) visivel apenas para agentes, nao enviada ao WhatsApp

**AI HITL:**

- [ ] Sugestao de IA aparece ACIMA do input, nao substitui o conteudo do input
- [ ] Botao Enviar manda a sugestao como mensagem e remove o componente
- [ ] Botao Editar abre textarea inline com a sugestao para edicao
- [ ] Botao Descartar remove a sugestao sem enviar nada
- [ ] Fila de sugestoes pendentes exibe sugestoes de todas as conversas da account
- [ ] Aprovacao em massa funciona para multiplas sugestoes selecionadas

**Canned Responses:**

- [ ] Digitar `/` no input exibe dropdown de respostas prontas
- [ ] Filtro em tempo real conforme agente digita apos `/`
- [ ] Selecionar resposta substitui conteudo do input
- [ ] Admin pode criar/editar/deletar respostas prontas

**Labels:**

- [ ] Admin pode criar labels com nome e cor customizada
- [ ] Agente pode adicionar/remover labels de conversas
- [ ] Filtro por label no inbox funciona
- [ ] Labels aparecem como pills coloridas na lista e na thread

**Automacoes:**

- [ ] Admin pode criar regra com evento + condicoes + acoes
- [ ] Regra e avaliada automaticamente quando evento ocorre
- [ ] Regra com condicao de conteudo de mensagem funciona (contains)
- [ ] Regra com acao add_label aplica a label corretamente
- [ ] Regra com acao create_ai_suggestion gera sugestao e push via WebSocket

**Infrastructure:**

- [ ] `GET /chat/health` retorna 200
- [ ] Postgres acessivel apenas na rede interna (`chat-internal`)
- [ ] Redis acessivel apenas na rede interna
- [ ] TLS ativo em `chat.luminai.ia.br` e `api.luminai.ia.br/chat`

### 14.2 Performance Targets (MVP)

| Metrica | Target |
|----|----|
| Tempo de carga do dashboard | < 2s (FCP) |
| Latencia de nova mensagem (WebSocket) | < 500ms |
| Tempo de envio de mensagem via provider | < 5s |
| Geracao de sugestao de IA | < 8s |
| Busca de conversas | < 500ms |


---

## 15. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|----|----|----|----|
| Evolution API instabilidade/mudanca de API | Media | Alto | Abstrato via IWhatsAppProvider — trocar provider sem mudar logica de negocio |
| Rate limit do provider de IA (OpenAI/Anthropic) | Media | Medio | Worker com concorrencia limitada, retry com backoff, config `max_suggestions` por account |
| Acumulacao de sugestoes pendentes nao revisadas | Alta | Medio | Fila pendente visivel, notificacao de badge, timeout para auto-rejeitar apos N horas (configuravel) |
| Socket.io scale (muitos agentes simultaneos) | Baixa (MVP) | Alto | Redis adapter para Socket.io ja configurado — pronto para horizontal scale |
| Webhooks duplicados do provider | Media | Medio | Idempotency key obrigatorio em `webhook_events` — solucao ja implementada no genesis-protocolo |
| Seguranca das API keys dos providers | Media | Alto | MVP: banco; v2: variavel de ambiente criptografada; v3: Vault/KMS |
| Conflito de portas com servicos existentes | Baixa | Medio | genesis-protocolo usa porta 3000, genesis-laudo usa 3001 — vialum-chat-api usar 4000, chat-web usar 3000 na rede interna |


---

## Apendice A: Decisoes de Tecnologia Justificadas

| Decisao | Alternativa considerada | Justificativa |
|----|----|----|
| Fastify sobre Express | Express | Melhor performance, TypeScript nativo, schemas com Zod integrados via fastify-type-provider-zod |
| Prisma sobre raw SQL | Drizzle, Knex | Type safety completo, migrations versionadas, introspect de schema existente — produtividade maior no MVP |
| BullMQ sobre bull | bull v3 | BullMQ e o successor oficial, suporte a TypeScript nativo, melhor observabilidade |
| Next.js 14 App Router | Pages Router, Remix | Alinhamento com o ecossistema mais atual, Server Components para performance, suporte nativo a streaming |
| Shadcn/UI | Material UI, Chakra | Componentes copyable (nao dependencia), total controle de estilo, excelente com Tailwind, padrao crescente no mercado |
| Zustand + TanStack Query | Redux + React Query | Zustand para UI state local (mais simples que Redux), TanStack Query para server state (cache, invalidation) |
| Socket.io | Nativo WebSocket, Ably | Abstraction de rooms, namespace e reconnection ja prontas; Redis adapter para scale futuro |


---

## Apendice B: Glossario

| Termo | Definicao |
|----|----|
| Account | Tenant raiz — uma organizacao no sistema |
| Inbox | Instancia de canal (um numero de WhatsApp) |
| Conversation | Thread de mensagens entre um contato e a equipe |
| Contact | Cliente final que envia/recebe mensagens |
| Agent | Colaborador da empresa que atende os contatos |
| HITL | Human-in-the-Loop — aprovacao humana obrigatoria antes de IA agir |
| AISuggestion | Sugestao de mensagem gerada por IA aguardando revisao humana |
| CannedResponse | Resposta pre-definida com atalho de teclado |
| AutomationRule | Regra evento-condicao-acao executada automaticamente |
| Provider | Implementacao concreta do canal WhatsApp (Evolution API ou Cloud API) |
| BullMQ | Sistema de filas Redis-backed para jobs assincronos |
| source_id | Identificador do contato no provider (numero no formato WhatsApp) |


---

### Critical Files for Implementation

* `/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/genesis-laudo.yml` - Padrao de referencia para o Docker Compose isolado com PostgreSQL dedicado, redes internas e labels Traefik — replica exata da estrutura para o vialum-chat.yml
* `/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/migrations/001_init.sql` - Padrao de schema SQL idempotente com extensao pgcrypto, trigger set_updated_at, indexes e convencoes de naming que devem ser seguidas no schema do Vialum Chat
* `/Users/nicolasamaral/Vialum-Intelligence/genesis-protocolo/app/server.js` - Padrao de webhook handler com idempotency protection, processamento assincrono e resposta imediata ao provider — logica identica necessaria nos handlers `/webhooks/evolution/:inbox_id` e `/webhooks/cloud/:inbox_id`
* `/Users/nicolasamaral/Vialum-Intelligence/genesis-laudo/app/server.js` - Padrao de Express + servicos modularizados (`services/db.js`, `services/clickup.js`) que define a organizacao de modulos do backend Fastify — especialmente o padrao `waitForDb` no startup
* `/Users/nicolasamaral/Vialum-Intelligence/genesis/squads/protocolo/agents/protocolo.md` - Padrao de definicao de agente aiOS que sera o ponto de entrada para criar um potencial agente `@chat` ou `@vialum-chat` no ecossistema AIOS se o projeto for integrado ao framework genesis no futuro


