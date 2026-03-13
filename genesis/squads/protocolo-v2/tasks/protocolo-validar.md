# Task: Protocolo — Validar Dados do Card

> **Comando:** `*validar {task_id}` (ou execução interna via `*processar`)
> **Agente:** @protocolo (Fio)
> **Fase:** 1 — Validação

---

## Purpose

Ler um card específico do ClickUp, verificar se todos os campos obrigatórios estão
presentes e corretamente preenchidos, e produzir um JSON normalizado pronto para uso
no script de geração de documentos.

Se dados estiverem incompletos, comentar diretamente no card com o que falta — sem
prosseguir para geração.

---

## Prerequisites

- `task_id` disponível (da sessão ou passado como argumento)
- MCP ClickUp disponível e autenticado

---

## Execution Mode

**Automático** — lê, analisa e valida sem interação, exceto em ambiguidades críticas.

---

## Implementation Steps

---

### Passo 1: Ler o card no ClickUp

Usar MCP ClickUp para buscar a task pelo `task_id`.

Extrair:
- `name` → `nome_marca`
- `description` → texto livre com a qualificação do cliente
- Custom fields:
  - `d660b997` → `valor_raw` (currency)
  - `c833a0a0` → `forma_pagamento_raw` (texto ou dropdown)
  - `91595fd2` → `parcelas_raw` (ex: "3x", "à vista", "2")
  - `28f75c34` → `classes_campo` (ex: "35, 42", "3", "2 classes")

---

### Passo 2: Validar campos obrigatórios do ClickUp

Verificar se cada campo está preenchido. Registrar o que estiver ausente ou vazio.

| Campo | ID | Obrigatório |
|---|---|---|
| Nome da marca | `name` do card | ✅ |
| Valor | `d660b997` | ✅ |
| Forma de pagamento | `c833a0a0` | ✅ |
| Classes ou quantidade | `28f75c34` | ✅ |
| Parcelas | `91595fd2` | ✅ |

---

### Passo 3: Mapear forma de pagamento

Normalizar o valor do campo `forma_pagamento_raw` para o código aceito pelo script:

| Valor no ClickUp (qualquer variação) | Código do script |
|---|---|
| Cartão, Cartão de Crédito, cartao, link | `cartao` |
| PIX Manual, PIX, pix manual, Pix | `pix_manual` |
| PIX Automático, PIX Auto, pix auto | `pix_auto` |
| Boleto Manual, Boleto, boleto manual | `boleto_manual` |
| Boleto Automático, Boleto Auto, boleto auto | `boleto_auto` |

SE o valor não se encaixar em nenhum padrão conhecido:
- Registrar erro: "Forma de pagamento não reconhecida: '{valor}'. Valores aceitos: Cartão, PIX Manual, PIX Automático, Boleto Manual, Boleto Automático."

---

### Passo 4: Smart-detect de classes

Analisar o campo `classes_campo` com a seguinte lógica:

```
SE contém vírgula, "e" entre números, ou mais de um número alto:
  → tipo = "especifica"
  → lista_classes = números separados por vírgula e "e" no último
    Exemplo: "35, 42, 45" → "35, 42 e 45"
    Exemplo: "35 e 42" → "35 e 42"

SE é um número único >= 11 (é uma classe específica, não uma quantidade):
  → tipo = "especifica"
  → lista_classes = "{numero}"
    Exemplo: "35" → "35"
    Exemplo: "42" → "42"

SE é um número único <= 10 (é uma quantidade de classes):
  → tipo = "quantidade"
  → qtd_classes = "{numero} ({numero_por_extenso})"
    Exemplo: "1" → "1 (uma)"
    Exemplo: "2" → "2 (duas)"
    Exemplo: "3" → "3 (três)"

SE contém a palavra "classes", "classe":
  → extrair o número antes da palavra
  → tipo = "quantidade"
  → qtd_classes = "{numero} ({extenso})"
    Exemplo: "2 classes" → "2 (duas)"
    Exemplo: "3 classes" → "3 (três)"
```

Extenso dos números de 1 a 10:
1=uma, 2=duas, 3=três, 4=quatro, 5=cinco, 6=seis, 7=sete, 8=oito, 9=nove, 10=dez

---

### Passo 5: Determinar condição de pagamento

```
SE parcelas_raw contém "vista", "à vista", "1x", "1":
  → condicao_pagamento = "vista"
  → num_parcelas = null

SENÃO (qualquer outra coisa indicando mais de 1 parcela):
  → condicao_pagamento = "parcelado"
  → num_parcelas = extrair número inteiro
    Exemplo: "3x" → 3
    Exemplo: "6 vezes" → 6
    Exemplo: "parcelado em 12x" → 12
```

---

### Passo 6: Detectar PF ou PJ na description

Buscar padrões na `description`:

- CNPJ: padrão `##.###.###/####-##` ou sequência de 14 dígitos → `tipo_pessoa = "PJ"`
- CPF: padrão `###.###.###-##` ou sequência de 11 dígitos (sem CNPJ) → `tipo_pessoa = "PF"`
- Nenhum encontrado → registrar erro: "Qualificação não encontrada na descrição do card. Insira os dados do cliente (CPF ou CNPJ) na descrição."

---

### Passo 7: Extrair campos da description

Usar análise de texto para extrair campos da `description`. Os campos podem estar em
formato `Campo: Valor` (label + dois pontos) ou em texto corrido.

**Se PF — campos obrigatórios:**

| Campo | Chave JSON | Marcadores comuns |
|---|---|---|
| Nome completo | `nome` | "Nome:", "Nome completo:" |
| CPF | `cpf` | "CPF:" |
| Nacionalidade | `nacionalidade` | "Nacionalidade:" |
| Estado civil | `estado_civil` | "Estado civil:", "Est. civil:" |
| Profissão | `profissao` | "Profissão:", "Profissao:" |
| RG | `rg` | "RG:", "R.G.:" |
| Endereço | `endereco` | "Endereço:", "Endereco:", "End.:" |

**Se PF — campos opcionais:**

| Campo | Chave JSON | Marcadores |
|---|---|---|
| Órgão emissor | `orgao_emissor` | "Órgão emissor:", "Emissor:", "SSP/" |
| CEP | `cep` | "CEP:" — extrair do endereço se não explícito |
| Email | `email` | "Email:", "E-mail:" |

---

**Se PJ — campos obrigatórios:**

| Campo | Chave JSON | Marcadores comuns |
|---|---|---|
| Razão social | `razao_social` | "Razão social:", "Nome empresarial:", "Empresa:" |
| CNPJ | `cnpj` | "CNPJ:" |
| Endereço da sede | `endereco_sede` | "Endereço da sede:", "Sede:", "End. sede:" |
| Nome representante | `nome_rep` | "Nome do representante:", "Representante:", "Sócio:" |
| CPF representante | `cpf_rep` | "CPF representante:", "CPF rep.:", "CPF do rep:" |
| Nacionalidade rep. | `nacionalidade_rep` | "Nacionalidade:" |
| Estado civil rep. | `estado_civil_rep` | "Estado civil:" |
| Profissão rep. | `profissao_rep` | "Profissão:" |
| RG representante | `rg_rep` | "RG:" |
| Endereço domicílio | `endereco_rep` | "Endereço de domicílio:", "Domicílio:", "End. domicílio:" |

**Se PJ — campos opcionais:**

| Campo | Chave JSON | Padrão se ausente |
|---|---|---|
| CEP sede | `cep_sede` | `"N/A"` |
| Órgão emissor rep. | `orgao_emissor_rep` | `""` |
| Cargo do representante | `cargo_rep` | `"sócio-administrador(a)"` |
| Email | `email` | `""` |

---

### Passo 8: Consolidar erros

Compilar todos os campos ausentes ou inválidos detectados nos passos 2 a 7.

**SE há erros:**

1. Montar mensagem descritiva com todos os campos faltantes
2. Usar MCP ClickUp para adicionar comentário no card:

```
⚠️ Protocolo pausado — dados incompletos.

Não foi possível gerar os documentos pois os seguintes campos estão ausentes ou inválidos:

[CAMPOS_CLICKUP]
- Campo: Forma de pagamento (não preenchido)
- Campo: Valor (não preenchido)

[QUALIFICAÇÃO DO CLIENTE]
- Profissão: não encontrada na descrição
- RG: não encontrado na descrição

Por favor, complete os dados e mova o card novamente para "contrato + proc".

— @protocolo (Fio) 🧵
```

3. Retornar `{"valido": false, "erros": [...], "task_id": "..."}`
4. **PARAR — não prosseguir para geração**

---

### Passo 9: Montar JSON normalizado (somente se validação passou)

```json
{
  "tipo_pessoa": "PF",

  // Campos PF:
  "nome": "João da Silva",
  "cpf": "123.456.789-00",
  "nacionalidade": "brasileiro",
  "estado_civil": "solteiro",
  "profissao": "empresário",
  "rg": "12.345.678-9",
  "orgao_emissor": "SSP/PR",
  "endereco": "Rua X, 123, Londrina, PR",
  "cep": "86010-000",
  "email": "joao@email.com",

  // Campos PJ (em vez dos PF acima):
  // "razao_social": "Acme Ltda",
  // "cnpj": "00.000.000/0001-00",
  // "endereco_sede": "Av. Brasil, 100, São Paulo, SP",
  // "cep_sede": "01000-000",
  // "nome_rep": "Maria Lima",
  // "cpf_rep": "987.654.321-00",
  // "rg_rep": "98.765.432-1",
  // "orgao_emissor_rep": "SSP/SP",
  // "cargo_rep": "sócio-administrador(a)",
  // "nacionalidade_rep": "brasileira",
  // "estado_civil_rep": "casada",
  // "profissao_rep": "empresária",
  // "endereco_rep": "Rua Y, 456, São Paulo, SP",

  // Escopo (sempre presente):
  "nome_marca": "NOME DA MARCA",
  "qtd_classes": "3 (três)",         // se tipo = "quantidade"
  "lista_classes": "35, 42 e 45",    // se tipo = "especifica" (omitir se quantidade)
  "valor_total": "R$ 1.500,00",
  "forma_pagamento": "pix_manual",
  "condicao_pagamento": "parcelado",
  "num_parcelas": 3,                  // null se à vista

  // Controle:
  "nome_arquivo_suffix": "NOMEMARCA",
  "gerar_contrato": true,
  "gerar_procuracao": true,
  "upload_drive": true
}
```

Regras de formatação:
- `valor_total`: formatar como "R$ X.XXX,XX" (ex: 1500.00 → "R$ 1.500,00")
- `nome_arquivo_suffix`: nome da marca sem espaços, acentos removidos, em maiúsculas
- `cep`: se não encontrado na description, omitir (script usa "N/A" automaticamente)
- Se `tipo = "quantidade"`: incluir `qtd_classes`, omitir `lista_classes`
- Se `tipo = "especifica"`: incluir `lista_classes`, omitir `qtd_classes`

---

## Veto Conditions

- **MCP ClickUp não retorna a task:** VETO — "Task `{task_id}` não encontrada no ClickUp. Verifique o ID."
- **Tipo de pessoa não identificado (sem CPF nem CNPJ na description):** VETO + comentário no card
- **Forma de pagamento não mapeável:** VETO + comentário no card com valores aceitos
- **Campo obrigatório ausente na description:** comentar no card + retornar INVÁLIDO (não é VETO hard — permite outros cards da fila continuarem)

---

## Success Output

```
✅ Validação concluída para "{nome_marca}"

📋 Resumo:
   Tipo:     {PF / PJ}
   Cliente:  {nome ou razão social}
   Marca:    {nome_marca}
   Classes:  {qtd_classes ou lista_classes}
   Valor:    {valor_total}
   Pagamento: {forma_pagamento} — {condicao_pagamento}

➡️  Dados prontos para geração. Prosseguindo com *gerar...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo-v2
  phase: 1
  clickup_list_id: "901322069698"
  custom_fields:
    valor: "d660b997"
    forma_pagamento: "c833a0a0"
    parcelas: "91595fd2"
    classes: "28f75c34"
  next_task: protocolo-gerar.md
  tags: [validar, clickup, qualificacao, pf, pj, classes, normalizacao]
  updated_at: 2026-02-26
```
