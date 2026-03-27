# Proposta: Squad @registro — Orquestrador de Protocolo de Registro

> **Data:** 2026-03-27
> **Status:** Proposta para validação
> **Modelo:** Squad orquestrador (C) que spawna sub-squads por stage

---

## Decisões incorporadas

| Pergunta | Resposta |
|----------|---------|
| Modo de operação | **C — Híbrido.** Operador ativa, squad avança sozinho, para quando precisa de HITL |
| Granularidade | **C — Orquestrador + sub-squads.** `@registro` orquestra, sub-squads por stage |
| Squad protocolo existente | Continua existindo, `@registro` chama ele no Stage 2 |
| Execução | VPS com APIs próprias. Manual hoje, cron no futuro |
| Termos do usuário | Dados comerciais: valor, parcelas, forma pgto, tipo de marca (mista/nominativa). Pode ser informado até o pré-protocolo |
| Emitir CNPJ | Emitir certificado de CNPJ + quadro societário → renomear para "Emitir certidão CNPJ e QSA" |
| Gerar documento dos clientes | Removido — substituído por "Selecionar documentos do cliente" (revisar o que foi recebido) |
| Guia de ajuda | IA prepara dados mastigados pra operador copiar e colar no e-INPI |
| Cobrar pagamento | GRU apenas. Pagamento do contrato acontece no CRM (comercial), antes desse workflow |
| Pagamento do contrato | Controlado por etiqueta no ClickUp. Cliente pode pagar até Stage 5 (Cadastro e GRU). Não é gate nesse workflow — é gate no CRM |

---

## 1. Visão geral da arquitetura

```
@registro (orquestrador)
│
│  Conhece o workflow inteiro
│  Sabe em que stage/step cada card está (via ClickUp)
│  Decide o que fazer
│  Spawna o sub-squad correto
│  Gerencia HITL (approval antes de enviar msgs)
│  Move cards entre status
│
├── @qualificacao (sub-squad)
│   Coleta dados do cliente via WhatsApp
│   Preenche ClickUp
│
├── @protocolo (sub-squad — JÁ EXISTE)
│   Gera contrato + procuração (PDFs)
│   Upload no Drive
│
├── @documentos (sub-squad)
│   Solicita, classifica e valida docs do cliente
│
├── @inpi-prep (sub-squad)
│   Prepara dados mastigados pro operador (guia de ajuda)
│   Gera certidão CNPJ + QSA
│
├── @cobranca (sub-squad)
│   Follow-up de pagamento de GRU
│   Detecta e valida comprovantes
│
├── @estrategia (sub-squad)
│   Monta proposta de depósito
│   Envia pro cliente e gerencia ida e volta
│
└── @protocolo-inpi (sub-squad)
    Checa documentação completa
    Gera dados pra copiar/colar no e-INPI
    Envia comprovantes ao cliente
```

---

## 2. Estrutura de diretórios

```
squads/
├── registro/                          # ORQUESTRADOR
│   ├── squad.yaml
│   ├── agents/
│   │   └── registro.md               # @registro — orquestrador
│   ├── tasks/
│   │   ├── registro-processar.md      # *processar — loop principal
│   │   ├── registro-status.md         # *status — mostra estado
│   │   └── registro-iniciar.md        # *iniciar — cria novo workflow
│   ├── workflows/
│   │   └── protocolo-registro.yaml    # Definição YAML completa do workflow
│   └── scripts/
│       └── clickup-tree.js            # Lê árvore ClickUp (1 chamada)
│
├── qualificacao/                      # SUB-SQUAD: Stage 1
│   ├── squad.yaml
│   ├── agents/
│   │   └── qualificacao.md
│   └── tasks/
│       ├── qualificacao-enviar.md     # Prepara + envia msg qualificação
│       ├── qualificacao-interpretar.md # Interpreta respostas
│       └── qualificacao-consolidar.md # Consolida no ClickUp
│
├── protocolo/                         # SUB-SQUAD: Stage 2 (JÁ EXISTE)
│   └── (mantém como está)
│
├── documentos/                        # SUB-SQUAD: Stage 4
│   ├── squad.yaml
│   ├── agents/
│   │   └── documentos.md
│   └── tasks/
│       ├── documentos-solicitar.md    # Solicita docs via WhatsApp
│       ├── documentos-classificar.md  # Classifica e valida
│       └── documentos-selecionar.md   # Revisa conjunto final
│
├── inpi-prep/                         # SUB-SQUAD: Stage 5
│   ├── squad.yaml
│   ├── agents/
│   │   └── inpi-prep.md
│   └── tasks/
│       ├── inpi-cadastro-guia.md      # Gera guia mastigado pra cadastro
│       ├── inpi-gru-guia.md           # Gera guia mastigado pra GRU
│       └── inpi-certidao-cnpj.md      # Emitir certidão CNPJ + QSA
│
├── cobranca/                          # SUB-SQUAD: Stage 6
│   ├── squad.yaml
│   ├── agents/
│   │   └── cobranca.md
│   └── tasks/
│       ├── cobranca-followup.md       # Follow-up de pagamento GRU
│       └── cobranca-validar.md        # Validar comprovante
│
├── estrategia/                        # SUB-SQUAD: Stage 7
│   ├── squad.yaml
│   ├── agents/
│   │   └── estrategia.md
│   └── tasks/
│       ├── estrategia-analisar.md     # Análise de depósito
│       ├── estrategia-proposta.md     # Monta e envia proposta
│       └── estrategia-aceite.md       # Gerencia ida e volta
│
└── protocolo-inpi/                    # SUB-SQUAD: Stage 8
    ├── squad.yaml
    ├── agents/
    │   └── protocolo-inpi.md
    └── tasks/
        ├── protocolo-checagem.md      # Checa documentação completa
        ├── protocolo-guia.md          # Gera dados mastigados pra copiar/colar
        └── protocolo-comprovantes.md  # Envia comprovantes ao cliente
```

---

## 3. Como funciona o orquestrador (@registro)

### Comando principal: `*processar`

```
@registro *processar

1. Consulta ClickUp (1 chamada, subtasks=true, lista Protocolo)
2. Para cada card com status != completo && != cancelado:
   a. Lê a árvore de subtasks/sub-subtasks
   b. Identifica em que stage/step está
   c. Decide a PRÓXIMA AÇÃO:

   TABELA DE DECISÃO:
   ┌─────────────────────┬───────────────────────────────────────────┐
   │ Estado atual         │ Ação do orquestrador                     │
   ├─────────────────────┼───────────────────────────────────────────┤
   │ Step pending +       │ Spawna sub-squad correspondente          │
   │ executor: ai/system  │ Ex: @qualificacao *enviar                │
   │                      │                                          │
   │ Step pending +       │ Nada — está no backlog do operador.     │
   │ executor: human      │ Garante que assignee está correto        │
   │                      │ no ClickUp.                              │
   │                      │                                          │
   │ Step pending_approval│ Nada — esperando humano aprovar.        │
   │                      │ Se > 24h, envia lembrete.               │
   │                      │                                          │
   │ Step waiting_client  │ Verifica se cliente respondeu.           │
   │                      │ Se sim → avança. Se não, verifica       │
   │                      │ schedule de follow-up.                   │
   │                      │                                          │
   │ Step done (gate)     │ Move card pro próximo status ClickUp.    │
   │ + todos steps do     │ Atualiza subtasks do próximo stage.     │
   │   stage done         │                                          │
   │                      │                                          │
   │ Todos stages done    │ Move card pra completo. Fim.            │
   └─────────────────────┴───────────────────────────────────────────┘

3. Loga tudo como comentário no card ClickUp
4. Retorna relatório:
   "📊 Processados: 15 cards
    ✅ Avançados: 3
    ⏳ Esperando cliente: 5
    🟡 Esperando aprovação: 2
    👤 Esperando operador: 4
    ❌ Bloqueados: 1"
```

### Comando: `*iniciar {marca} {cliente}`

```
@registro *iniciar "Marca XYZ" "João Silva"

1. Cria card no ClickUp (status: qualificação)
2. Cria subtasks (stages) + sub-subtasks (steps)
3. Preenche custom fields básicos
4. Atribui responsável (contato@avelumia.com)
5. Spawna @qualificacao para o primeiro step
```

### Comando: `*status`

```
@registro *status

Mostra todos os cards ativos com seu estado:

CARDS ATIVOS:
  1. Marca XYZ (João Silva)     [qualificação]  ⏳ waiting_client (D+2)
  2. Marca ABC (Maria Souza)    [documentos]     🟡 pending_approval (@operador)
  3. Marca DEF (Empresa LTDA)   [pré-protocolo]  👤 waiting_human (@analista)
  ...
```

---

## 4. Como funciona o HITL nos sub-squads

### Padrão: IA prepara → humano aprova → sistema envia

Cada sub-squad que envia mensagem ao cliente segue este padrão:

```
SUB-SQUAD (ex: @qualificacao *enviar)
│
├── 1. IA prepara mensagem
│      → Lê dados do card ClickUp
│      → Monta mensagem personalizada
│      → Salva como draft
│
├── 2. Atualiza ClickUp
│      → Sub-subtask "Enviar msg qualificação" → status: pending_approval
│      → Assignee: operador
│      → Comentário: "🟡 Mensagem preparada, aguardando aprovação"
│      → Comentário com o TEXTO DA MENSAGEM pra operador ler
│
├── 3. PARA (retorna controle ao orquestrador)
│
│   ... operador vê no ClickUp ...
│   ... operador aprova (muda status da sub-subtask para 'approved') ...
│   ... ou edita (comenta com o texto correto) ...
│
├── 4. Próxima execução do *processar detecta aprovação
│      → Spawna sub-squad novamente
│      → Sub-squad lê aprovação, envia via Vialum Chat API
│
└── 5. Atualiza ClickUp
       → Sub-subtask → status: waiting_client
       → Comentário: "✅ Mensagem enviada. Aguardando resposta."
```

### Onde o operador vê e age

**No ClickUp:**
- Filtra "My Tasks" → vê todas sub-subtasks atribuídas a ele
- Sub-subtasks com status `pending_approval` = precisa agir
- Lê a mensagem no comentário do card
- Muda status pra `approved` (ou comenta com edição)

**No futuro (Vialum Tasks Web):**
- Dashboard com fila de aprovações
- Botões: Aprovar / Editar / Rejeitar
- Preview da mensagem inline

---

## 5. Fluxo completo de um card (exemplo real)

```
DIA 1 — Vendedor fecha deal
─────────────────────────────

  Operador: @registro *iniciar "Aquapulse" "Carlos Mendes"

  → Card criado no ClickUp (qualificação)
  → 8 subtasks criadas (stages)
  → Sub-subtasks criadas nos stages
  → @qualificacao spawna automaticamente

  @qualificacao:
  → Lê dados do deal (via CRM Hub)
  → Prepara msg de qualificação
  → Salva draft no ClickUp: "pending_approval"
  → PARA

  Operador vê no ClickUp: 🟡 "Msg de qualificação pronta"
  → Lê a mensagem no comentário
  → Aprova (muda status da sub-subtask)

  Próximo *processar:
  → Detecta aprovação
  → Envia msg via Vialum Chat
  → Sub-subtask → waiting_client

DIA 2 — Cliente responde
─────────────────────────

  Webhook Vialum Chat → detecta mensagem do cliente
  ou
  Cron *processar → detecta mensagem nova na conversa

  @qualificacao *interpretar:
  → Lê mensagens do cliente
  → Extrai: nome, CPF, endereço, tipo PF
  → Falta: RG, estado civil
  → Prepara msg pedindo o que falta
  → Salva draft: "pending_approval"
  → PARA

  Operador aprova → envia → waiting_client

DIA 3 — Cliente completa
─────────────────────────

  *processar detecta resposta completa

  @qualificacao *consolidar:
  → Atualiza card ClickUp com todos os dados
  → Sub-subtask "Consolidar" → done
  → Sub-subtask "Revisar dados" → pending (assignee: operador)

  Operador revisa card:
  → Confere dados, tudo OK
  → Marca sub-subtask "Revisar" → done

  *processar detecta gate completo:
  → Move card pra "contrato e procuração"
  → Spawna @protocolo (o squad que JÁ EXISTE)

DIA 3-4 — Contrato
───────────────────

  @protocolo gera PDFs (fluxo existente)
  → Operador revisa → aprova
  → Upload Drive
  → Prepara msg de envio → pending_approval
  → Operador aprova → envia ao cliente
  → Move card pra "aguardando assinatura"
  → waiting_client (follow-up D+1, D+3)

DIA 5-7 — Assinatura
─────────────────────

  Cliente envia doc assinado
  → Classification Hub detecta documento assinado
  → Sub-subtask "Validar assinatura" → pending (assignee: operador)
  → Operador confere → done

  Sub-squad @inpi-prep:
  → Emitir certidão CNPJ + QSA (human, assignee: operador)
  → Operador faz manualmente → done

  Gate completo → move card pra "documentos"

DIA 7-10 — Documentos
──────────────────────

  @documentos *solicitar:
  → Prepara msg pedindo RG, CPF, comprovante residência
  → pending_approval → operador aprova → envia
  → waiting_client

  Cliente envia fotos:
  → Classification Hub classifica cada uma
  → Operador verifica legibilidade (HITL)
  → Se ruim, @documentos prepara msg de reenvio (HITL)
  → Loop até completo

  Gate → move card pra "cadastro e gru"

DIA 10-12 — Cadastro e GRU
───────────────────────────

  @inpi-prep *cadastro-guia:
  → IA prepara dados mastigados:
    "COPIE E COLE NO E-INPI:
     Titular: Carlos Mendes da Silva
     CPF: 123.456.789-00
     Endereço: Rua X, 123, Londrina-PR, 86000-000
     ..."
  → pending_approval → operador aprova
  → Operador copia, cola no e-INPI, cadastra
  → Marca done

  @inpi-prep *gru-guia:
  → IA prepara dados pra gerar GRU:
    "DADOS PARA GRU:
     Classe 35 — Serviços de publicidade
     Classe 42 — Serviços tecnológicos
     Valor por classe: R$ 298,00
     ..."
  → Operador gera GRUs no INPI → anexa no card

  @cobranca:
  → Prepara msg com GRUs pro cliente
  → pending_approval → operador aprova → envia
  → Move card pra "pagamento gru"
  → waiting_client (follow-up D+1, D+3, D+5)

DIA 12-20 — Pagamento
──────────────────────

  Cliente envia comprovante
  → Classification Hub detecta comprovante
  → Assignee: financeiro valida
  → Gate → move card pra "pré-protocolo"

DIA 20-30 — Pré-protocolo (pode demorar)
─────────────────────────────────────────

  @estrategia:
  → Analista faz análise (human)
  → Monta proposta (human)
  → IA formata proposta → pending_approval → envia
  → waiting_client
  → Cliente pede ajustes → loop
  → Cliente aprova → registra aceite
  → Gate → move card pra "protocolo"

DIA 30+ — Protocolo
────────────────────

  @protocolo-inpi *checagem:
  → Verifica tudo: docs ✓, GRUs pagas ✓, aceite ✓

  @protocolo-inpi *guia:
  → IA prepara dados mastigados pra copiar/colar no e-INPI:
    "DADOS PARA DEPÓSITO:
     Marca: AQUAPULSE (nominativa)
     Classe: 35
     Especificação: Serviços de publicidade e marketing digital
     Titular: Carlos Mendes da Silva (CPF: ...)
     Procurador: Genesis Marcas Ltda (CNPJ: 51.829.412/0001-70)
     ..."
  → Operador protocola no e-INPI
  → Registra número no ClickUp

  @protocolo-inpi *comprovantes:
  → Prepara msg de conclusão → pending_approval → envia
  → Move card pra completo
  → FIM 🎉
```

---

## 6. Termos comerciais (valor, parcelas, forma pgto, tipo marca)

Os dados comerciais podem ser informados em qualquer momento até o pré-protocolo:

```yaml
# No workflow YAML, campo com deadline flexível:
termos_comerciais:
  campos:
    - valor_contrato      # R$ total
    - parcelas            # quantidade
    - forma_pagamento     # cartao / pix / boleto
    - tipo_marca          # mista / nominativa / figurativa
  obrigatorio_ate: pre-protocolo   # deadline: Stage 7
  origem: qualificacao             # coleta ideal: Stage 1
  fallback: >
    Se não informado na qualificação, o orquestrador cobra
    no início de cada stage subsequente até ser preenchido.
```

O orquestrador verifica a cada `*processar`:
- Se `termos_comerciais` estão completos → OK
- Se faltam e stage atual < pré-protocolo → lembrete no card
- Se faltam e stage atual == pré-protocolo → **bloqueio** (não avança sem)

---

## 7. Execução na VPS

### Fase 1: Manual (agora)

```bash
# Operador roda quando quiser:
cd /Users/nicolasamaral/vialum-intelligence/genesis
claude -p "@registro *processar"
```

### Fase 2: Cron (quando estabilizar)

```bash
# VPS — a cada 30 min em horário comercial:
*/30 8-18 * * 1-5 cd /opt/vialum/genesis && claude -p "@registro *processar" --dangerously-skip-permissions >> /var/log/registro.log 2>&1
```

### Fase 3: Webhook-driven (futuro)

```
ClickUp webhook → Vialum Tasks API → spawna @registro *processar
Vialum Chat webhook → Vialum Tasks API → spawna @registro *processar
```

---

## 8. O que construir e em que ordem

### Sprint 1: Orquestrador + Qualificação (1-2 semanas)

| O que | Detalhe |
|-------|---------|
| `squads/registro/` | Orquestrador com `*iniciar`, `*processar`, `*status` |
| `squads/qualificacao/` | Sub-squad com `*enviar`, `*interpretar`, `*consolidar` |
| Script `clickup-tree.js` | Lê árvore completa do ClickUp em 1 chamada |
| Integração Vialum Chat | Envio de mensagens via API |
| Testar com 1 card real | Card "TESTE" no ClickUp |

### Sprint 2: Reusar @protocolo + Documentos (1-2 semanas)

| O que | Detalhe |
|-------|---------|
| Adaptar `@protocolo` existente | Integrar com orquestrador |
| `squads/documentos/` | Solicitar, classificar, validar docs |
| Integração Classification Hub | Classificar docs recebidos |
| Integração Media Service | Persistir media recebida |

### Sprint 3: INPI-prep + Cobrança (1-2 semanas)

| O que | Detalhe |
|-------|---------|
| `squads/inpi-prep/` | Guia mastigado, certidão CNPJ+QSA |
| `squads/cobranca/` | Follow-up GRU, validar comprovante |

### Sprint 4: Estratégia + Protocolo INPI (1-2 semanas)

| O que | Detalhe |
|-------|---------|
| `squads/estrategia/` | Proposta de depósito, ida e volta |
| `squads/protocolo-inpi/` | Checagem final, guia copiar/colar, comprovantes |

### Sprint 5: Cron + estabilização (1 semana)

| O que | Detalhe |
|-------|---------|
| Cron na VPS | `*/30 8-18 * * 1-5` |
| Logs e monitoramento | Log de cada execução |
| Teste E2E | 1 caso PF + 1 caso PJ completo |

---

## 9. Resumo do modelo

```
┌──────────────────────────────────────────────────────────┐
│                    @registro                              │
│              (orquestrador — 1 squad)                     │
│                                                          │
│   Lê ClickUp → Decide → Spawna sub-squad → Atualiza     │
│                                                          │
│   HITL: toda msg pro cliente passa por approval          │
│   Estado: ClickUp (subtasks + status)                    │
│   Delegação: ClickUp (assignee por sub-subtask)          │
│   Runtime: squad (hoje) → langchain (amanhã) → script    │
│                                                          │
│   Cron: */30 8-18 * * 1-5                                │
│   Trigger: cron + webhook (ClickUp + Chat)               │
└──────────┬───────────────────────────────────────────────┘
           │
     ┌─────┼──────┬──────────┬──────────┬─────────┬──────────┬──────────┐
     ▼     ▼      ▼          ▼          ▼         ▼          ▼          ▼
  @qualif @prot  @docs    @inpi-prep @cobranca @estrategia @prot-inpi
  (novo) (existe)(novo)    (novo)     (novo)    (novo)      (novo)
```

---

*Próximo passo: validar essa proposta → começar Sprint 1 (orquestrador + qualificação).*
