# Task: Protocolo — Monitorar ClickUp

> **Comando:** `*monitorar`
> **Agente:** @protocolo (Fio)
> **Fase:** 0 — Monitoramento de Fila

---

## Purpose

Consultar a lista **Protocolo** no ClickUp (list_id: `901322069698`) e identificar
todos os cards que estão no status `"contrato + proc"` aguardando processamento.

---

## Prerequisites

- MCP ClickUp disponível e autenticado (`@h100/clickup-mcp`)
- @protocolo ativo na sessão

---

## Execution Mode

**Automático** — consulta a API, exibe a lista e aguarda a decisão do usuário.

---

## Implementation Steps

### Passo 1: Consultar a lista ClickUp

Usar a ferramenta MCP ClickUp para buscar tasks na lista `901322069658` filtradas
pelo status `"contrato + proc"`.

Parâmetros da consulta:
- `list_id`: `901322069698`
- `status`: `"contrato + proc"`
- Campos a recuperar: `id`, `name`, `description`, `custom_fields`, `status`

---

### Passo 2: Para cada card encontrado, extrair

| Campo | Fonte | Observação |
|---|---|---|
| `task_id` | `id` | ID único do card |
| `nome_marca` | `name` | Nome do card = nome da marca |
| `valor` | custom field `d660b997` | Valor total do contrato |
| `forma_pagamento` | custom field `c833a0a0` | Forma de pagamento |
| `classes` | custom field `28f75c34` | Classes ou quantidade |

---

### Passo 3: Exibir resultado

**Se nenhum card encontrado:**
```
✅ Nenhum card pendente em "contrato + proc". Fila vazia.
```

**Se encontrar cards:**
```
📋 {N} card(s) aguardando processamento em "contrato + proc":

   1. [{task_id}] {NOME_MARCA} — R$ {VALOR} — {FORMA_PAGAMENTO}
   2. [{task_id}] {NOME_MARCA} — R$ {VALOR} — {FORMA_PAGAMENTO}
   ...

Use *processar para processar todos, ou *processar {task_id} para um específico.
```

---

### Passo 4: Registrar na sessão

```json
{
  "cards_pendentes": [
    {"task_id": "abc123", "nome_marca": "NOME DA MARCA", "valor": "1500.00", "forma_pagamento": "PIX Manual"},
    ...
  ],
  "total_pendentes": N,
  "monitoramento_concluido": true
}
```

---

## Veto Conditions

- **MCP ClickUp indisponível ou erro de autenticação:**
  VETO — "MCP ClickUp não está respondendo. Verifique a configuração em
  `genesis/.claude/mcp.json` e se a API Key está válida."

- **List ID não encontrada:**
  VETO — "Lista `901322069698` não encontrada. Verifique o list_id no ClickUp."

---

## Error Handling

- **Timeout na consulta:** tentar uma vez mais; se persistir, reportar ao usuário
- **Custom field ausente no card:** ignorar na preview, não é bloqueante aqui (a validação trata isso)

---

## Success Output

```
📋 {N} card(s) aguardando processamento.
➡️  Use *processar para iniciar o fluxo completo.
    Ou *processar {task_id} para processar um card específico.
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo-v2
  phase: 0
  clickup_list_id: "901322069698"
  target_status: "contrato + proc"
  next_task: protocolo-validar.md
  tags: [monitorar, clickup, fila, scan]
  updated_at: 2026-02-26
```
