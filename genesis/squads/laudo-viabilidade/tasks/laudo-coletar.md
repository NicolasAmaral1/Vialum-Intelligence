# Task: Laudo — Coletar Dados do Card

> **Comando:** `*coletar {task_id}` (ou Fase 1 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 1 — Coleta de Dados

---

## Purpose

Ler o card do ClickUp escolhido, extrair ou coletar os dados necessários para a análise
(marca, cliente, atividade), e criar a estrutura de pastas em `laudos/`.

---

## Prerequisites

- `task_id` disponível (da sessão ou passado como argumento)
- Card está em status "em processo"

---

## Execution Mode

**Semi-interativo** — lê o card automaticamente; pede complemento ao usuário somente se dados essenciais estiverem ausentes.

---

## Implementation Steps

### Passo 1: Ler o card no ClickUp

```bash
curl -s -H "Authorization: {CLICKUP_API_TOKEN}" \
  "https://api.clickup.com/api/v2/task/{task_id}?include_subtasks=false"
```

Extrair:
- `name` → `nome_marca` (nome do card = nome da marca)
- `description` → texto livre com dados do cliente (atividade, nome do cliente, etc.)

---

### Passo 2: Extrair dados da description

Analisar o texto da description para identificar:

| Campo | Marcadores comuns | Obrigatório |
|---|---|---|
| Nome do cliente | "Cliente:", "Empresa:", "Solicitante:" | ✅ |
| Atividade | "Atividade:", "Negócio:", "Serviços:", "Produtos:" | ✅ |
| Marcas alternativas | "Alternativas:", "Variações:", "Também:" | ❌ |

**Regra de nomeação:**
SE cliente não informado → usar `Equipe {nome_marca}` (ex: "Equipe Frescor do Mar")

---

### Passo 3: Complementar dados ausentes (se necessário)

SE `atividade` não encontrada na description:

```
⚖️ Mira — Para prosseguir com a análise de {nome_marca}, preciso de mais detalhes.

Por favor, descreva:
1. A atividade principal do negócio
2. Produtos ou serviços que serão oferecidos sob essa marca
3. Público-alvo (opcional, mas ajuda na análise de colidências)
```

**AGUARDAR** resposta do usuário.

---

### Passo 4: Criar estrutura de pastas

```bash
mkdir -p "laudos/{cliente}/{nome_marca}"
```

Normalizar nomes de pasta:
- Remover caracteres especiais problemáticos para bash: `/ \ : * ? " < > |`
- Manter acentos e espaços (são válidos em paths macOS)

Criar também o arquivo vazio para dados INPI (para uso na Fase 3):
```bash
touch "laudos/{cliente}/{nome_marca}/inpi-raw.txt"
```

---

### Passo 5: Confirmar e retornar

Exibir resumo:

```
✅ Dados coletados para análise.

📋 Resumo:
   Marca:      {nome_marca}
   Alternativas: {alternativos ou "nenhuma"}
   Cliente:    {cliente}
   Atividade:  {atividade resumida}

   Pasta criada: laudos/{cliente}/{nome_marca}/

➡️ Iniciando análise preliminar (PARTE 1)...
```

Retornar para o workflow:
```json
{
  "task_id": "...",
  "nome_marca": "...",
  "alternativos": "...",
  "cliente": "...",
  "atividade": "...",
  "pasta": "laudos/{cliente}/{nome_marca}/"
}
```

---

## Veto Conditions

- **Card não encontrado no ClickUp:** VETO — "Task {task_id} não encontrada."
- **Marca em branco (name do card vazio):** VETO — impossível continuar sem o nome da marca.

---

## Success Output

```
✅ Coleta concluída — {nome_marca}
   Cliente:   {cliente}
   Pasta:     laudos/{cliente}/{nome_marca}/
➡️ Prosseguindo com *preliminar...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phase: 1
  next_task: laudo-preliminar.md
  tags: [coletar, dados, clickup, pasta, marca]
  updated_at: 2026-02-27
```
