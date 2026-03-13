# Checklist: Dados de Pessoa Física (PF)

> **Usado por:** `protocolo-coletar-dados.md` (Fase 1)
> **Propósito:** Validar que todos os campos obrigatórios de PF foram coletados antes de prosseguir.

---

## Validação de Dados Pessoais

- [ ] `nome` — Nome completo preenchido e não vazio
- [ ] `cpf` — CPF com 11 dígitos (aceitar com ou sem formatação)
- [ ] `nacionalidade` — Ex: "brasileiro(a)", "americana"
- [ ] `estado_civil` — Ex: "solteiro(a)", "casado(a)", "divorciado(a)"
- [ ] `profissao` — Ex: "empresário(a)", "advogado(a)"
- [ ] `rg` — RG preenchido
- [ ] `orgao_emissor` — Órgão emissor (opcional, mas confirmar ausência)
- [ ] `endereco` — Endereço completo: rua, número, bairro, cidade, estado
- [ ] `cep` — CEP com 8 dígitos
- [ ] `email` — E-mail válido (contém @)

---

## Validação de Formato

- [ ] CPF tem exatamente 11 dígitos (remover pontuação para contar)
- [ ] E-mail contém "@" e domínio
- [ ] CEP tem 8 dígitos

---

## Revisão pelo Usuário

- [ ] Resumo exibido ao usuário
- [ ] Usuário confirmou os dados (respondeu "s" ou equivalente)

---

## JSON Resultante (campos obrigatórios)

```json
{
  "tipo_pessoa": "PF",
  "nome": "...",
  "cpf": "...",
  "nacionalidade": "...",
  "estado_civil": "...",
  "profissao": "...",
  "rg": "...",
  "endereco": "...",
  "cep": "...",
  "email": "..."
}
```

---

```yaml
metadata:
  squad: protocolo
  tipo_pessoa: PF
  task: protocolo-coletar-dados.md
  updated_at: 2026-02-25
```
