# Task: Laudo — Gerar Documentos Finais e Fechar

> **Comando:** `*gerar` (ou Fase 4 do `*nova-analise`)
> **Agente:** @laudo (Mira)
> **Fase:** 4 — Geração e Entrega


---

## Purpose

Após aprovação dos dois checkpoints, gerar os documentos finais em PDF (ReportLab) e DOCX
(Builder), fazer upload para o Google Drive, e AGUARDAR aprovação explícita antes de
atualizar o ClickUp.

### ⚠️ REGRA CRÍTICA: Drive vs ClickUp

| Destino | Quando sobe | Motivo |
|---------|-------------|--------|
| **Google Drive** | Imediatamente após geração | Permite revisão visual do documento |
| **ClickUp** | SOMENTE após aprovação explícita do usuário | Evita publicar documento não revisado |

O ClickUp é o registro oficial para o cliente. **Nunca** atualizar automaticamente.


---

## Prerequisites

* PARTE 1 e PARTE 2 aprovadas (checkpoints 1 e 2 concluídos)
* Arquivo `{nome_marca} - PLANO DE ANÁLISE.md` completo
* Scripts e assets disponíveis em `squads/laudo-viabilidade/`


---

## Execution Mode

**Semi-automático** — gera e sobe no Drive automaticamente, mas aguarda aprovação para ClickUp.


---

## Implementation Steps

### Passo 1: Validar pré-condições

Verificar:

* `laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md` existe e tem PARTE 1 + PARTE 2
* `squads/laudo-viabilidade/resources/assets/` com logo e fontes
* Sem placeholder "AGUARDANDO PROCESSAMENTO" no arquivo


---

### Passo 2: Gerar PDF (ReportLab)

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/gerar_laudo_reportlab.py \
  "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md"
```

Output esperado: `laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO DE VIABILIDADE.pdf`

O script faz upload automático para o Google Drive (com versionamento).


---

### Passo 3: Gerar DOCX (Builder)

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 genesis/squads/laudo-viabilidade/scripts/gerar_docx_builder.py \
  "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md"
```

Output esperado: `laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO DE VIABILIDADE.docx`

O script faz upload automático para o Google Drive (com versionamento).


---

### Passo 4: Gerar Radar Visual (se RADAR.json existir)

```bash
cd /Users/nicolasamaral/Vialum-Intelligence && \
python3 analisar/scripts/gerar_radar_pdf.py \
  "laudos/{cliente}/{nome_marca}/{nome_marca} - RADAR.json"
```

Output esperado: `laudos/{cliente}/{nome_marca}/{nome_marca} - RADAR VISUAL.pdf`


---

### Passo 5: Validar qualidade visual

Verificar que os arquivos foram criados e não estão vazios:

```bash
ls -lh "laudos/{cliente}/{nome_marca}/"
```

SE qualquer arquivo tiver 0 bytes → reportar erro e investigar log do script.


---

### Passo 6: Upload Google Drive (automático)

O `google_drive_service.py` é chamado automaticamente pelos scripts de geração.
Funciona assim:
- Versões anteriores são movidas para pasta **"antigos"** no Drive
- Primeira versão: `ZENIT - ANÁLISE DE VIABILIDADE.pdf`
- Segunda versão: `2 - ZENIT - ANÁLISE DE VIABILIDADE.pdf`
- Terceira versão: `3 - ZENIT - ANÁLISE DE VIABILIDADE.pdf`


---

### Passo 7: CHECKPOINT — Confirmação Visual Local

**⚠️ OBRIGATÓRIO: Pedir ao usuário para abrir o documento no computador e confirmar.**

**Mensagem ao usuário:**
```
Documentos gerados e enviados para o Google Drive!

Abra o PDF/DOCX no seu computador para conferir antes de publicar no ClickUp:
  laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO DE VIABILIDADE.pdf

Versão no Google Drive:
  Possiveis Clientes/{nome_marca} - {cliente}/

Confirma que está tudo certo para publicar no ClickUp?
(sim/não — se não, diga o que precisa ajustar)
```

**Aguardar:** Aprovação EXPLÍCITA do usuário.

SE o usuário pedir ajustes:
1. Fazer os ajustes solicitados
2. Regerar os documentos (volta ao Passo 2)
3. Versão anterior vai para "antigos" no Drive automaticamente
4. Pedir confirmação novamente


---

### Passo 8: Comentar no card do ClickUp (SÓ APÓS APROVAÇÃO)

```bash
# Postar comentário de conclusão
cat > /tmp/laudo_final_comment.json << 'COMMENT'
{"comment_text": "✅ Laudo de viabilidade concluído!\n\nMarca: {nome_marca}\nCliente: {cliente}\n\n📄 Documentos gerados:\n• {nome_marca} - LAUDO DE VIABILIDADE.pdf\n• {nome_marca} - LAUDO DE VIABILIDADE.docx\n\nArquivos disponíveis no Google Drive e na pasta local:\nlaudos/{cliente}/{nome_marca}/\n\n— Mira ⚖️ (@laudo)"}
COMMENT

curl -s -X POST \
  -H "Authorization: {CLICKUP_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/laudo_final_comment.json \
  "https://api.clickup.com/api/v2/task/{task_id}/comment"
```


---

### Passo 9: Mover card para "feito"

```bash
curl -s -X PUT \
  -H "Authorization: {CLICKUP_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "feito"}' \
  "https://api.clickup.com/api/v2/task/{task_id}"
```

Verificar resposta: status retornado deve ser "feito".


---

### Passo 10: Relatório final ao usuário

```
Laudo de viabilidade concluído com sucesso!

{nome_marca} — {cliente}

Documentos gerados:
   PDF:  laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO DE VIABILIDADE.pdf
   DOCX: laudos/{cliente}/{nome_marca}/{nome_marca} - LAUDO DE VIABILIDADE.docx

Google Drive: upload concluído (versão {N})
ClickUp: card movido para "feito"

O laudo está pronto para apresentação ao cliente.

— Mira ⚖️
```


---

## Versionamento no Google Drive

O sistema versiona automaticamente os documentos:

| Versão | Nome no Drive | Localização |
|--------|---------------|-------------|
| 1ª | `ZENIT - ANÁLISE DE VIABILIDADE.pdf` | Pasta principal |
| 2ª | `2 - ZENIT - ANÁLISE DE VIABILIDADE.pdf` | Pasta principal (1ª vai para "antigos") |
| 3ª | `3 - ZENIT - ANÁLISE DE VIABILIDADE.pdf` | Pasta principal (2ª vai para "antigos") |

A pasta **"antigos"** é criada automaticamente dentro da pasta do cliente.


---

## Error Handling (não-bloqueante)

* **Script PDF falha:** Reportar erro, continuar com DOCX. Informar ao usuário.
* **Script DOCX falha:** Reportar erro, continuar com PDF. Informar ao usuário.
* **Drive upload falha:** Reportar; arquivos locais existem e devem ser enviados manualmente.
* **ClickUp comentário falha:** Registrar localmente; mover status de qualquer forma.


---

## Veto Conditions

* `PLANO DE ANÁLISE.md` não encontrado: VETO — "Arquivo de análise não encontrado. Execute \*preliminar e \*inpi primeiro."
* **Placeholder ainda presente no .md:** VETO — "A PARTE 2 ainda não foi preenchida. Execute \*inpi primeiro."
* **Usuário não aprovou:** VETO — "Aguardando confirmação visual do documento antes de publicar no ClickUp."


---

## Success Output

```
Pipeline concluído — {nome_marca}

   PDF:    {nome_marca} - LAUDO DE VIABILIDADE.pdf ✅
   DOCX:   {nome_marca} - LAUDO DE VIABILIDADE.docx ✅
   Drive:  upload ✅ (versão {N}, anteriores em "antigos")
   ClickUp: "feito" ✅ (após aprovação visual)

— Mira ⚖️
```


---

```yaml
metadata:
  version: 2.0.0
  squad: laudo-viabilidade
  phase: 4
  scripts:
    - squads/laudo-viabilidade/scripts/gerar_laudo_reportlab.py
    - squads/laudo-viabilidade/scripts/gerar_docx_builder.py
    - squads/laudo-viabilidade/scripts/google_drive_service.py
    - analisar/scripts/gerar_radar_pdf.py
  clickup_status_saida: "feito"
  tags: [gerar, pdf, docx, drive, clickup, finalizar, versionamento]
  updated_at: 2026-03-28
```
