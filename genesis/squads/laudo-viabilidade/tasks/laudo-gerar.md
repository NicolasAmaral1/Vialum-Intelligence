# Task: Laudo — Gerar Documentos Finais e Fechar

> **Comando:** `*gerar` (ou Fase 4 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 4 — Geração e Entrega

---

## Purpose

Após aprovação dos dois checkpoints, gerar os documentos finais em PDF (ReportLab) e DOCX
(Builder), fazer upload para o Google Drive, adicionar comentário no card do ClickUp com os
links, e mover o card para "feito".

---

## Prerequisites

- PARTE 1 e PARTE 2 aprovadas (checkpoints 1 e 2 concluídos)
- Arquivo `{nome_marca} - PLANO DE ANÁLISE.md` completo
- Scripts e assets disponíveis em `squads/laudo-viabilidade/`

---

## Execution Mode

**Automático** — gera, faz upload e finaliza sem interação adicional.

---

## Implementation Steps

### Passo 1: Validar pré-condições

Verificar:
- `laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md` existe e tem PARTE 1 + PARTE 2
- `squads/laudo-viabilidade/resources/assets/` com logo e fontes
- Sem placeholder "AGUARDANDO PROCESSAMENTO" no arquivo

---

### Passo 2: Gerar PDF (ReportLab)

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/gerar_laudo_reportlab.py \
  "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md"
```

Output esperado: `laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO FINAL REPORTLAB.pdf`

---

### Passo 3: Gerar DOCX (Builder)

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/gerar_docx_builder.py \
  "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md"
```

Output esperado: `laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO FINAL BUILDER.docx`

---

### Passo 4: Validar qualidade visual

Verificar que os arquivos foram criados e não estão vazios:
```bash
ls -lh "laudos/{cliente}/{nome_marca}/"
```

SE qualquer arquivo tiver 0 bytes → reportar erro e investigar log do script.

---

### Passo 5: Upload para Google Drive

O `google_drive_service.py` é chamado automaticamente pelos scripts de geração.
Se não for, executar manualmente para cada arquivo.

Registrar os IDs/links retornados pelo script.

---

### Passo 6: Comentar no card do ClickUp

```bash
# Postar comentário de conclusão
cat > /tmp/laudo_final_comment.json << 'COMMENT'
{"comment_text": "✅ Laudo de viabilidade concluído!\n\nMarca: {nome_marca}\nCliente: {cliente}\n\n📄 Documentos gerados:\n• {nome_marca} - LAUDO FINAL REPORTLAB.pdf\n• {nome_marca} - LAUDO FINAL BUILDER.docx\n\nArquivos disponíveis no Google Drive e na pasta local:\nlaudos/{cliente}/{nome_marca}/\n\n— Mira ⚖️ (@laudo)"}
COMMENT

curl -s -X POST \
  -H "Authorization: {CLICKUP_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/laudo_final_comment.json \
  "https://api.clickup.com/api/v2/task/{task_id}/comment"
```

---

### Passo 7: Mover card para "feito"

```bash
curl -s -X PUT \
  -H "Authorization: {CLICKUP_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "feito"}' \
  "https://api.clickup.com/api/v2/task/{task_id}"
```

Verificar resposta: status retornado deve ser "feito".

---

### Passo 8: Relatório final ao usuário

```
🎉 Laudo de viabilidade concluído com sucesso!

📋 {nome_marca} — {cliente}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 Documentos gerados:
   PDF:  laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO FINAL REPORTLAB.pdf
   DOCX: laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO FINAL BUILDER.docx

☁️  Google Drive: upload concluído
🗂️  ClickUp: card movido para "feito"

O laudo está pronto para apresentação ao cliente.

— Mira ⚖️
```

---

## Error Handling (não-bloqueante)

- **Script PDF falha:** Reportar erro, continuar com DOCX. Informar ao usuário.
- **Script DOCX falha:** Reportar erro, continuar com PDF. Informar ao usuário.
- **Drive upload falha:** Reportar; arquivos locais existem e devem ser enviados manualmente.
- **ClickUp comentário falha:** Registrar localmente; mover status de qualquer forma.

---

## Veto Conditions

- **`PLANO DE ANÁLISE.md` não encontrado:** VETO — "Arquivo de análise não encontrado. Execute *preliminar e *inpi primeiro."
- **Placeholder ainda presente no .md:** VETO — "A PARTE 2 ainda não foi preenchida. Execute *inpi primeiro."

---

## Success Output

```
✅ Pipeline concluído — {nome_marca}

   PDF:    {nome_marca} - LAUDO FINAL REPORTLAB.pdf ✅
   DOCX:   {nome_marca} - LAUDO FINAL BUILDER.docx ✅
   Drive:  upload ✅
   ClickUp: "feito" ✅

— Mira ⚖️
```

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phase: 4
  scripts:
    - squads/laudo-viabilidade/scripts/gerar_laudo_reportlab.py
    - squads/laudo-viabilidade/scripts/gerar_docx_builder.py
    - squads/laudo-viabilidade/scripts/google_drive_service.py
  clickup_status_saida: "feito"
  tags: [gerar, pdf, docx, drive, clickup, finalizar]
  updated_at: 2026-02-27
```
