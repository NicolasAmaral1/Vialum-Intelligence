
---

## name: contrato-procuracao
version: 2.0.0
description: Workflow completo de geração de Contrato e Procuração para clientes Genesis a partir do ClickUp
agent: protocolo
squad: protocolo-v2

# Workflow: Contrato e Procuração Genesis v2

Orquestra o fluxo completo de 4 fases: desde a detecção automática de cards no ClickUp
até o upload dos documentos e a movimentação do card para o próximo status.


---

## Visão Geral do Fluxo

```
┌────────────────────────────────────────────────────────────────────────┐
│                  WORKFLOW: CONTRATO + PROCURAÇÃO v2                     │
├──────────────┬─────────────────┬──────────────────┬────────────────────┤
│   FASE 0     │    FASE 1       │     FASE 2       │       FASE 3       │
│              │                 │                  │                    │
│  Monitorar   │   Validar       │   Gerar PDFs     │  Finalizar         │
│  ClickUp     │   Dados         │   (Python)       │  no ClickUp        │
│              │                 │                  │                    │
│ *monitorar   │  *validar       │   *gerar         │  *finalizar        │
└──────────────┴─────────────────┴──────────────────┴────────────────────┘
         ↓             ↓                  ↓                  ↓
   Lista cards    Valida campos       Executa           Upload PDFs
   pendentes      + description       script Python      no card
                  Detecta PF/PJ       Gera 2 PDFs        Comenta no card
                  Smart-detect        Upload Drive        Move → próximo
                  classes             (automático)        status
```


---

## Ativação via CLI

```bash
# Processar todos os cards pendentes
claude -p "@protocolo *processar" --dangerously-skip-permissions

# Processar um card específico diretamente
claude -p "@protocolo *processar TASK_ID" --dangerously-skip-permissions

# Apenas verificar fila (sem processar)
claude -p "@protocolo *monitorar" --dangerously-skip-permissions
```


---

## Fase 0: Monitorar ClickUp

**Task:** `protocolo-monitorar.md`
**Comando:** `*monitorar`
**Objetivo:** Verificar na lista Protocolo (901322069698) quais cards estão no
status `"contrato + proc"` aguardando processamento.

**MCP usado:** ClickUp — buscar tasks por lista e status

**Resultado:** Lista de `task_id` + `nome_marca` para processar

**Saída da sessão:** `cards_pendentes[]`, `monitoramento_concluido = true`


---

## Fase 1: Validar Dados

**Task:** `protocolo-validar.md`
**Comando:** `*validar {task_id}`
**Objetivo:** Para cada card, ler todos os campos e verificar se estão completos.

**MCP usado:** ClickUp — `get_task(task_id)` para ler campos e description

**Validações realizadas:**

* Campos customizados: valor, forma de pagamento, classes, parcelas
* Description: qualificação completa (CPF → PF / CNPJ → PJ)
* Smart-detect de classes (quantidade vs lista específica)
* Normalização do JSON para o script

**SE inválido:**

* Comentar no card via MCP com o que está faltando
* Pular este card (não bloqueia os demais)

**Saída da sessão:** `dados_validados{}`, `valido = true`


---

## Fase 2: Gerar Documentos

**Task:** `protocolo-gerar.md`
**Comando:** `*gerar`
**Objetivo:** Executar o script Python e gerar ambos os PDFs.

**Execução:**

```bash
cd genesis/outputs/protocolo-v2 && \
  python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON>'
```

**Documentos sempre gerados (os dois):**

* `Contrato_{sfx}.pdf` — Contrato de Serviços
* `Procuracao_{sfx}.pdf` — Instrumento de Procuração/Mandato

**O script aplica automaticamente:**

* Qualificação jurídica (CONTRATANTE + CONTRATADO Genesis)
* Cláusula de classes (quantidade ou lista específica)
* Cláusula de pagamento (cartão, PIX manual/auto, boleto manual/auto)
* Cláusula de condição (à vista ou parcelado)
* Assinatura adequada (PF ou representante legal da PJ)
* Header com logo Genesis + footer com endereço

**Upload Google Drive:** automático pelo script (pasta: `Clientes/{marca} - {cliente}/`)

**Saída da sessão:** `pdf_contrato`, `pdf_procuracao`, `geracao_concluida = true`


---

## Fase 3: Finalizar no ClickUp

**Task:** `protocolo-finalizar.md`
**Comando:** `*finalizar`
**Objetivo:** Entregar os documentos no ClickUp e avançar o card no fluxo.

**MCP usado:** ClickUp:

* Upload dos PDFs como anexos no card
* Criação de comentário no card
* Atualização do status do card

**Ações:**


1. Anexar `Contrato_{sfx}.pdf` ao card
2. Anexar `Procuracao_{sfx}.pdf` ao card
3. Comentar: "✅ Contrato e Procuração gerados e prontos para revisão."
4. Mover card: `"contrato + proc"` → `"pagamento & assinatura"`

**Saída da sessão:** `processamento_concluido = true`


---

## Estado da Sessão (controle de progresso)

```yaml
session:
  # Fase 0
  cards_pendentes: []
  total_pendentes: 0
  monitoramento_concluido: false

  # Fase 1 (por card)
  task_id: ""
  nome_marca: ""
  valido: false
  dados_validados: {}

  # Fase 2
  pdf_contrato: ""
  pdf_procuracao: ""
  drive_upload: ""
  geracao_concluida: false

  # Fase 3
  upload_clickup_contrato: false
  upload_clickup_procuracao: false
  comentario_adicionado: false
  status_atualizado: ""
  processamento_concluido: false
```


---

## Fluxo de decisão para múltiplos cards

```
*processar (sem args)
    ↓
  FASE 0: monitorar → encontra N cards
    ↓
  PARA CADA card em cards_pendentes:
    ├── FASE 1: validar
    │     SE inválido → comentar no card + PRÓXIMO card
    │     SE válido → continuar
    │         ↓
    ├── FASE 2: gerar
    │         ↓
    └── FASE 3: finalizar
          ↓
    LOG: "✅ {nome_marca} processado"
    ↓
  RESUMO FINAL:
    {N} cards processados com sucesso
    {M} cards com dados incompletos (comentários adicionados)
```


---

## Roadmap de melhorias futuras

* **HITL (Human In The Loop):** revisão visual dos PDFs antes do upload
* **Batch inteligente:** processar apenas cards sem comentário de erro recente
* **Notificação:** enviar WhatsApp/email ao cliente após geração
* **Preview no ClickUp:** geração de miniatura do PDF no card


---

```yaml
metadata:
  version: 2.0.0
  squad: protocolo-v2
  phases: 4
  documents: [contrato, procuracao]
  payment_methods: [cartao, pix_manual, pix_auto, boleto_manual, boleto_auto]
  output_dir: genesis/outputs/protocolo-v2/
  clickup_list_id: "901322069698"
  clickup_status_entrada: "contrato + proc"
  clickup_status_saida: "pagamento & assinatura"
  updated_at: 2026-02-26
```


