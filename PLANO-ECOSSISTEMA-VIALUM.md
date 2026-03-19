# Plano de Acao — Ecossistema Vialum: Tudo Conversa com Tudo

> Documento vivo. Nada sera implementado antes de aprovacao.
> Data: 2026-03-11


---

## 1. Visao do Ecossistema

```
                          CLIENTE (WhatsApp)
                                |
                                v
                    ┌───────────────────────┐
                    │     VIALUM CHAT        │
                    │  (frontend + engine)   │
                    │                        │
                    │  ┌─────────────────┐   │
                    │  │   TreeFlow      │   │     Operador humano
                    │  │ (SDR automatico │◄──┼──── (ve tudo, aprova HITL,
                    │  │  + atendimento) │   │     consulta contexto)
                    │  └────────┬────────┘   │
                    └───────────┼────────────┘
                                │
                    webhook / API call
                                │
                    ┌───────────▼────────────┐
                    │      CRM HUB v2        │
                    │  (ponte inteligente)    │
                    │                        │
                    │  /identity/resolve      │ ← "quem e esse contato?"
                    │  /agent/query           │ ← "qual o status dos deals?"
                    │  /webhooks/events       │ ← "deal ganhou, cria task"
                    │                        │
                    └──┬─────┬─────┬────┬────┘
                       │     │     │    │
              ┌────────┘     │     │    └────────┐
              v              v     v             v
        ┌──────────┐  ┌─────────┐ ┌──────┐  ┌──────────┐
        │Pipedrive │  │ClickUp  │ │GDrive│  │RD Station│
        │(vendas)  │  │(operacao)│ │(docs)│  │(futuro)  │
        └──────────┘  └─────────┘ └──────┘  └──────────┘
```

**Principio:** O CRM Hub e o cerebro que conecta tudo. Nenhum sistema fala diretamente com outro — tudo passa pelo Hub.


---

## 2. Redesenho do ClickUp

### 2.1 Problema Atual

Hoje o ClickUp tem 2 listas soltas:

* Lista "Protocolo" (6 status) — onboarding pos-venda
* Lista "Laudos" (3 status) — analise pre-venda

Isso nao reflete o ciclo completo do cliente e nao conversa com Pipedrive.

### 2.2 Estrutura Proposta

```
Workspace: Avelum
└── Space: Genesis
    └── Folder: Operacoes
        │
        ├── Lista: LAUDOS DE VIABILIDADE
        │   Status: para fazer → em processo → feito → entregue
        │   Trigger: Lead entra no Pipeline 2 (Onboarding) do Pipedrive
        │   Saida: Laudo pronto → anexado no deal do Pipedrive
        │
        ├── Lista: REGISTRO DE MARCAS (principal)
        │   Status: contrato → pagamento → docs + gru → protocolo inpi → acompanhamento → completo
        │   Trigger: Deal WON no Pipedrive
        │   Saida: Marca registrada
        │
        └── Lista: OPOSICOES
            Status: recebida → em analise → resposta enviada → resolvida
            Trigger: Manual ou futuro monitoramento INPI
```

### 2.3 Mudancas Chave

| Antes | Depois |
|----|----|
| "solicitar dados" no Protocolo | Eliminado — dados ja vem do Pipedrive/TreeFlow |
| "contrato + proc" como 2o status | Agora e o 1o status (contrato ja e pos-venda) |
| Laudo com 3 status vagos | 4 status claros com "aprovado" antes de entregar |
| Sem link com Pipedrive | Cada card tem campo "Deal ID" linkando ao Pipedrive |
| Sem link com Drive | Cada card tem campo "Pasta Drive" com link direto |

### 2.4 Custom Fields Propostos (por lista)

**LAUDOS DE VIABILIDADE:**

| Campo | Tipo | Uso |
|----|----|----|
| Deal ID (Pipedrive) | Texto | Link ao deal de origem |
| Marca | Texto | Nome da marca analisada |
| Classes NCL | Labels | Classes sugeridas |
| Link Laudo PDF | URL | Google Drive |
| Prioridade | Dropdown | Normal / Urgente |

**REGISTRO DE MARCAS:**

| Campo | Tipo | Uso |
|----|----|----|
| Deal ID (Pipedrive) | Texto | Link ao deal de origem |
| Cliente | Texto | Nome do contratante |
| Marca | Texto | Nome da marca |
| Classes NCL | Texto | "35, 42, 45" |
| Valor Contrato | Moeda | R$ |
| Forma Pagamento | Dropdown | cartao/pix/boleto |
| Parcelas | Numero | Qtd parcelas |
| Pasta Drive | URL | Link da pasta no Drive |
| Link Contrato | URL | PDF no Drive |
| Link Procuracao | URL | PDF no Drive |
| Numero Protocolo INPI | Texto | Apos protocolar |
| Agencia Origem | Texto | Se veio de parceiro |


---

## 3. Fluxos Automatizados

### 3.1 Fluxo 1: Lead Chega (TreeFlow SDR)

```
Cliente manda msg no WhatsApp
    │
    v
Vialum Chat recebe mensagem
    │
    v
TreeFlow ativado (slug: 'sdr-registro-marca')
    │
    ├── Step 1: Abertura
    │   IA: "Ola! Sou da Genesis Marcas. Posso ajudar com registro?"
    │
    ├── Step 2: Qualificacao
    │   Coleta: nome_marca, ramo_atividade, tipo_pessoa (PF/PJ)
    │   CRM Hub call: POST /identity/resolve { phone: "+55..." }
    │   → Ja existe no sistema? Tem deals? Mostrar contexto ao operador
    │
    ├── Step 3: Proposta
    │   IA: Apresenta valor, diferencias, responde objecoes
    │   Se objecao "preco" → estrategia de valor percebido
    │   Se objecao "urgencia" → estrategia de risco
    │
    ├── Step 4: Agendamento
    │   Coleta: data_reuniao, horario
    │   Acao: Criar deal no Pipedrive via CRM Hub
    │
    └── Step 5: Handoff
        Talk completed → operador assume
```

**Integracao CRM Hub:**

* No Step 2, TreeFlow chama `/identity/resolve` pra saber se o lead ja existe
* No Step 4, TreeFlow chama webhook do CRM Hub pra criar deal no Pipedrive
* Todo o contexto coletado (nome_marca, ramo, etc.) e salvo no deal

### 3.2 Fluxo 2: Pipeline de Vendas (Pipedrive)

```
Deal criado no Pipedrive (Pipeline 2: Principal)
    │
    v
Webhook Pipedrive → CRM Hub
    │
    ├── Estagio: Onboarding
    │   CRM Hub cria card no ClickUp: LAUDOS (status: "para fazer")
    │   CRM Hub cria pasta no Drive: Clientes/{marca}-{cliente}/
    │   Notifica operador no Vialum Chat
    │
    ├── Estagio: Laudo Enviado
    │   Squad @laudo gera o laudo → PDF no Drive
    │   CRM Hub atualiza card ClickUp: "aprovado" → "entregue"
    │   CRM Hub anexa link do laudo no deal do Pipedrive
    │
    ├── Estagio: Reuniao / Negociacao
    │   TreeFlow pode retomar conversa (slug: 'follow-up-reuniao')
    │   Auto-mode ou HITL conforme threshold
    │
    └── Estagio: WON ← TRIGGER PRINCIPAL
        │
        v
        CRM Hub recebe webhook "deal.won"
        │
        ├── 1. Cria card no ClickUp: REGISTRO DE MARCAS
        │      Status: "contrato"
        │      Preenche todos os campos do deal
        │
        ├── 2. Dispara Squad @protocolo (ou TreeFlow de coleta)
        │      Coleta dados faltantes (RG, endereco, etc.)
        │      Gera Contrato + Procuracao
        │
        ├── 3. Upload docs no Drive (pasta ja existente)
        │
        ├── 4. Atualiza card ClickUp: "contrato" → "pagamento"
        │
        └── 5. Ativa TreeFlow de cobranca (slug: 'pagamento-follow-up')
             IA envia boleto/pix e acompanha pagamento
```

### 3.3 Fluxo 3: Operacional Pos-Venda

```
Card no ClickUp: REGISTRO DE MARCAS
    │
    ├── Status: contrato
    │   @protocolo gera docs → upload Drive → link no card
    │   Move para: pagamento
    │
    ├── Status: pagamento
    │   TreeFlow (slug: 'pagamento-follow-up') acompanha
    │   Confirmacao manual ou webhook de pagamento
    │   Move para: docs + gru
    │
    ├── Status: docs + gru
    │   Operador prepara documentos INPI + GRU
    │   Move para: protocolo inpi
    │
    ├── Status: protocolo inpi
    │   Operador protocola no INPI
    │   Registra numero protocolo no card
    │   Move para: acompanhamento
    │
    ├── Status: acompanhamento
    │   Monitoramento periodico do processo no INPI
    │   Se oposicao → cria card na lista OPOSICOES
    │   Move para: completo quando certificado emitido
    │
    └── Status: completo
        CRM Hub atualiza Pipedrive: deal metadata
        TreeFlow (slug: 'pos-registro') envia msg ao cliente
        "Sua marca foi registrada! Parabens!"
```

### 3.4 Fluxo 4: Consulta do Operador/IA

```
Operador abre conversa no Vialum Chat
    │
    v
Sidebar mostra contexto (via CRM Hub)
    │
    ├── GET /agent/status?phone=+5543988740276
    │
    └── Resposta:
        {
          contact: { name: "Joao Silva", phone: "5543988740276" },
          resources: [
            { provider: "pipedrive", resourceType: "deal",
              resourceName: "Marca XYZ", status: "won", stage: "Fechado", value: 2000 },
            { provider: "clickup", resourceType: "task",
              resourceName: "Marca XYZ", status: "docs + gru" },
            { provider: "gdrive", resourceType: "folder",
              resourceName: "Marca XYZ - Joao Silva",
              externalUrl: "https://drive.google.com/..." }
          ],
          meta: { providers: ["pipedrive", "clickup", "gdrive"] }
        }

Operador ve na sidebar:
    ┌─────────────────────────────────┐
    │ Joao Silva                       │
    │ +55 43 98874-0276                │
    │                                  │
    │ Pipedrive:                       │
    │   Deal: Marca XYZ (GANHO R$2k)   │
    │                                  │
    │ ClickUp:                         │
    │   Task: Marca XYZ [docs + gru]   │
    │                                  │
    │ Google Drive:                     │
    │   Pasta: Marca XYZ - Joao Silva  │
    └─────────────────────────────────┘
```


---

## 4. CRM Hub — O Que Precisa Ser Adicionado

### 4.1 Webhook Receiver (NOVO)

O CRM Hub precisa de um endpoint para receber webhooks de sistemas externos e disparar acoes:

```
POST /crm/api/v1/webhooks/pipedrive
  → Recebe eventos do Pipedrive (deal.updated, deal.won, deal.lost)
  → Processa e dispara acoes (criar card ClickUp, notificar, etc.)

POST /crm/api/v1/webhooks/clickup
  → Recebe eventos do ClickUp (taskStatusUpdated, taskCreated)
  → Processa e atualiza integracao
```

### 4.2 Action Dispatcher (NOVO)

Modulo que executa acoes em resposta a eventos:

```typescript
interface ActionDefinition {
  trigger: { source: 'pipedrive' | 'clickup'; event: string; conditions: Record<string, unknown> };
  actions: Array<{
    type: 'create_clickup_task' | 'update_clickup_status' | 'create_drive_folder'
        | 'update_pipedrive_deal' | 'notify_vialum_chat' | 'trigger_treeflow';
    params: Record<string, unknown>;
  }>;
}
```

Exemplos:

| Trigger | Acoes |
|----|----|
| Pipedrive deal → "Onboarding" | Criar card ClickUp em LAUDOS; Criar pasta Drive |
| Pipedrive deal → WON | Criar card ClickUp em REGISTRO; Disparar @protocolo/TreeFlow |
| ClickUp task → "completo" | Atualizar metadata no Pipedrive |
| TreeFlow step completed | Atualizar dados no Pipedrive/ClickUp |

### 4.3 ClickUp Provider — Evolucao

O ClickUp provider atual so faz search por nome. Precisa ganhar:

* `createTask(listId, data)` — criar card
* `updateTaskStatus(taskId, status)` — mover status
* `addComment(taskId, comment)` — comentar
* `setCustomField(taskId, fieldId, value)` — preencher campos

### 4.4 Pipedrive Provider — Evolucao

Precisa ganhar:

* `createDeal(pipelineId, stageId, data)` — criar deal
* `updateDeal(dealId, data)` — atualizar deal
* `addNote(dealId, content)` — adicionar nota
* Webhook verification (assinatura)

### 4.5 Integracao TreeFlow ↔ CRM Hub

O TreeFlow precisa poder chamar o CRM Hub durante a conversa:

```
TreeFlow Step (coleta de dados)
    │
    ├── action_filled: "nome_marca" = "ACME"
    ├── action_filled: "telefone" = "+5543999..."
    │
    └── step_transition → "proposta"
        │
        └── Post-processing:
            CRM Hub call: POST /identity/resolve
            CRM Hub call: POST /agent/query { intent: "deal_status" }
            → Contexto injetado no proximo step do TreeFlow
```

Isso permite que a IA do TreeFlow saiba se o lead ja e cliente antes de fazer a proposta.


---

## 5. Multi-Tenant

### 5.1 O Que Ja Funciona

* `account_id` em todas as tabelas do CRM Hub
* Cada tenant configura seus proprios providers (`PUT /providers/:provider`)
* JWT com `accountId` no payload
* Isolamento por query (WHERE account_id = ?)

### 5.2 O Que Precisa Ser Adicionado

| Item | Status | Acao |
|----|----|----|
| RLS no Postgres | Pendente | Adicionar policies em todas as tabelas |
| Tenant onboarding | Pendente | API para criar nova conta + config inicial |
| Billing/limits | Futuro | Rate limiting por tenant, quotas |
| Webhook routing | Pendente | Cada tenant tem seu webhook URL com token unico |
| Provider isolation | OK | Ja funciona — cada tenant tem suas credenciais |
| TreeFlow isolation | OK | tree_flows tem account_id |

### 5.3 Onboarding de Novo Tenant

```
1. Admin cria conta no Vialum Chat → account_id gerado
2. Tenant configura providers no CRM Hub:
   PUT /providers/pipedrive { apiToken: "...", domain: "..." }
   PUT /providers/clickup { apiToken: "...", teamId: "..." }
3. Tenant configura webhooks no Pipedrive → apontando para CRM Hub
4. Tenant cria TreeFlows no Vialum Chat (ou usa templates)
5. Pronto — ecossistema funcional
```


---

## 6. Fases de Implementacao

### Fase A — Fundacao (CRM Hub pronto, ClickUp reorganizado)

**Escopo:**


1. Reorganizar ClickUp conforme secao 2
2. Deploy CRM Hub v2 na VPS (migrations + codigo atual)
3. Verificar todos os endpoints funcionando com dados reais

**Resultado:** Base operacional pronta, endpoints de consulta funcionando.

### Fase B — Webhooks + Actions (sistemas se conectam)

**Escopo:**


1. Webhook receiver no CRM Hub (Pipedrive + ClickUp)
2. Action dispatcher (deal.won → criar card, criar pasta)
3. Evoluir ClickUp provider (createTask, updateStatus, setCustomField)
4. Evoluir Pipedrive provider (createDeal, updateDeal)

**Resultado:** Quando deal muda de status no Pipedrive, ClickUp e Drive reagem automaticamente.

### Fase C — TreeFlow Integration (SDR automatico)

**Escopo:**


1. TreeFlow chama CRM Hub durante conversa (identity/resolve, agent/query)
2. TreeFlow cria deals no Pipedrive via CRM Hub
3. CRM Hub dispara TreeFlows via webhook (ex: deal.won → ativar TreeFlow de coleta)
4. Criar TreeFlows iniciais:
   * `sdr-registro-marca` — qualificacao + agendamento
   * `pagamento-follow-up` — cobranca de pagamento
   * `pos-registro` — comunicacao pos-venda

**Resultado:** Lead chega no WhatsApp → IA qualifica → cria deal → fecha → gera contrato → acompanha pagamento, tudo automatico com HITL nos pontos criticos.

### Fase D — Pipeline Pipedrive (3 funis ativos)

**Escopo:**


1. Configurar os 3 pipelines no Pipedrive (Presenciais, Principal, Web)
2. Campos customizados conforme doc de estrategia
3. Webhooks de cada pipeline apontando pro CRM Hub
4. Automacoes (AUTO-01 a AUTO-15) via CRM Hub action dispatcher
5. TreeFlows especificos por pipeline:
   * Pipeline 1: `nurturing-agencia` — E.Rs e follow-up
   * Pipeline 2: `follow-up-reuniao` — pos-pitch
   * Pipeline 3: `reativacao-agencia` — reengajamento

**Resultado:** Os 3 funis rodando com automacao, TreeFlow em cada estagio relevante.

### Fase E — RD Station (substituicao gradual)

**Escopo:**


1. Ativar OAuth do RD Station (app ja preparado no CRM Hub)
2. Migrar Pipeline 2 (Principal) do Pipedrive → RD Station
3. CRM Hub trata ambos transparentemente (provider abstraction)
4. Periodo de transicao: ambos ativos, dados sincronizados

**Resultado:** RD Station como CRM principal de vendas, Pipedrive desativado gradualmente.

### Fase F — Multi-Tenant (abrir pra outros)

**Escopo:**


1. RLS no Postgres
2. API de onboarding de tenant
3. Templates de TreeFlow (tenant copia e customiza)
4. Dashboard de admin (metricas por tenant)
5. Billing/rate limiting

**Resultado:** Outros escritorios de PI podem usar o ecossistema Vialum.


---

## 7. Perguntas Pendentes (precisam de resposta antes de implementar)

### Sobre ClickUp:


1. **A lista "Protocolo" atual tem cards?** Se sim, precisamos migrar antes de reorganizar.
2. **A lista "Laudos" atual tem cards?** Idem.
3. **Quer manter o Folder "Clientes" ou renomear pra "Operacoes"?** 
4. **A lista "Oposicoes" faz sentido agora ou e futuro?** (depende do volume de oposicoes)

### Sobre Pipedrive:


5. **Os 3 pipelines ja existem no Pipedrive ou precisa criar do zero?**
6. **Ja tem deals no pipeline atual?** Se sim, como quer migrar?
7. **Qual o webhook URL atual do Pipedrive?** (ou ainda nao configurou?)

### Sobre TreeFlow:


 8. **O TreeFlow ja esta implementado no Vialum Chat ou e so o PRD?**
 9. **Qual modelo de LLM vao usar?** (PRD menciona GPT-5.1-mini)
10. **O Vialum Chat ja esta em producao ou em desenvolvimento?**

### Sobre prioridades:


11. **Qual fluxo e mais urgente?**
    * (A) Consulta de contexto (operador ve tudo na sidebar)
    * (B) Automacao deal.won → ClickUp (eliminar trabalho manual)
    * (C) SDR automatico com TreeFlow
    * (D) Todos ao mesmo tempo


---

## 8. Resumo Executivo

| O Que | Onde | Pra Que |
|----|----|----|
| **CRM Hub** | api.luminai.ia.br/crm | Ponte inteligente — conecta tudo |
| **Vialum Chat** | Frontend | Interface unica — chat + contexto + HITL |
| **TreeFlow** | Dentro do Vialum Chat | SDR automatico + atendimento inteligente |
| **Pipedrive** | CRM externo | Pipeline de vendas (3 funis) |
| **ClickUp** | Gestao operacional | Execucao pos-venda (laudo, contrato, INPI) |
| **Google Drive** | Storage | Documentos (laudos, contratos, procuracoes) |
| **RD Station** | CRM futuro | Substitui Pipedrive gradualmente |

**Principio central:** O cliente manda mensagem no WhatsApp. A IA sabe quem ele e, em que ponto esta, o que falta. O operador tem tudo na tela. Nenhum sistema e ilha.