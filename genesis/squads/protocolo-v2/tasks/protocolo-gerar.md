# Task: Protocolo — Gerar Documentos

> **Comando:** `*gerar` (ou execução interna via `*processar`)
> **Agente:** @protocolo (Fio)
> **Fase:** 2 — Geração de PDFs

---

## Purpose

Executar o script `assemble_contract.py` com os dados validados para gerar os PDFs
do **Contrato de Serviços** e da **Procuração**. Sempre gera os dois documentos.

Em seguida, faz upload automático para o **Google Drive** na pasta do cliente.

---

## Prerequisites

- Validação concluída na sessão (`dados_validados` disponível)
- `task_id` disponível na sessão
- Python 3.9+ instalado (`python3 --version`)
- Dependências instaladas:
  - `pip3 install reportlab`
  - `pip3 install google-api-python-client google-auth-oauthlib google-auth-httplib2`
- Diretório `genesis/outputs/protocolo-v2/` com permissão de escrita

---

## Execution Mode

**Automático** — executa o script via Bash e aguarda a saída.

---

## Implementation Steps

---

### Passo 1: Criar diretório de output (se não existir)

```bash
mkdir -p genesis/outputs/protocolo-v2
```

---

### Passo 2: Serializar o JSON

Serializar os `dados_validados` da sessão como string JSON compacta.

Atenção ao escaping:
- Aspas simples internas devem ser escapadas para uso no shell
- Usar variável de ambiente ou arquivo temporário se o JSON for muito grande

Exemplo de JSON serializado (PF):
```json
{"tipo_pessoa":"PF","nome":"João da Silva","cpf":"123.456.789-00","nacionalidade":"brasileiro","estado_civil":"solteiro","profissao":"empresário","rg":"12.345.678-9","endereco":"Rua X, 123, Londrina, PR","nome_marca":"SUPERMARCA","qtd_classes":"3 (três)","valor_total":"R$ 1.500,00","forma_pagamento":"pix_manual","condicao_pagamento":"parcelado","num_parcelas":3,"nome_arquivo_suffix":"SUPERMARCA","gerar_contrato":true,"gerar_procuracao":true,"upload_drive":true}
```

---

### Passo 3: Executar o script

```bash
cd genesis/outputs/protocolo-v2 && \
  python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON_SERIALIZADO>'
```

O script fará automaticamente:
- Seleção das cláusulas corretas da biblioteca (classes, pagamento, condições)
- Qualificação jurídica completa (CONTRATANTE + CONTRATADO Genesis)
- Header com logo Genesis + footer com endereço
- Assinatura adequada ao tipo de pessoa (PF ou PJ)
- Geração dos PDFs com fontes Sora (ou Helvetica como fallback)

Arquivos gerados no diretório `genesis/outputs/protocolo-v2/`:
- `Contrato_{nome_arquivo_suffix}.pdf`
- `Procuracao_{nome_arquivo_suffix}.pdf`

O script também tentará o upload para o Google Drive automaticamente:
- Credenciais: `squads/protocolo/resources/credentials.json` + `token.json`
- Pasta no Drive: `Clientes/{nome_marca} - {nome_cliente}/`

---

### Passo 4: Verificar geração dos arquivos

Confirmar que os PDFs foram gerados:

```bash
ls genesis/outputs/protocolo-v2/Contrato_*.pdf
ls genesis/outputs/protocolo-v2/Procuracao_*.pdf
```

**SE arquivos encontrados:** registrar na sessão (ver Passo 5)

**SE arquivos não encontrados após execução sem erro:**
- VETO — "Script executou mas não gerou arquivos. Verifique o JSON de entrada."

---

### Passo 5: Registrar na sessão

```json
{
  "pdf_contrato": "genesis/outputs/protocolo-v2/Contrato_{sfx}.pdf",
  "pdf_procuracao": "genesis/outputs/protocolo-v2/Procuracao_{sfx}.pdf",
  "drive_upload": "concluido | falhou",
  "geracao_concluida": true
}
```

---

## Veto Conditions

- **Python 3 não encontrado:**
  VETO — "Python 3 não encontrado. Instale com: `brew install python3`"

- **reportlab não instalado:**
  VETO — "Dependência ausente. Execute:
  `pip3 install reportlab google-api-python-client google-auth-oauthlib`"

- **Script retorna erro (exit code != 0):**
  VETO — Exibir a saída de erro completa do script. Não prosseguir.

- **PDFs não gerados após execução sem erro:**
  VETO — "Script executou mas os arquivos não foram encontrados no diretório de output."

---

## Error Handling (não-bloqueante)

- **Google Drive upload falha:** registrar `drive_upload = "falhou"` na sessão e
  mencionar no comentário do ClickUp. Os PDFs locais foram gerados — continuar.
- **Credenciais Drive ausentes ou expiradas:** registrar e continuar. Os PDFs locais
  são o entregável principal.

---

## Success Output

```
✅ Documentos gerados com sucesso!

📄 Contrato:   genesis/outputs/protocolo-v2/Contrato_{sfx}.pdf
📄 Procuração: genesis/outputs/protocolo-v2/Procuracao_{sfx}.pdf
☁️  Google Drive: {concluído | falhou — verificar credenciais}

➡️  Prosseguindo com *finalizar (upload ClickUp + comentário + mover card)...
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo-v2
  phase: 2
  script: squads/protocolo/scripts/assemble_contract.py
  output_dir: genesis/outputs/protocolo-v2/
  next_task: protocolo-finalizar.md
  tags: [gerar, pdf, contrato, procuracao, python, drive]
  updated_at: 2026-02-26
```
