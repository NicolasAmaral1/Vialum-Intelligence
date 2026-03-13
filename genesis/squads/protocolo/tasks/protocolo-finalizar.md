# Task: Protocolo — Finalizar e Fazer Upload para o Google Drive

> **Comando:** `*finalizar`
> **Agente:** @protocolo (Fio)
> **Fase:** 4 de 4 — Finalização e Upload

---

## Purpose

Confirmar com o usuário que os PDFs gerados estão corretos e, após confirmação explícita,
executar o upload automático para o Google Drive na pasta correta do cliente:
`Clientes/{nome_marca} - {nome_cliente}/`.

---

## Prerequisites

- Fase 3 (`*gerar`) concluída com sucesso
- Arquivos presentes em `genesis/outputs/protocolo/`
- Credenciais Google Drive disponíveis em `genesis/squads/protocolo/resources/credentials.json`
- Token OAuth2 disponível em `genesis/squads/protocolo/resources/token.json`

---

## Execution Mode

**Interativo** — confirmação explícita do usuário antes do upload.

---

## Implementation Steps

### Passo 1: Listar arquivos gerados

Exibir ao usuário os arquivos prontos para upload:

```
📁 Arquivos prontos para upload:
  📄 genesis/outputs/protocolo/Contrato_{sufixo}.pdf
  📄 genesis/outputs/protocolo/Procuracao_{sufixo}.pdf

Destino no Drive: Clientes/{nome_marca} - {nome_cliente}/
```

---

### Passo 2: Solicitar confirmação

```
"Os documentos foram revisados e estão corretos?
Confirmar upload para o Google Drive? (s para confirmar / n para cancelar)"
```

Se o usuário responder **não**: encerrar sem fazer upload, avisar que os arquivos
permanecem em `genesis/outputs/protocolo/` para revisão posterior.

---

### Passo 3: Executar upload (apenas se confirmado)

Executar script com flag de upload:

```bash
cd genesis/outputs/protocolo/ && python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON_COM_UPLOAD_TRUE>'
```

Onde o JSON é o mesmo da Fase 3, mas com:
```json
{
  "upload_drive": true,
  "gerar_contrato": false,
  "gerar_procuracao": false
}
```

> O script detectará os PDFs já existentes e fará apenas o upload via `google_drive_service.py`.

**Alternativamente**, chamar o google_drive_service diretamente:

```python
# Lógica interna do script:
# upload_file(caminho_absoluto_pdf, nome_marca, nome_cliente)
# → Cria pasta "Clientes/{nome_marca} - {nome_cliente}/" se não existir
# → Faz upload dos PDFs para essa pasta
```

---

### Passo 4: Confirmar upload bem-sucedido

Verificar retorno do script (sem erros) e exibir links do Drive se disponíveis.

---

### Passo 5: Encerrar protocolo

Marcar sessão como concluída e exibir resumo final.

---

## Validation Checklist

- [ ] Arquivos PDF presentes em `genesis/outputs/protocolo/`
- [ ] Usuário confirmou o upload explicitamente
- [ ] Script executado sem erros
- [ ] Pasta criada no Drive: `Clientes/{nome_marca} - {nome_cliente}/`
- [ ] Ambos os PDFs presentes na pasta do Drive
- [ ] Estado da sessão marcado como `upload_realizado = true`

---

## Error Handling

- **Credenciais ausentes:** orientar execução do fluxo de autenticação OAuth2:
  ```bash
  python3 genesis/squads/protocolo/scripts/google_drive_service.py
  ```
- **Token expirado:** o script renova automaticamente; se falhar, re-autenticar
- **Erro de rede:** informar ao usuário e oferecer nova tentativa
- **Arquivo não encontrado:** verificar se Fase 3 foi executada corretamente

---

## Success Output

```
✅ Protocolo concluído com sucesso!

📤 Upload realizado para o Google Drive:
   📁 Clientes/{nome_marca} - {nome_cliente}/
      📄 Contrato_{sufixo}.pdf
      📄 Procuracao_{sufixo}.pdf

🎉 Cliente {nome} integrado com sucesso!
Use *iniciar para começar um novo protocolo.
```

---

## Notas Futuras (roadmap)

- **ClickUp Integration:** criar card automaticamente em `Genesis > Clientes > Protocolo`
  após upload bem-sucedido
- **HITL UI:** interface visual para revisão dos documentos antes do upload

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo
  phase: 4
  script: scripts/google_drive_service.py
  output_dir: genesis/outputs/protocolo/
  tags: [finalizacao, upload, drive, google]
  roadmap:
    - clickup_integration
    - hitl_ui
  updated_at: 2026-02-25
```
