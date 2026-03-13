# Regras de Qualificação e Assinatura

Ao gerar contratos e procurações, utilize estas regras para formatar os campos `{{QUALIFICACAO_CONTRATANTE}}` e `{{ASSINATURA_CONTRATANTE}}`.

## 1. Qualificação (Preâmbulo)

### Pessoa Física (PF)

**Variável:** `{{QUALIFICACAO_CONTRATANTE}}`
**Formato:**

> \[Nome\], \[nacionalidade\], \[estado civil\], \[profissão\], portador do RG nº \[RG\] \[Órgão Emissor\], inscrito no CPF sob o nº \[CPF\], residente e domiciliado na \[Endereço\], CEP \[CEP\].

### Pessoa Jurídica (PJ)

**Variável:** `{{QUALIFICACAO_CONTRATANTE}}`
**Formato:**

> \[Razão Social\], pessoa jurídica de direito privado, inscrita no CNPJ sob o nº \[CNPJ\], com sede na \[Endereço\], CEP \[CEP\], neste ato representada por seu \[Cargo/Sócio\], \[Nome do Representante\], \[nacionalidade\], \[estado civil\], \[profissão\], portador do RG nº \[RG\] \[Órgão Emissor\], inscrito no CPF sob o nº \[CPF\], residente e domiciliado na \[Endereço do Representante\].


---

## 2. Bloco de Assinatura

### Pessoa Física (PF)

**Variável:** `{{ASSINATURA_CONTRATANTE}}`
**Formato:**

```text
_____________________________________
[Nome do Cliente]
Contratante
```

### Pessoa Jurídica (PJ)

**Variável:** `{{ASSINATURA_CONTRATANTE}}`
**Formato:**

```text
_____________________________________
[Nome do Representante]
Representante Legal de [Razão Social]
Contratante
```


