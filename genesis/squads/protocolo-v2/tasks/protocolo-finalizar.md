# Task: Protocolo — Finalizar no ClickUp

> **Comando:** `*finalizar` (ou execução interna via `*processar`)
> **Agente:** @protocolo (Fio)
> **Fase:** 3 — Finalização

---

## Purpose

Com os PDFs gerados em mãos, esta task:
1. Faz o upload dos arquivos como **anexos** no card do ClickUp
2. Adiciona um **comentário** no card confirmando que os documentos estão prontos
3. **Move o card** para o próximo status do fluxo: `"pagamento & assinatura"`

---

## Prerequisites

- `geracao_concluida = true` na sessão
- `pdf_contrato` e `pdf_procuracao` registrados na sessão (caminhos dos arquivos)
- `task_id` disponível na sessão
- MCP ClickUp disponível e autenticado

---

## Execution Mode

**Automático** — sem interação do usuário. Executa os 3 passos em sequência.

---

## Implementation Steps

---

### Passo 1: Upload dos PDFs como anexos no card ClickUp

Para cada PDF gerado, usar o MCP ClickUp para fazer upload do arquivo como anexo
na task identificada por `task_id`.

Arquivos a anexar:
- `Contrato_{nome_arquivo_suffix}.pdf` (caminho: `genesis/outputs/protocolo-v2/Contrato_{sfx}.pdf`)
- `Procuracao_{nome_arquivo_suffix}.pdf` (caminho: `genesis/outputs/protocolo-v2/Procuracao_{sfx}.pdf`)

**SE upload de um arquivo falhar:**
- Registrar o erro
- Continuar com o próximo arquivo (não é bloqueante)
- Mencionar a falha no comentário (Passo 2)

---

### Passo 2: Adicionar comentário no card

Usar MCP ClickUp para criar um comentário na task (`task_id`) com o seguinte texto:

```
✅ Contrato e Procuração gerados e prontos para revisão.

📄 Contrato_{sfx}.pdf — {anexado ao card | ⚠️ falha no upload}
📄 Procuracao_{sfx}.pdf — {anexado ao card | ⚠️ falha no upload}
☁️  Google Drive: {upload concluído | não disponível — verificar credenciais}

Próximo passo: revisar os documentos, encaminhar para assinatura e aguardar pagamento.

— @protocolo (Fio) 🧵
```

Substituir:
- `{sfx}` → `nome_arquivo_suffix` da sessão
- Status de cada arquivo conforme resultado do Passo 1
- Status do Drive conforme registro da sessão (`drive_upload`)

---

### Passo 3: Mover card para o próximo status

Usar MCP ClickUp para atualizar o status da task (`task_id`):

- **Status atual:** `"contrato + proc"`
- **Próximo status:** `"pagamento & assinatura"`

SE a atualização falhar:
- Registrar o erro
- Reportar ao usuário ao final (não é bloqueante — os documentos já foram entregues)

---

### Passo 4: Registrar conclusão na sessão

```json
{
  "task_id": "...",
  "upload_clickup_contrato": true,
  "upload_clickup_procuracao": true,
  "comentario_adicionado": true,
  "status_atualizado": "pagamento & assinatura",
  "processamento_concluido": true,
  "timestamp": "{data e hora}"
}
```

---

## Veto Conditions

- **`task_id` ausente na sessão:**
  VETO — "task_id não encontrado na sessão. Execute `*processar {task_id}`."

- **PDFs não encontrados no diretório de output:**
  VETO — "Arquivos PDF não encontrados. Execute `*gerar` antes de `*finalizar`."

- **MCP ClickUp completamente indisponível (todas as operações falharam):**
  VETO — "MCP ClickUp indisponível. Os PDFs foram gerados localmente mas não enviados.
  Tente novamente ou anexe manualmente em:
  genesis/outputs/protocolo-v2/"

---

## Error Handling (não-bloqueante)

| Situação | Ação |
|---|---|
| Upload de 1 PDF falhou | Mencionar no comentário, continuar |
| Google Drive falhou (na geração) | Mencionar no comentário |
| Status já era "pagamento & assinatura" | Log apenas, não é erro |
| Comentário falhou | Registrar, reportar ao final |

---

## Success Output

```
✅ Processamento finalizado para "{nome_marca}"!

📎 Contrato_{sfx}.pdf → anexado ao card ClickUp
📎 Procuracao_{sfx}.pdf → anexado ao card ClickUp
💬 Comentário publicado no card
🔄 Card movido: "contrato + proc" → "pagamento & assinatura"
☁️  Google Drive: {status}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧵 Protocolo concluído para {nome_marca}.
```

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo-v2
  phase: 3
  clickup_list_id: "901322069698"
  status_atual: "contrato + proc"
  proximo_status: "pagamento & assinatura"
  tags: [finalizar, clickup, upload, comentario, status, mover]
  updated_at: 2026-02-26
```
