# Task: Protocolo — Gerar Documentos PDF

> **Comando:** `*gerar`
> **Agente:** @protocolo (Fio)
> **Fase:** 3 de 4 — Geração de Documentos

---

## Purpose

Montar o JSON completo com todos os dados coletados nas fases 1 e 2, executar o script
`assemble_contract.py` para gerar os PDFs (Contrato + Procuração) com fontes Sora,
logo Genesis e cláusulas da biblioteca, salvando os arquivos em `genesis/outputs/protocolo/`.

---

## Prerequisites

- Fase 1 (`*iniciar`) concluída: `coleta_concluida = true`
- Fase 2 (`*escopo`) concluída: `escopo_concluido = true`
- Python 3.9+ disponível no ambiente
- Dependências instaladas: `reportlab`, `google-api-python-client`
- Script em: `genesis/squads/protocolo/scripts/assemble_contract.py`
- Output dir: `genesis/outputs/protocolo/` (criar se não existir)

---

## Execution Mode

**Automático** — executa o script sem interação adicional após confirmação de pré-condições.

---

## Implementation Steps

### Passo 1: Montar JSON completo

Consolidar todos os dados da sessão em um único objeto JSON:

```json
{
  "tipo_pessoa": "PF | PJ",
  "nome": "...",
  "cpf": "...",
  "nacionalidade": "...",
  "estado_civil": "...",
  "profissao": "...",
  "rg": "...",
  "orgao_emissor": "...",
  "endereco": "...",
  "cep": "...",
  "email": "...",

  "razao_social": "... (PJ only)",
  "cnpj": "... (PJ only)",
  "endereco_sede": "... (PJ only)",
  "cep_sede": "... (PJ only)",
  "nome_rep": "... (PJ only)",
  "cpf_rep": "... (PJ only)",
  "rg_rep": "... (PJ only)",
  "orgao_emissor_rep": "... (PJ only)",
  "cargo_rep": "... (PJ only)",
  "nacionalidade_rep": "... (PJ only)",
  "estado_civil_rep": "... (PJ only)",
  "profissao_rep": "... (PJ only)",
  "endereco_rep": "... (PJ only)",

  "nome_marca": "...",
  "qtd_classes": "...",
  "lista_classes": "... (se específicas)",
  "valor_total": "R$ ...",
  "forma_pagamento": "cartao | pix_manual | pix_auto | boleto_manual",
  "condicao_pagamento": "vista | parcelado",
  "num_parcelas": "... (se parcelado)",
  "nome_arquivo_suffix": "...",
  "gerar_contrato": true,
  "gerar_procuracao": true,
  "upload_drive": false
}
```

> **IMPORTANTE:** `upload_drive` deve ser `false` aqui — o upload é feito separadamente na Fase 4.

---

### Passo 2: Verificar diretório de output

```bash
mkdir -p genesis/outputs/protocolo/
```

---

### Passo 3: Executar o script

```bash
cd genesis/outputs/protocolo/ && python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON_COMPLETO>'
```

O script irá:
1. Detectar PF/PJ automaticamente pelo campo `tipo_pessoa`
2. Montar qualificação jurídica formatada (negrito + sublinhado)
3. Selecionar cláusula de classes (por quantidade ou lista específica)
4. Selecionar cláusula de pagamento correspondente
5. Selecionar cláusula de condição (à vista / parcelado)
6. Montar bloco de assinatura (PF ou PJ)
7. Gerar PDFs com fontes Sora, logo Genesis no header e rodapé com endereço
8. Salvar: `Contrato_{nome_arquivo_suffix}.pdf` e `Procuracao_{nome_arquivo_suffix}.pdf`

---

### Passo 4: Confirmar geração

Verificar se os arquivos foram criados:

```bash
ls -la genesis/outputs/protocolo/Contrato_*.pdf genesis/outputs/protocolo/Procuracao_*.pdf
```

---

### Passo 5: Exibir resultado

Mostrar ao usuário:
- Nomes dos arquivos gerados
- Caminho completo local
- Instrução para abrir e revisar antes de fazer upload

---

## Validation Checklist

- [ ] JSON montado com todos os campos obrigatórios para o tipo de pessoa
- [ ] `upload_drive` = false no JSON desta fase
- [ ] Diretório de output existe
- [ ] Script executado sem erros
- [ ] `Contrato_{sufixo}.pdf` gerado em `genesis/outputs/protocolo/`
- [ ] `Procuracao_{sufixo}.pdf` gerado em `genesis/outputs/protocolo/`

---

## Error Handling

- **ModuleNotFoundError (reportlab):** orientar instalação:
  ```bash
  pip3 install reportlab
  ```
- **FileNotFoundError (fontes ou logo):** verificar se `resources/assets/` está presente no squad
- **JSONDecodeError:** verificar formatação do JSON (aspas simples → escapar) — usar aspas duplas dentro do JSON, passado entre aspas simples no shell
- **Arquivo não gerado:** exibir stderr do script e sugerir `*reiniciar`

---

## Success Output

```
✅ Documentos gerados com sucesso!

📄 Contrato:   genesis/outputs/protocolo/Contrato_{sufixo}.pdf
📄 Procuração: genesis/outputs/protocolo/Procuracao_{sufixo}.pdf

Revise os PDFs antes de fazer o upload.
➡️  Próximo passo: *finalizar (confirmar e enviar para o Google Drive)
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo
  phase: 3
  next_task: protocolo-finalizar.md
  script: scripts/assemble_contract.py
  output_dir: genesis/outputs/protocolo/
  tags: [geracao, pdf, contrato, procuracao, reportlab]
  updated_at: 2026-02-25
```
