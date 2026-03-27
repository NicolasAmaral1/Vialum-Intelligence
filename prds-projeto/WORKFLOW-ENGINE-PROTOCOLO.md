# Workflow Engine — Protocolo de Registro (Implementação)

> **Data:** 2026-03-26
> **Status:** Proposta para validação
> **Dependências:** Vialum Tasks, Vialum Chat, CRM Hub, Media Service, Classification Hub, ClickUp


---

## 1. Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                        VIALUM TASKS ENGINE                       │
│                                                                  │
│  1. Lê workflow YAML (definição)                                │
│  2. Consulta ClickUp (estado atual — 1 chamada)                 │
│  3. Identifica próximo step a executar                          │
│  4. Despacha para o runtime correto (squad/langchain/script)    │
│  5. Se approval: required → cria aprovação, pausa              │
│  6. Se wait_for: client → configura follow-up, pausa           │
│  7. Atualiza ClickUp (status subtask, assignee, comentário)    │
│                                                                  │
│  Trigger: Cron (*/5 * * * *) + Webhook (ClickUp/Chat events)   │
└───────────┬──────────┬──────────┬──────────┬────────────────────┘
            │          │          │          │
            ▼          ▼          ▼          ▼
      ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
      │ ClickUp  │ │ Vialum │ │ Media  │ │Classific.│
      │ API      │ │ Chat   │ │Service │ │   Hub    │
      │(estado + │ │(envio +│ │(upload │ │(classif. │
      │ board +  │ │ HITL)  │ │ docs)  │ │ docs)    │
      │delegação)│ │        │ │        │ │          │
      └──────────┘ └────────┘ └────────┘ └──────────┘
```

### Trigger duplo

| Trigger | Quando | O que faz |
|----|----|----|
| **Cron** (`*/5 * * * *`) | Cada 5 minutos | Varre todos os workflows ativos, identifica steps prontos pra executar |
| **Webhook** (ClickUp) | Status mudou, subtask atualizada | Reage imediatamente a ação do operador |
| **Webhook** (Vialum Chat) | Cliente enviou mensagem/media | Reage a resposta do cliente |


---

## 2. Workflow Definition YAML

```yaml
# workflows/protocolo-registro.yaml

workflow:
  id: protocolo-registro
  name: Protocolo de Registro de Marca
  description: Do aceite do cliente até envio do comprovante de protocolo INPI
  version: 1.0.0

  trigger:
    type: manual  # operador cria via portal ou ClickUp
    creates:
      clickup_task:
        list_id: "901322069698"
        initial_status: qualificacao

  data_schema:
    marca: { type: string, required: true }
    cliente: { type: string, required: true }
    tipo_pessoa: { type: enum, values: [PF, PJ], required: true }
    classes_ncl: { type: string, required: true }
    valor_contrato: { type: number, required: true }
    forma_pagamento: { type: enum, values: [cartao, pix, boleto] }
    parcelas: { type: number, default: 1 }
    deal_id: { type: string }
    conversation_id: { type: string }
    pasta_drive: { type: url }
    protocolo_inpi: { type: string }

  follow_up:
    default_schedule: [1, 3, 5]  # dias após envio
    skip_weekends: true
    max_attempts: 5
    escalate_after: 10  # dias sem resposta → notifica operador

# ─────────────────────────────────────────────────
# STAGES
# ─────────────────────────────────────────────────

stages:

  # ═══════════════════════════════════════════════
  - id: qualificacao
    name: Qualificação
    clickup_status: qualificacao
    tasks:

      - id: coletar-dados
        name: Coletar dados do cliente
        steps:

          - id: preencher-termos
            name: Preencher termos do usuário
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            description: >
              Operador preenche termos internos antes de iniciar contato.
            # TODO: confirmar o que são esses termos exatamente

          - id: preparar-msg-qualificacao
            name: Preparar mensagem de qualificação
            executor: ai
            approval: required
            wait_for: null
            assignee: operador  # aprova
            runtime: squad
            migrate_to: langchain
            migrate_when: "20+ execuções sem edição"
            description: >
              IA monta mensagem pedindo: PF/PJ, nome completo, CPF/CNPJ,
              RG, nacionalidade, estado civil, profissão, endereço, email.
            tools:
              - vialum_chat.draft_message

          - id: enviar-msg-qualificacao
            name: Enviar mensagem no WhatsApp
            executor: system
            approval: none
            wait_for: client
            assignee: null
            runtime: script
            description: >
              Vialum Chat envia mensagem aprovada.
              Workflow pausa esperando resposta.
            tools:
              - vialum_chat.send_message
            follow_up:
              schedule: [1, 3, 5]
              message_runtime: squad  # follow-ups também passam por squad
              message_approval: required

          - id: interpretar-respostas
            name: Interpretar respostas do cliente
            executor: ai
            approval: none
            wait_for: null
            assignee: null
            runtime: squad
            migrate_to: langchain
            migrate_when: "schema de extração estável"
            description: >
              IA lê mensagens do cliente, extrai dados estruturados,
              identifica o que falta.
            tools:
              - vialum_chat.read_messages
            outputs:
              - dados_extraidos  # JSON com campos preenchidos
              - campos_faltantes  # lista do que falta

          - id: pedir-dados-faltantes
            name: Pedir dados faltantes
            executor: ai
            approval: required
            wait_for: client
            assignee: operador  # aprova
            runtime: squad
            migrate_to: langchain
            condition: "campos_faltantes.length > 0"  # só executa se falta algo
            description: >
              Se faltam dados, IA prepara mensagem pedindo.
              Humano aprova. Sistema envia. Loop até completar.
            tools:
              - vialum_chat.draft_message
              - vialum_chat.send_message
            loop:
              back_to: interpretar-respostas
              max_iterations: 5
              escalate_to: operador

          - id: consolidar-clickup
            name: Consolidar dados no ClickUp
            executor: system
            approval: none
            wait_for: null
            assignee: null
            runtime: script
            description: >
              Cria/atualiza card no ClickUp com todos os dados.
            tools:
              - crm_hub.update_task
              - crm_hub.set_custom_fields

          - id: revisar-dados
            name: Revisar dados do card
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            description: >
              Operador abre card, confere dados.
              Se errado, corrige manualmente ou pede ao cliente.
            gate: true  # step que libera avanço de stage

  # ═══════════════════════════════════════════════
  - id: contrato-procuracao
    name: Contrato e Procuração
    clickup_status: contrato e procuracao
    tasks:

      - id: confeccionar-docs
        name: Confeccionar documentos
        steps:

          - id: montar-json
            name: Montar dados para geração
            executor: system
            approval: none
            wait_for: null
            runtime: script
            description: >
              Monta JSON com dados do card ClickUp para assemble_contract.py.
            tools:
              - crm_hub.get_task

          - id: gerar-pdfs
            name: Gerar PDFs
            executor: system
            approval: none
            wait_for: null
            runtime: script
            description: >
              Executa assemble_contract.py → gera contrato.pdf + procuracao.pdf.
            tools:
              - scripts.assemble_contract

          - id: revisar-docs
            name: Revisar documentos
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            description: >
              Operador abre PDFs, confere nome, CPF/CNPJ, marca, classes, valores.

          - id: upload-drive
            name: Upload no Drive + ClickUp
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - google_drive.upload
              - crm_hub.add_attachment

      - id: enviar-assinatura
        name: Enviar para assinatura
        steps:

          - id: preparar-msg-docs
            name: Preparar mensagem de envio
            executor: ai
            approval: required
            wait_for: null
            assignee: operador
            runtime: squad
            migrate_to: langchain
            migrate_when: "template estabilizado"

          - id: enviar-docs-whatsapp
            name: Enviar docs via WhatsApp
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - vialum_chat.send_media
            gate: true

  # ═══════════════════════════════════════════════
  - id: aguardando-assinatura
    name: Aguardando Assinatura
    clickup_status: aguardando ass
    tasks:

      - id: obter-assinatura
        name: Obter documentos assinados
        steps:

          - id: aguardar-devolucao
            name: Aguardar devolução assinada
            executor: system
            approval: none
            wait_for: client
            runtime: script
            follow_up:
              schedule: [1, 3, 5]
              message_runtime: squad
              message_approval: required

          - id: detectar-assinado
            name: Detectar documento assinado
            executor: ai
            approval: none
            wait_for: null
            runtime: script  # Classification Hub, não precisa de LLM caro
            tools:
              - classification_hub.classify

          - id: validar-assinatura
            name: Validar assinatura
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human

          - id: cobrar-pagamento-contrato
            name: Cobrar pagamento do contrato
            executor: human
            approval: none
            wait_for: null
            assignee: financeiro
            runtime: human
            # TODO: confirmar — é cobrança do contrato ou da GRU?

          - id: emitir-cnpj
            name: Emitir CNPJ
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            # TODO: confirmar — o que é isso exatamente?

          - id: anexar-assinados
            name: Anexar docs assinados
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.add_attachment
            gate: true

  # ═══════════════════════════════════════════════
  - id: documentos
    name: Documentos do Cliente
    clickup_status: docs
    tasks:

      - id: coletar-docs
        name: Coletar e validar documentos
        steps:

          - id: preparar-msg-docs-pessoais
            name: Preparar solicitação de documentos
            executor: ai
            approval: required
            wait_for: null
            assignee: operador
            runtime: squad
            migrate_to: langchain

          - id: enviar-solicitacao-docs
            name: Enviar solicitação via WhatsApp
            executor: system
            approval: none
            wait_for: client
            runtime: script
            tools:
              - vialum_chat.send_message
            follow_up:
              schedule: [1, 3, 5]
              message_runtime: squad
              message_approval: required

          - id: classificar-doc
            name: Classificar documento recebido
            executor: ai
            approval: none
            wait_for: null
            runtime: script  # Classification Hub
            tools:
              - media_service.persist
              - classification_hub.classify

          - id: verificar-legibilidade
            name: Verificar legibilidade
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human

          - id: pedir-reenvio
            name: Pedir reenvio se necessário
            executor: ai
            approval: required
            wait_for: client
            assignee: operador
            runtime: squad
            condition: "doc_rejeitado == true"
            loop:
              back_to: classificar-doc

          - id: verificar-completude
            name: Verificar se todos foram recebidos
            executor: system
            approval: none
            wait_for: null
            runtime: script
            loop:
              back_to: enviar-solicitacao-docs
              condition: "docs_faltantes.length > 0"

          - id: anexar-docs
            name: Anexar tudo no ClickUp
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.add_attachment

          - id: gerar-doc-clientes
            name: Gerar documento dos clientes
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            # TODO: confirmar — que documento é esse?
            gate: true

  # ═══════════════════════════════════════════════
  - id: cadastro-gru
    name: Cadastro INPI e GRU
    clickup_status: gru
    tasks:

      - id: cadastrar-inpi
        name: Cadastrar no INPI
        steps:

          - id: cadastrar-titular
            name: Cadastrar titular no e-INPI
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            migrate_to: script
            migrate_when: "Playwright automação do e-INPI pronta"

      - id: gerar-enviar-grus
        name: Gerar e enviar GRUs
        steps:

          - id: gerar-grus
            name: Gerar GRUs no INPI
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            migrate_to: script
            migrate_when: "Playwright automação do e-INPI pronta"

          - id: gerar-guia-ajuda
            name: Gerar guia de ajuda
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            # TODO: confirmar — é tutorial pro cliente ou é a própria GRU?

          - id: anexar-grus
            name: Anexar GRUs no card
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.add_attachment

          - id: preparar-msg-grus
            name: Preparar mensagem com GRUs
            executor: ai
            approval: required
            wait_for: null
            assignee: operador
            runtime: squad
            migrate_to: langchain

          - id: enviar-grus
            name: Enviar GRUs via WhatsApp
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - vialum_chat.send_media
            gate: true

  # ═══════════════════════════════════════════════
  - id: pagamento-gru
    name: Pagamento das GRUs
    clickup_status: pagamento gru
    tasks:

      - id: acompanhar-pagamento
        name: Acompanhar e confirmar pagamento
        steps:

          - id: followup-pagamento
            name: Follow-up de pagamento
            executor: ai
            approval: required
            wait_for: client
            assignee: operador
            runtime: squad
            migrate_to: langchain
            follow_up:
              schedule: [1, 3, 5]

          - id: detectar-comprovante
            name: Detectar comprovante
            executor: ai
            approval: none
            wait_for: null
            runtime: script  # Classification Hub
            tools:
              - classification_hub.classify

          - id: validar-comprovante
            name: Validar comprovante
            executor: human
            approval: none
            wait_for: null
            assignee: financeiro
            runtime: human
            gate: true

  # ═══════════════════════════════════════════════
  - id: pre-protocolo
    name: Pré-Protocolo (Estratégia)
    clickup_status: pré-protocolo
    tasks:

      - id: estrategia-aceite
        name: Definir estratégia e obter aceite
        steps:

          - id: analisar-estrategia
            name: Analisar estratégia de depósito
            executor: human
            approval: none
            wait_for: null
            assignee: analista
            runtime: human
            migrate_to: squad
            migrate_when: "base de conhecimento PI suficiente"

          - id: montar-proposta
            name: Montar proposta de depósito
            executor: human
            approval: none
            wait_for: null
            assignee: analista
            runtime: human

          - id: preparar-msg-proposta
            name: Preparar mensagem com proposta
            executor: ai
            approval: required
            wait_for: null
            assignee: operador
            runtime: squad

          - id: enviar-proposta
            name: Enviar proposta via WhatsApp
            executor: system
            approval: none
            wait_for: client
            runtime: script
            tools:
              - vialum_chat.send_message

          - id: aguardar-aceite
            name: Aguardar aceite do cliente
            executor: system
            approval: none
            wait_for: client
            runtime: script

          - id: ajustar-estrategia
            name: Ajustar estratégia
            executor: human
            approval: none
            wait_for: null
            assignee: analista
            runtime: human
            condition: "cliente_aprovou == false"
            loop:
              back_to: montar-proposta
              max_iterations: 10
              escalate_to: operador

          - id: registrar-aceite
            name: Registrar aceite final
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.update_task
            gate: true

  # ═══════════════════════════════════════════════
  - id: protocolo
    name: Protocolo INPI
    clickup_status: protocolo
    tasks:

      - id: efetuar-protocolo
        name: Efetuar protocolo(s)
        steps:

          - id: checar-documentacao
            name: Checagem de documentação completa
            executor: system
            approval: none
            wait_for: null
            runtime: script
            description: >
              Verifica se todos pré-requisitos estão OK:
              docs, GRUs pagas, aceite registrado.

          - id: submeter-inpi
            name: Submeter pedido(s) no e-INPI
            executor: human
            approval: none
            wait_for: null
            assignee: operador
            runtime: human
            migrate_to: script
            migrate_when: "Playwright automação do e-INPI pronta"

          - id: registrar-protocolo
            name: Registrar número(s) de protocolo
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.set_custom_fields

      - id: enviar-comprovantes
        name: Enviar comprovantes ao cliente
        steps:

          - id: salvar-comprovantes
            name: Salvar comprovantes
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - google_drive.upload
              - crm_hub.add_attachment

          - id: preparar-msg-conclusao
            name: Preparar mensagem de conclusão
            executor: ai
            approval: required
            wait_for: null
            assignee: operador
            runtime: squad
            migrate_to: langchain

          - id: enviar-comprovantes-whatsapp
            name: Enviar comprovantes via WhatsApp
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - vialum_chat.send_media

          - id: finalizar
            name: Mover card para completo
            executor: system
            approval: none
            wait_for: null
            runtime: script
            tools:
              - crm_hub.update_status
            gate: true  # FIM
```


---

## 3. Como o Engine funciona (loop principal)

```
CADA 5 MINUTOS (cron) ou EVENTO (webhook):

1. Buscar todos os workflows ativos
   → SELECT * FROM task_workflows WHERE status = 'active'

2. Para cada workflow:
   a. Ler o YAML da definition
   b. Consultar ClickUp (1 chamada, subtasks=true)
   c. Montar árvore de estado (qual step está em qual estado)
   d. Identificar o PRÓXIMO step executável:
      - Status da sub-subtask == 'pending'
      - Todos os steps anteriores == 'done'
      - Conditions avaliadas como true
      - Não está em loop aguardando

3. Para o step identificado:

   SE runtime == 'human':
     → Garantir que subtask no ClickUp tem assignee correto
     → Garantir que status == 'in_progress'
     → PARAR (espera humano agir)

   SE runtime == 'squad':
     → Montar prompt com contexto (dados do card, histórico, instrução)
     → Spawnar squad via Claude Code CLI
     → Capturar output
     → SE approval == 'required':
         → Salvar draft no banco
         → Criar aprovação (Vialum Chat ou web UI)
         → Atualizar subtask ClickUp → 'pending_approval'
         → Atribuir ao assignee
         → PARAR
     → SE approval == 'none':
         → Executar ação (enviar msg, salvar dados)
         → Atualizar subtask → 'done'

   SE runtime == 'langchain':
     → Chamar chain com prompt fixo + dados estruturados
     → Mesmo fluxo de approval que squad

   SE runtime == 'script':
     → Executar função/API call diretamente
     → Atualizar subtask → 'done'
     → SE wait_for == 'client':
         → Atualizar subtask → 'waiting_client'
         → Agendar follow-ups
         → PARAR

4. SE step tem gate: true E status == 'done':
   → Mover card ClickUp para próximo status (próximo stage)
   → Log no comentário do card

5. Salvar estado no banco (task_workflows.stage, task_workflows.context)
```


---

## 4. Fluxo de aprovação (HITL)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Engine     │    │  Operador    │    │   Cliente    │
│              │    │              │    │              │
│ Squad prepara│    │              │    │              │
│ mensagem     │    │              │    │              │
│      │       │    │              │    │              │
│      ▼       │    │              │    │              │
│ Salva draft  │───→│ Recebe notif │    │              │
│ no banco     │    │ (ClickUp +   │    │              │
│              │    │  WhatsApp)   │    │              │
│ Subtask →    │    │              │    │              │
│ pending_     │    │      │       │    │              │
│ approval     │    │      ▼       │    │              │
│              │    │ Abre draft   │    │              │
│              │    │ Lê, edita    │    │              │
│              │    │      │       │    │              │
│              │    │      ▼       │    │              │
│              │    │ [APROVAR]    │    │              │
│              │    │ [EDITAR]     │    │              │
│              │    │ [REJEITAR]   │    │              │
│              │    │      │       │    │              │
│              │◄───│ Decisão      │    │              │
│      │       │    │              │    │              │
│      ▼       │    │              │    │              │
│ Sistema envia│───────────────────────→│ Recebe msg   │
│ via WhatsApp │    │              │    │              │
│              │    │              │    │              │
│ Subtask →    │    │              │    │              │
│ waiting_     │    │              │    │              │
│ client       │    │              │    │              │
│              │    │              │    │              │
│ (D+1: follow │    │              │    │              │
│  up automát.)│    │              │    │              │
│              │    │              │    │ Responde     │
│              │◄───────────────────────│              │
│      │       │    │              │    │              │
│      ▼       │    │              │    │              │
│ Próximo step │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Onde o operador aprova

Duas opções (podem coexistir):

**Opção A: No próprio Vialum Chat (recomendado pra v1)**

* Engine envia draft como mensagem interna (não pro cliente)
* Operador vê no Vialum Chat: "IA quer enviar isso para o cliente: \[mensagem\]. Aprovar / Editar / Rejeitar"
* Operador clica ou responde
* Simples, já tem a infra

**Opção B: Web UI dedicada (Vialum Tasks Web)**

* Dashboard com fila de aprovações
* Filtro por assignee, stage, workflow
* Preview da mensagem, botões de ação
* Mais completo, mas precisa construir


---

## 5. Métricas do workflow

| Métrica | Total |
|----|----|
| Stages | 8 |
| Tasks | 11 |
| Steps | 47 |
| Steps `executor: ai` | 13 (28%) |
| Steps `executor: human` | 17 (36%) |
| Steps `executor: system` | 17 (36%) |
| Steps `approval: required` | 9 |
| Steps `wait_for: client` | 8 |
| Steps `runtime: squad` (migráveis) | 10 |
| Steps `runtime: script` (já determinísticos) | 20 |
| Steps `runtime: human` | 17 |
| Steps com `migrate_to` definido | 12 |


---

## 6. Plano de cimento (migração progressiva)

### Fase 1: Tudo squad + human (semanas 1-4)

* Engine básico rodando
* Steps de IA executados por squads
* HITL via Vialum Chat (opção A)
* ClickUp como state machine
* Objetivo: 1 workflow completo end-to-end

### Fase 2: Migrar steps estáveis para LangChain (mês 2-3)

* Steps com 20+ aprovações sem edição → migram pra LangChain


* Custo por execução cai de \~$0.10 para \~$0.02
* Candidatos prioritários:
  * Preparar mensagem de qualificação
  * Follow-up de pagamento
  * Mensagem de conclusão

### Fase 3: Migrar steps determinísticos para script (mês 3-4)

* Steps que sempre fazem a mesma coisa → viram script puro
* Custo cai para $0.00
* Candidatos:
  * Interpretação de respostas (regex + NER pra CPF/CNPJ/RG)
  * Classificação de documentos (Classification Hub já faz)
  * Follow-ups (template engine)

### Fase 4: Automação INPI via Playwright (futuro)

* Cadastrar titular → script
* Gerar GRUs → script
* Submeter protocolo → script
* Maior impacto em redução de trabalho humano


---

## 7. TODOs para confirmar com Nicolas

| # | Item | Onde aparece | Impacto |
|----|----|----|----|
| 1 | Preencher termos do usuário | Stage 1, Step 1 | Define se Stage 1 começa com ação humana ou IA |
| 2 | Emitir CNPJ | Stage 3, Step 5 | Pode mudar a ordem dos steps em Assinatura |
| 3 | Gerar documento dos clientes | Stage 4, Step 8 | Pode ser step system se for template |
| 4 | Gera guia de ajuda | Stage 5, Step 2 | Define se é human ou system |
| 5 | Cobrar pagamento (em Assinatura) | Stage 3, Step 4 | Define se é cobrança do contrato ou GRU |


---

*Próximo passo: confirmar TODOs → ajustar YAML → implementar engine loop em vialum-tasks.*