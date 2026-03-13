# Task: Protocolo — Coletar Dados do Cliente

> **Comando:** `*iniciar`
> **Agente:** @protocolo (Fio)
> **Fase:** 1 de 4 — Coleta de Dados

---

## Purpose

Coletar os dados completos do cliente (Pessoa Física ou Pessoa Jurídica) por meio de elicitação
estruturada, validar o formato dos campos obrigatórios e armazenar em memória de sessão como
JSON pronto para uso no script `assemble_contract.py`.

---

## Prerequisites

- Agente @protocolo ativo
- Nenhum protocolo em andamento (ou `*reiniciar` foi chamado)

---

## Execution Mode

**Interativo** — coleta todos os dados em diálogo guiado antes de prosseguir.

---

## Elicitation Process

### Passo 1: Identificar tipo de pessoa

```
Pergunta ao usuário:
"O cliente é Pessoa Física (CPF) ou Pessoa Jurídica (CNPJ)?"

→ Se fornecer CPF (somente dígitos, 11 caracteres): tipo_pessoa = "PF"
→ Se fornecer CNPJ (somente dígitos, 14 caracteres): tipo_pessoa = "PJ"
→ Se ambíguo: perguntar explicitamente
```

---

### Passo 2A: Coleta para Pessoa Física (PF)

Solicitar os seguintes campos (um bloco de cada vez, ou aceitar preenchimento em lote):

| Campo | Chave JSON | Obrigatório | Exemplo |
|---|---|---|---|
| Nome completo | `nome` | ✅ | João da Silva |
| CPF | `cpf` | ✅ | 123.456.789-00 |
| Nacionalidade | `nacionalidade` | ✅ | brasileiro(a) |
| Estado civil | `estado_civil` | ✅ | solteiro(a) |
| Profissão | `profissao` | ✅ | empresário(a) |
| RG | `rg` | ✅ | 12.345.678-9 |
| Órgão emissor RG | `orgao_emissor` | ⚪ | SSP/PR |
| Endereço completo | `endereco` | ✅ | Rua X, 123, Cidade |
| CEP | `cep` | ✅ | 86010-450 |
| E-mail | `email` | ✅ | joao@email.com |

---

### Passo 2B: Coleta para Pessoa Jurídica (PJ)

**Dados da empresa:**

| Campo | Chave JSON | Obrigatório | Exemplo |
|---|---|---|---|
| Razão social | `razao_social` | ✅ | Acme Ltda |
| CNPJ | `cnpj` | ✅ | 00.000.000/0001-00 |
| Endereço sede | `endereco_sede` | ✅ | Av. Brasil, 100, SP |
| CEP sede | `cep_sede` | ✅ | 01000-000 |
| E-mail | `email` | ✅ | contato@acme.com.br |

**Dados do representante legal:**

| Campo | Chave JSON | Obrigatório | Exemplo |
|---|---|---|---|
| Nome do representante | `nome_rep` | ✅ | Maria Lima |
| CPF representante | `cpf_rep` | ✅ | 987.654.321-00 |
| RG representante | `rg_rep` | ✅ | 98.765.432-1 |
| Órgão emissor RG | `orgao_emissor_rep` | ⚪ | SSP/SP |
| Cargo/função | `cargo_rep` | ✅ | sócio-administrador(a) |
| Nacionalidade | `nacionalidade_rep` | ✅ | brasileiro(a) |
| Estado civil | `estado_civil_rep` | ✅ | casado(a) |
| Profissão | `profissao_rep` | ✅ | empresário(a) |
| Endereço domicílio | `endereco_rep` | ✅ | Rua Y, 456, SP |

---

### Passo 3: Confirmação dos dados

Exibir resumo formatado de todos os dados coletados e perguntar:

```
"Os dados estão corretos? (s para confirmar / n para corrigir campo específico)"
```

Se o usuário quiser corrigir: perguntar qual campo e coletar novo valor.

---

## Implementation Steps

1. Perguntar tipo de pessoa (PF/PJ) se não detectável automaticamente
2. Elicitar campos do bloco correspondente (aceitar lote ou campo a campo)
3. Validar campos obrigatórios presentes
4. Validar formato CPF (11 dígitos) e CNPJ (14 dígitos) se fornecidos
5. Montar objeto JSON de sessão com `tipo_pessoa` + todos os campos
6. Exibir resumo e pedir confirmação
7. Ao confirmar: registrar estado como `coleta_concluida = true`
8. Sugerir próximo passo: `*escopo`

---

## Validation Checklist

- [ ] `tipo_pessoa` definido como "PF" ou "PJ"
- [ ] Todos os campos obrigatórios preenchidos
- [ ] CPF ou CNPJ com formato válido (apenas dígitos)
- [ ] E-mail presente
- [ ] Usuário confirmou os dados

---

## State Output (sessão)

```json
{
  "tipo_pessoa": "PF | PJ",
  "nome": "...",
  "cpf": "...",
  "email": "...",
  "...": "todos os campos coletados"
}
```

---

## Error Handling

- **Campo obrigatório vazio:** avisar e re-elicitar apenas o campo faltante
- **CPF/CNPJ inválido (contagem de dígitos):** informar formato esperado e pedir novamente
- **Usuário cancela:** perguntar se quer `*reiniciar` ou continuar de onde parou

---

## Success Output

```
✅ Dados do cliente coletados e confirmados.
📋 Tipo: {PF/PJ} — {nome ou razão social}
➡️  Próximo passo: *escopo (definir marca, classes e pagamento)
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo
  phase: 1
  next_task: protocolo-definir-escopo.md
  tags: [coleta, cliente, pf, pj, qualificacao]
  updated_at: 2026-02-25
```
