# Task: Protocolo — Definir Escopo do Contrato

> **Comando:** `*escopo`
> **Agente:** @protocolo (Fio)
> **Fase:** 2 de 4 — Definição de Escopo

---

## Purpose

Coletar as informações específicas do serviço contratado: nome da marca a ser registrada,
quantidade ou lista de classes, forma de pagamento e condição de pagamento. Esses dados
complementam os dados do cliente (Fase 1) para completar o JSON de geração de documentos.

---

## Prerequisites

- Fase 1 (`*iniciar`) concluída com sucesso (`coleta_concluida = true`)
- Dados do cliente disponíveis em memória de sessão

---

## Execution Mode

**Interativo** — coleta guiada, com confirmação ao final.

---

## Elicitation Process

### Passo 1: Nome da Marca

```
"Qual é o nome da marca a ser registrada?"
→ Armazenar em: nome_marca
→ Validação: campo obrigatório, não pode estar vazio
```

---

### Passo 2: Classes INPI

```
"Você já sabe quais classes registrar?"

→ Opção A — SIM (classes específicas):
  "Liste os números das classes separados por vírgula."
  Exemplo: "35, 42, 45"
  → Armazenar em: lista_classes (string formatada: "35, 42 e 45")
  → Derivar: qtd_classes = contagem das classes

→ Opção B — NÃO (quantidade apenas):
  "Quantas classes deseja registrar?"
  Exemplo: "2"
  → Armazenar em: qtd_classes (string: "2 (duas)")
  → lista_classes permanece vazia
```

---

### Passo 3: Forma de Pagamento

Exibir menu:

```
Formas de pagamento disponíveis:
  1. Cartão de Crédito (link de pagamento)
  2. PIX — Manual (chave CNPJ Genesis)
  3. PIX — Automático (BR Code / QR Code)
  4. Boleto Bancário — Manual (PDF enviado por e-mail)

"Selecione a forma de pagamento (1-4):"
```

Mapeamento para JSON:
| Escolha | `forma_pagamento` |
|---|---|
| 1 | `cartao` |
| 2 | `pix_manual` |
| 3 | `pix_auto` |
| 4 | `boleto_manual` |

---

### Passo 4: Condição de Pagamento

```
Condições disponíveis:
  1. À vista (pagamento único)
  2. Parcelado (informar número de parcelas)

"Selecione a condição de pagamento (1-2):"
```

Mapeamento:
| Escolha | `condicao_pagamento` | Observação |
|---|---|---|
| 1 | `vista` | — |
| 2 | `parcelado` | Perguntar: "Em quantas vezes?" → `num_parcelas` |

---

### Passo 5: Valor Total

```
"Qual o valor total do contrato? (apenas número, ex: 1500 ou 1.500,00)"
→ Armazenar em: valor_total (formatar como "R$ 1.500,00")
```

---

### Passo 6: Confirmação do Escopo

Exibir resumo:

```
📋 Escopo do Contrato
─────────────────────
Marca:            {nome_marca}
Classes:          {lista_classes ou "X classes"}
Pagamento:        {forma legível}
Condição:         {à vista / parcelado em X vezes}
Valor total:      R$ {valor_total}
─────────────────────
"Confirmar escopo? (s/n)"
```

---

## Implementation Steps

1. Verificar pré-condição: dados do cliente presentes
2. Elicitar nome da marca
3. Elicitar classes (com ou sem lista específica)
4. Elicitar forma de pagamento (menu 1-4)
5. Elicitar condição de pagamento (à vista ou parcelado)
6. Elicitar valor total
7. Montar sufixo do arquivo: `nome_arquivo_suffix` = `{nome_marca}_{razao_social ou nome}`
8. Exibir resumo e pedir confirmação
9. Ao confirmar: registrar `escopo_concluido = true`
10. Sugerir próximo passo: `*gerar`

---

## Validation Checklist

- [ ] `nome_marca` preenchido e não vazio
- [ ] `qtd_classes` ou `lista_classes` definido
- [ ] `forma_pagamento` mapeado para um dos 4 valores válidos
- [ ] `condicao_pagamento` definido (`vista` ou `parcelado`)
- [ ] Se parcelado: `num_parcelas` definido
- [ ] `valor_total` formatado
- [ ] Usuário confirmou o escopo

---

## State Output (sessão — adiciona ao estado da Fase 1)

```json
{
  "nome_marca": "...",
  "qtd_classes": "2 (duas)",
  "lista_classes": "35 e 42",
  "forma_pagamento": "pix_manual",
  "condicao_pagamento": "parcelado",
  "num_parcelas": "3",
  "valor_total": "R$ 2.400,00",
  "nome_arquivo_suffix": "Genesis_Acme",
  "gerar_contrato": true,
  "gerar_procuracao": true,
  "upload_drive": true
}
```

---

## Error Handling

- **Forma de pagamento inválida:** re-exibir menu e aguardar seleção válida
- **Valor com formato errado:** aceitar com ou sem pontuação, normalizar internamente
- **Número de parcelas ausente:** re-solicitar antes de prosseguir

---

## Success Output

```
✅ Escopo definido e confirmado.
🏷️  Marca: {nome_marca} | {X classes} | {forma de pagamento}
➡️  Próximo passo: *gerar (gerar Contrato + Procuração em PDF)
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo
  phase: 2
  next_task: protocolo-gerar-docs.md
  tags: [escopo, marca, inpi, classes, pagamento]
  updated_at: 2026-02-25
```
