# Workflow: Nova Análise de Viabilidade de Marca

> **Squad:** laudo-viabilidade
> **Agente:** @laudo (Mira ⚖️)
> **Trigger:** `*nova-analise` ou `*nova-analise {task_id}`

---

## Descrição

Orquestra o pipeline completo de análise de viabilidade de registro marcário:
desde o monitoramento da fila no ClickUp até a entrega do laudo profissional (PDF + DOCX).

Dois checkpoints humanos obrigatórios impedem a progressão automática sem revisão.

---

## Activation

```bash
# Pipeline completo (começa monitorando ClickUp)
claude -p "@laudo *nova-analise" --dangerously-skip-permissions

# Ir direto para um card específico (pula monitoramento)
claude -p "@laudo *nova-analise 86XXXXXXX" --dangerously-skip-permissions
```

---

## Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW: NOVA ANÁLISE DE VIABILIDADE              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 0 ──► laudo-monitorar.md                                  │
│             ClickUp "para fazer" → listar → usuário escolhe     │
│             → mover para "em processo"                           │
│             ↓                                                    │
│  FASE 1 ──► laudo-coletar.md                                    │
│             Ler card: nome_marca, cliente, atividade             │
│             Criar pasta laudos/{cliente}/{nome_marca}/           │
│             ↓                                                    │
│  FASE 2 ──► laudo-preliminar.md                                 │
│             SKILL: analise-preliminar                            │
│             Gerar PARTE 1 (VERACIDADE, LICEIDADE, DISTINTIVIDADE)│
│             + Classes NCL com especificações                     │
│             ↓                                                    │
│         ┌── CHECKPOINT 1 ── Usuário revisa classes ──────────┐  │
│         │   Aguardar: "ok" ou ajustes                        │  │
│         └────────────────────────────────────────────────────┘  │
│             ↓                                                    │
│  FASE 3 ──► laudo-inpi.md                                       │
│             Usuário busca INPI → cola inpi-raw.txt              │
│             processar_inpi.py → inpi-raw-processed.json         │
│             SKILL: analise-inpi                                  │
│             Gerar PARTE 2 (narrativa jurídica de colidências)   │
│             ↓                                                    │
│         ┌── CHECKPOINT 2 ── Usuário revisa análise completa ─┐  │
│         │   Aguardar: "ok" ou ajustes                        │  │
│         └────────────────────────────────────────────────────┘  │
│             ↓                                                    │
│  FASE 4 ──► laudo-gerar.md                                      │
│             gerar_laudo_reportlab.py → PDF                       │
│             gerar_docx_builder.py → DOCX                         │
│             Upload Google Drive                                  │
│             Comentar no ClickUp + mover para "feito"            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estado de Sessão

```json
{
  "task_id": "...",
  "nome_marca": "...",
  "alternativos": "...",
  "cliente": "...",
  "atividade": "...",
  "pasta": "laudos/{cliente}/{nome_marca}/",
  "plano_md": "laudos/{cliente}/{nome_marca}/{nome_marca} - PLANO DE ANÁLISE.md",
  "classes_aprovadas": [],
  "checkpoint_1": "pendente | aprovado",
  "checkpoint_2": "pendente | aprovado"
}
```

---

## Regras de Orquestração

1. **task_id passado como argumento** → pular FASE 0, ir direto para FASE 1
2. **Checkpoint não aprovado** → NÃO prosseguir automaticamente; aguardar usuário
3. **Erro em qualquer fase** → reportar ao usuário, não abortar silenciosamente
4. **Scripts Python** → sempre executados a partir da raiz do workspace (`/Users/nicolasamaral/Vialum-Intelligence`)
5. **HITL é inegociável:** Nenhum documento final é gerado sem aprovação humana

---

## Workflows Auxiliares

- `*especificacoes` — análise de especificações NCL vs concorrentes (pré-depósito)
  Arquivo: usar instrução do `.agent/workflows/analise-especificacoes.md` como sinapse

---

```yaml
metadata:
  version: 1.0.0
  squad: laudo-viabilidade
  phases: [0, 1, 2, 3, 4]
  hitl_checkpoints: 2
  clickup_list_id: "901324787605"
  output_base: "laudos/"
  tags: [nova-analise, workflow, pipeline, viabilidade, marca]
  updated_at: 2026-02-27
```
