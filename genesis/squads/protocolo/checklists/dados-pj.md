# Checklist: Dados de Pessoa Jurídica (PJ)

> **Usado por:** `protocolo-coletar-dados.md` (Fase 1)
> **Propósito:** Validar que todos os campos obrigatórios de PJ (empresa + representante legal) foram coletados antes de prosseguir.

---

## Validação dos Dados da Empresa

- [ ] `razao_social` — Razão social completa e não vazia
- [ ] `cnpj` — CNPJ com 14 dígitos (aceitar com ou sem formatação)
- [ ] `endereco_sede` — Endereço da sede: rua, número, bairro, cidade, estado
- [ ] `cep_sede` — CEP da sede com 8 dígitos
- [ ] `email` — E-mail de contato da empresa

---

## Validação dos Dados do Representante Legal

- [ ] `nome_rep` — Nome completo do representante legal
- [ ] `cpf_rep` — CPF do representante com 11 dígitos
- [ ] `rg_rep` — RG do representante
- [ ] `orgao_emissor_rep` — Órgão emissor do RG (opcional, confirmar ausência)
- [ ] `cargo_rep` — Cargo/função na empresa. Ex: "sócio-administrador(a)", "diretor(a)"
- [ ] `nacionalidade_rep` — Nacionalidade do representante
- [ ] `estado_civil_rep` — Estado civil do representante
- [ ] `profissao_rep` — Profissão do representante
- [ ] `endereco_rep` — Endereço de domicílio do representante

---

## Validação de Formato

- [ ] CNPJ tem exatamente 14 dígitos (remover pontuação para contar)
- [ ] CPF do representante tem exatamente 11 dígitos
- [ ] E-mail contém "@" e domínio
- [ ] CEP da sede tem 8 dígitos

---

## Revisão pelo Usuário

- [ ] Resumo exibido ao usuário (empresa + representante)
- [ ] Usuário confirmou os dados (respondeu "s" ou equivalente)

---

## JSON Resultante (campos obrigatórios)

```json
{
  "tipo_pessoa": "PJ",
  "razao_social": "...",
  "cnpj": "...",
  "endereco_sede": "...",
  "cep_sede": "...",
  "email": "...",
  "nome_rep": "...",
  "cpf_rep": "...",
  "rg_rep": "...",
  "cargo_rep": "...",
  "nacionalidade_rep": "...",
  "estado_civil_rep": "...",
  "profissao_rep": "...",
  "endereco_rep": "..."
}
```

---

```yaml
metadata:
  squad: protocolo
  tipo_pessoa: PJ
  task: protocolo-coletar-dados.md
  updated_at: 2026-02-25
```
