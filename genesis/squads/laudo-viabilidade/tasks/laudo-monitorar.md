# Task: Laudo — Monitorar Fila no ClickUp

> **Comando:** `*monitorar` (ou Fase 0 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 0 — Monitoramento

---

## Purpose

Escanear a lista "Fluxo de Laudos" no ClickUp (id: 901324787605), listar todos os cards com
status "para fazer", apresentar ao usuário humano para que ele escolha qual análise iniciar,
e mover o card escolhido para "em processo".

---

## Prerequisites

- API ClickUp acessível (token configurado)
- Lista 901324787605 existe e tem cards em "para fazer"

---

## Execution Mode

**Interativo** — apresenta lista e aguarda escolha do usuário.

---

## Implementation Steps

### Passo 1: Buscar cards em "para fazer"

Usar curl para buscar tasks da lista 901324787605 com status "para fazer":

```bash
curl -s -H "Authorization: {CLICKUP_API_TOKEN}" \
  "https://api.clickup.com/api/v2/list/901324787605/task?statuses[]=para%20fazer&include_closed=false"
```

Extrair de cada task:
- `id` → `task_id`
- `name` → `nome_marca`
- `description` → `descricao` (pode conter atividade do cliente)

---

### Passo 2: Apresentar lista ao usuário

SE nenhum card encontrado:
```
⚖️ Mira — Fila limpa.
Não há laudos aguardando em "para fazer". Nada a fazer por ora.
```
PARAR.

SE há cards:
```
⚖️ Mira — Laudos aguardando análise:

{n} laudo(s) na fila "para fazer":

  [1] {nome_marca_1}  (id: {task_id_1})
  [2] {nome_marca_2}  (id: {task_id_2})
  ...

Qual você deseja iniciar? (informe o número ou o task_id)
```

**AGUARDAR** escolha do usuário.

---

### Passo 3: Mover card para "em processo"

Após o usuário escolher:

```bash
curl -s -X PUT \
  -H "Authorization: {CLICKUP_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "em processo"}' \
  "https://api.clickup.com/api/v2/task/{task_id}"
```

Verificar resposta: status retornado deve ser "em processo".

---

### Passo 4: Confirmar e retornar

```
✅ Laudo iniciado: {nome_marca}
Card movido para "em processo".

➡️ Prosseguindo com *coletar...
```

Retornar para o workflow:
```json
{"task_id": "...", "nome_marca": "..."}
```

---

## Veto Conditions

- **API ClickUp inacessível:** VETO — "Não consigo acessar o ClickUp. Verifique o token e a conexão."
- **Usuário informa task_id inválido:** Solicitar novamente.

---

## Success Output

```
✅ Monitoramento concluído.
   Marca:   {nome_marca}
   Task ID: {task_id}
   Status:  em processo

➡️ Iniciando coleta de dados...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phase: 0
  clickup_list_id: "901324787605"
  status_lido: "para fazer"
  status_escrito: "em processo"
  next_task: laudo-coletar.md
  tags: [monitorar, clickup, fila, laudo]
  updated_at: 2026-02-27
```
