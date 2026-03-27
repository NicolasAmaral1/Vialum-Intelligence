# Taxonomia do Workflow: Protocolo de Registro de Marca

> **Data:** 2026-03-26
> **Versao:** 3.0
> **Base:** Taxonomia Vialum (Workflow > Stage > Task > Step)
> **Principio:** Step = menor unidade que faz sentido pausar para humano avaliar

---

## Definicao do Workflow

- **Nome:** `protocolo-registro`
- **Inicio:** Cliente sinaliza que quer avancar (vendedor sente que pode gerar contrato)
- **Fim:** Comprovante(s) de protocolo INPI enviado(s) ao cliente
- **Canal com cliente:** WhatsApp (via Vialum Chat)
- **Board de gestao:** ClickUp (Avelum > Genesis > Clientes > Protocolo)

---

## Modelo de Step

Cada step tem 4 atributos:

| Atributo | Valores | Significado |
|----------|---------|-------------|
| `executor` | `ai` / `human` / `system` | Quem prepara/executa a acao |
| `approval` | `required` / `none` | Precisa de aprovacao humana antes de efetivar? |
| `wait_for` | `client` / `null` | Apos executar, workflow pausa esperando alguem? |
| `assignee` | papel no time | Quem no time e responsavel por esse step |

### Ciclo de vida dos steps

```
              approval: none                    approval: required
              ────────────                      ──────────────────
system  →  pending → done                      (system nao precisa approval)

ai      →  pending → preparing → done          pending → preparing → pending_approval → done
                                                                   ↓ rejected → preparing

human   →  pending → in_progress → done        (human nao precisa approval — ele e o aprovador)

wait_for: client  →  ...done → waiting_client → received (ou timeout → follow_up)
```

### Regra de ouro

> **Todo step que envia algo para o cliente via WhatsApp tem `approval: required`.**
> IA prepara → humano aprova/edita → sistema envia → espera cliente.

---

## Papeis no time (assignees)

| Papel | Quem | O que faz |
|-------|------|-----------|
| `operador` | contato@avelumia.com | Revisao, aprovacao, trabalho manual (INPI, estrategia) |
| `analista` | (definir) | Analise estrategica de pre-protocolo, deposito |
| `financeiro` | (definir) | Validacao de pagamentos |
| `ai` | Vialum Tasks engine | Preparacao de mensagens, classificacao, extracao |
| `system` | Vialum Tasks engine | Automacoes deterministicas (upload, mover card, gerar PDF) |

> **Nota:** ClickUp resolve a delegacao nativamente — cada sub-subtask tem seu proprio assignee. O Vialum Tasks engine atribui automaticamente com base no `assignee` definido no workflow. Nao precisa de sistema novo.

---

# PARTE 1 — CLICKUP

## Status (colunas do board)

| # | Status ClickUp | Mapa para Stage |
|---|----------------|-----------------|
| 1 | `qualificacao` | Stage 1 |
| 2 | `contrato e procuracao` | Stage 2 |
| 3 | `aguardando assinatura` | Stage 3 |
| 4 | `documentos` | Stage 4 |
| 5 | `cadastro e gru` | Stage 5 |
| 6 | `pagamento gru` | Stage 6 |
| 7 | `pre-protocolo` | Stage 7 |
| 8 | `protocolo` | Stage 8 |
| 9 | `completo` | Fim |
| 10 | `cancelado` | Abortado |

## Estrutura no ClickUp

```
Card (= 1 marca de 1 cliente)
├── Status do card = Stage atual
├── Custom fields = dados do caso
├── Subtask = Stage (com nome do stage)
│   ├── Sub-subtask = Step (com assignee + status proprio)
│   │   Status da sub-subtask = estado do step:
│   │     pending / preparing / pending_approval / sent / waiting_client / done
│   └── ...
└── Comentarios = log de tudo
```

## Custom Fields do card

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Marca | Texto | Nome da marca (= nome do card) |
| Cliente | Texto | Nome do contratante |
| Tipo Pessoa | Dropdown | PF / PJ |
| Classes NCL | Texto | Ex: "35, 42" |
| Valor Contrato | Moeda | R$ total |
| Forma Pagamento | Dropdown | cartao / pix / boleto |
| Parcelas | Numero | Qtd |
| Deal ID | Texto | Link ao deal Pipedrive |
| Conversation ID | Texto | ID conversa Vialum Chat |
| Pasta Drive | URL | Link Google Drive |
| Protocolo(s) INPI | Texto | Numero(s) apos protocolar |

---

# PARTE 2 — STAGES E STEPS (com executor, approval, wait_for, assignee)

---

## STAGE 1: Qualificacao

**ClickUp status:** `qualificacao`
**Objetivo:** Obter todos os dados do cliente para confeccionar contrato e procuracao.

### Task 1.1: Coletar dados do cliente

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Preencher termos do usuario | `human` | none | null | operador | ⚠️ *Confirmar: o que e isso exatamente?* |
| 2 | Preparar mensagem de qualificacao | `ai` | **required** | null | operador (aprova) | IA monta mensagem pedindo: PF/PJ, nome, CPF/CNPJ, RG, nacionalidade, estado civil, profissao, endereco, email |
| 3 | Enviar mensagem no WhatsApp | `system` | none | **client** | — | Vialum Chat envia. Workflow pausa. Follow-up D+1, D+3. |
| 4 | Interpretar respostas do cliente | `ai` | none | null | — | IA le mensagens, extrai dados, identifica o que falta |
| 5 | Pedir dados faltantes (se necessario) | `ai` | **required** | **client** | operador (aprova) | IA prepara msg pedindo o que faltou. Humano aprova. Loop ate completar. |
| 6 | Consolidar dados no ClickUp | `system` | none | null | — | Cria/atualiza card com dados na descricao + custom fields |
| 7 | Revisar dados do card | `human` | none | null | operador | Operador confere se tudo esta correto. Se errado, corrige. |

**Avanca quando:** Operador marca Step 7 como done → card move para `contrato e procuracao`.

---

## STAGE 2: Contrato e Procuracao

**ClickUp status:** `contrato e procuracao`
**Objetivo:** Gerar contrato + procuracao e enviar ao cliente.

### Task 2.1: Confeccionar documentos

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Montar dados para geracao | `system` | none | null | — | Monta JSON a partir dos dados do card ClickUp |
| 2 | Gerar PDFs (contrato + procuracao) | `system` | none | null | — | Executa assemble_contract.py |
| 3 | Revisar documentos | `human` | none | null | operador | Abre PDFs, confere nome, CPF/CNPJ, marca, classes, valores |
| 4 | Upload no Drive + ClickUp | `system` | none | null | — | Salva na pasta do cliente, atualiza links no card |

### Task 2.2: Enviar ao cliente para assinatura

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Preparar mensagem de envio | `ai` | **required** | null | operador (aprova) | IA monta mensagem explicando que precisa assinar e devolver |
| 2 | Enviar docs via WhatsApp | `system` | none | **client** | — | Envia PDFs. Workflow pausa. Follow-up D+1, D+3. |

**Avanca quando:** Docs enviados → card move para `aguardando assinatura`.

---

## STAGE 3: Aguardando Assinatura

**ClickUp status:** `aguardando assinatura`
**Objetivo:** Confirmar que cliente assinou contrato e procuracao.

### Task 3.1: Obter documentos assinados

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Aguardar devolucao assinada | `system` | none | **client** | — | Monitora conversa. Follow-up automatico. |
| 2 | Detectar documento assinado | `ai` | none | null | — | Classification Hub identifica se media recebida e doc assinado |
| 3 | Validar assinatura | `human` | none | null | operador | Confere se contrato e procuracao estao assinados nos locais corretos |
| 4 | Cobrar pagamento (contrato) | `human` | none | null | financeiro | ⚠️ *Confirmar: e cobranca do valor do contrato? Ou e cobranca de GRU?* |
| 5 | Emitir CNPJ | `human` | none | null | operador | ⚠️ *Confirmar: o que e isso? Cadastro de CNPJ no INPI? Emissao de cartao CNPJ?* |
| 6 | Anexar docs assinados no card | `system` | none | null | — | Salva no Drive + ClickUp |

**Avanca quando:** Assinatura validada + cobranca + CNPJ → card move para `documentos`.

---

## STAGE 4: Documentos do Cliente

**ClickUp status:** `documentos`
**Objetivo:** Coletar documentos pessoais para cadastro no INPI.

**Documentos necessarios:**
- **PF:** RG + CPF (ou CIN, ou CNH) + Comprovante de residencia
- **PJ:** + Contrato social ou ultimo aditivo + Cartao CNPJ

### Task 4.1: Coletar e validar documentos

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Preparar mensagem solicitando docs | `ai` | **required** | null | operador (aprova) | IA monta lista de docs necessarios conforme PF/PJ |
| 2 | Enviar solicitacao via WhatsApp | `system` | none | **client** | — | Envia. Workflow pausa. Follow-up automatico. |
| 3 | Classificar documento recebido | `ai` | none | null | — | A cada media: Classification Hub identifica tipo (RG, CPF, CNH, etc.) |
| 4 | Verificar legibilidade e completude | `human` | none | null | operador | Confere se doc esta legivel, completo, nao cortado |
| 5 | Pedir reenvio se necessario | `ai` | **required** | **client** | operador (aprova) | Se doc ruim, IA prepara msg. Humano aprova. Loop. |
| 6 | Verificar se todos foram recebidos | `system` | none | null | — | Compara lista necessaria vs recebida. Se falta, volta ao Step 1. |
| 7 | Anexar tudo no ClickUp | `system` | none | null | — | Anexa com labels de tipo |
| 8 | Gerar documento dos clientes | `human` | none | null | operador | ⚠️ *Confirmar: que documento e esse? Ficha cadastral? Dossiê?* |

**Avanca quando:** Todos os docs OK → card move para `cadastro e gru`.

---

## STAGE 5: Cadastro INPI e GRU

**ClickUp status:** `cadastro e gru`
**Objetivo:** Cadastrar cliente no e-INPI e gerar GRUs.

### Task 5.1: Cadastrar no INPI

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Cadastrar titular no e-INPI | `human` | none | null | operador | Acessa e-INPI, cadastra cliente como titular. Manual. |

### Task 5.2: Gerar e enviar GRUs

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Gerar GRUs no sistema INPI | `human` | none | null | operador | Gera GRU por classe. Registra numeros e valores. |
| 2 | Gerar guia de ajuda | `human` | none | null | operador | ⚠️ *Confirmar: e um guia/tutorial pro cliente saber como pagar? Ou e a propria GRU?* |
| 3 | Anexar GRUs no card | `system` | none | null | — | Salva PDFs no card ClickUp |
| 4 | Preparar mensagem com GRUs | `ai` | **required** | null | operador (aprova) | IA monta msg com instrucoes de pagamento |
| 5 | Enviar GRUs via WhatsApp | `system` | none | **client** | — | Envia. Workflow pausa. |

**Avanca quando:** GRUs enviadas → card move para `pagamento gru`.

---

## STAGE 6: Pagamento das GRUs

**ClickUp status:** `pagamento gru`
**Objetivo:** Confirmar que cliente pagou todas as GRUs.

### Task 6.1: Acompanhar e confirmar pagamento

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Follow-up de pagamento | `ai` | **required** | **client** | operador (aprova) | Lembrete D+1, D+3, D+5 (skip weekends). IA prepara, humano aprova cada msg. |
| 2 | Detectar comprovante | `ai` | none | null | — | Classification Hub verifica se media recebida e comprovante de pgto |
| 3 | Validar comprovante | `human` | none | null | financeiro | Confere valor, GRU correta, data, destinatario (CNPJ Genesis). Se multiplas GRUs, confere todas. |

**Avanca quando:** Todas as GRUs pagas e validadas → card move para `pre-protocolo`.

---

## STAGE 7: Pre-Protocolo (Estrategia)

**ClickUp status:** `pre-protocolo`
**Objetivo:** Definir estrategia de deposito e obter aceite do cliente.

**Este e o stage mais "intelectual" e pode levar dias/semanas.**

### Task 7.1: Definir estrategia e obter aceite

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Analisar estrategia de deposito | `human` | none | null | analista | Define: nome(s) exato(s), classes NCL com especificacoes, tipo de marca (mista/nominativa/figurativa), quantidade de depositos |
| 2 | Montar proposta de deposito | `human` | none | null | analista | Prepara documento detalhando depositos, nomes, classes, custos |
| 3 | Preparar mensagem com proposta | `ai` | **required** | null | operador (aprova) | IA formata proposta pra envio |
| 4 | Enviar proposta via WhatsApp/grupo | `system` | none | **client** | — | Envia. Workflow pausa esperando aceite. |
| 5 | Aguardar aceite do cliente | `system` | none | **client** | — | Monitora resposta. Cliente pode: aprovar, pedir ajustes, ter duvidas. |
| 6 | Ajustar estrategia se necessario | `human` | none | null | analista | Se cliente nao concordou, refaz analise. **Loop → volta ao Step 2.** |
| 7 | Registrar aceite final | `system` | none | null | — | Marca no card que estrategia foi aprovada. Registra nomes e classes finais. |

**Avanca quando:** Aceite final registrado → card move para `protocolo`.

---

## STAGE 8: Protocolo INPI

**ClickUp status:** `protocolo`
**Objetivo:** Efetuar protocolo(s) e enviar comprovantes.

### Task 8.1: Efetuar protocolo(s)

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Checar documentacao completa | `system` | none | null | — | Verifica se todos os pre-requisitos estao atendidos (docs, GRUs pagas, aceite) |
| 2 | Submeter pedido(s) no e-INPI | `human` | none | null | operador | Preenche formulario no e-INPI. Pode ser mais de 1 deposito. |
| 3 | Registrar numero(s) de protocolo | `system` | none | null | — | Atualiza campo "Protocolo(s) INPI" no card |

### Task 8.2: Enviar comprovantes ao cliente

| # | Step | Executor | Approval | Wait for | Assignee | Detalhe |
|---|------|----------|----------|----------|----------|---------|
| 1 | Salvar comprovantes | `system` | none | null | — | Upload no Drive + anexa no card |
| 2 | Preparar mensagem de conclusao | `ai` | **required** | null | operador (aprova) | IA monta msg: "Sua marca foi protocolada! Numero(s): XXX" |
| 3 | Enviar comprovantes via WhatsApp | `system` | none | null | — | Envia ao cliente |
| 4 | Mover card para completo | `system` | none | null | — | **FIM DO WORKFLOW** |

---

# PARTE 3 — RESUMO E METRICAS

## Quantitativo

| Metrica | Valor |
|---------|-------|
| **Stages** | 8 (+completo +cancelado) |
| **Tasks** | 11 |
| **Steps totais** | 44 |

## Distribuicao por executor

| Executor | Steps | % |
|----------|-------|---|
| `ai` | 12 | 27% |
| `human` | 16 | 36% |
| `system` | 16 | 36% |

## Distribuicao por approval

| Approval | Steps | Quais |
|----------|-------|-------|
| `required` | **9** | Toda mensagem pro cliente + follow-ups |
| `none` | 35 | O resto |

## Distribuicao por wait_for

| Wait for | Steps | Significado |
|----------|-------|-------------|
| `client` | **8** | Workflow pausa, follow-up ativo |
| `null` | 36 | Continua automaticamente |

## Steps que precisam de HITL (approval: required)

| Step | Stage | O que a IA prepara | O que o humano faz |
|------|-------|-------------------|-------------------|
| Msg de qualificacao | 1 | Mensagem pedindo dados | Revisa texto, aprova/edita |
| Pedir dados faltantes | 1 | Mensagem pedindo o que faltou | Revisa, aprova/edita |
| Msg de envio de docs | 2 | Mensagem com contrato/procuracao | Revisa, aprova |
| Msg solicitando docs pessoais | 4 | Lista de documentos necessarios | Revisa, aprova |
| Msg pedindo reenvio de doc | 4 | Explicacao do problema + pedido | Revisa, aprova |
| Msg com GRUs | 5 | Instrucoes de pagamento | Revisa, aprova |
| Follow-up de pagamento | 6 | Lembrete amigavel | Revisa, aprova |
| Msg com proposta de deposito | 7 | Proposta formatada | Revisa, aprova |
| Msg de conclusao | 8 | "Marca protocolada! Numero: XXX" | Revisa, aprova |

## Delegacao no ClickUp

| Assignee | Stages onde atua | Tipo de trabalho |
|----------|-----------------|-----------------|
| operador | 1, 2, 3, 4, 5, 8 | Revisao, aprovacao de msgs, trabalho manual INPI |
| analista | 7 | Estrategia de deposito, proposta |
| financeiro | 3, 6 | Validacao de pagamentos |
| ai/system | todos | Preparacao, automacao, classificacao |

> **No ClickUp:** Cada sub-subtask (step) recebe o assignee automaticamente via Vialum Tasks engine. Operador ve na lista dele so os steps que precisa atuar. ClickUp filtra por assignee nativamente (view "My Tasks").

---

# PARTE 4 — ESTADOS NO CLICKUP POR STEP

## Como rastrear o estado de cada step

Cada sub-subtask (step) no ClickUp usa o **status da propria subtask** pra indicar em que ponto esta:

| Estado | Cor sugerida | Significado |
|--------|-------------|-------------|
| `pending` | Cinza | Na fila, ainda nao comecou |
| `preparing` | Azul | IA/humano trabalhando |
| `pending_approval` | Amarelo | **Bola com humano pra aprovar/editar** |
| `sent` | Verde claro | Executado/enviado |
| `waiting_client` | Roxo | **Bola com o cliente** |
| `done` | Verde | Concluido |
| `rejected` | Vermelho | Humano rejeitou, voltou pra preparing |

### Exemplo visual

```
QUALIFICACAO
├── Preencher termos             ✅ done           @operador
├── Preparar msg qualificacao    🟡 pending_approval  @operador ← PRECISA AGIR
├── Enviar msg WhatsApp          ⚪ pending
├── Interpretar respostas        ⚪ pending
├── Pedir dados faltantes        ⚪ pending
├── Consolidar no ClickUp        ⚪ pending
└── Revisar dados                ⚪ pending         @operador
```

Operador abre ClickUp, filtra "My Tasks" com status `pending_approval` → ve tudo que precisa aprovar. Simples.

---

# PARTE 5 — ITEMS A CONFIRMAR

Os seguintes steps foram puxados do seu card TESTE mas nao tenho certeza do significado:

| # | Step (como esta no ClickUp) | Minha interpretacao | Confirmar |
|---|---------------------------|---------------------|-----------|
| 1 | Preencher termos do usuario | Preenchimento de algum formulario interno antes de iniciar? | O que e? |
| 2 | Emitir CNPJ | Cadastrar CNPJ do cliente no sistema do INPI? | O que e? |
| 3 | Gerar documento dos clientes | Gerar ficha cadastral / dossiê do cliente? | O que e? |
| 4 | Gera guia de ajuda | Tutorial pro cliente saber como pagar a GRU? Ou e a propria GRU? | O que e? |
| 5 | Cobrar pagamento (em Assinatura) | Cobranca do contrato? Ou da GRU? Ou ambos? | Quando acontece? |

---

*Versao 3.0 — Proximo passo: confirmar items acima, depois implementar como definition YAML no Vialum Tasks engine.*
