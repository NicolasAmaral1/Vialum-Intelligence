# Guia de Aprendizado — Squad Protocolo e aiOS

> Este documento explica o que foi construído, por quê, e como cada peça se encaixa.
> Leia do início ao fim na primeira vez. Depois use como referência.

---

## Parte 1: O que é o aiOS e como funciona aqui

O **Synkra aiOS** é um framework de orquestração de agentes IA instalado em `genesis/`.
Ele define regras, personas e fluxos que determinam como o Claude Code se comporta.

### Os 3 conceitos centrais que usamos no squad Protocolo:

---

### 1. Agentes

Um agente é uma **persona** com comandos específicos, que o Claude assume quando você o ativa.

**Como funciona:**
- Você digita `@protocolo` no Claude Code
- O Claude lê `squads/protocolo/agents/protocolo.md`
- Assume a persona **Fio 🧵** com seus comandos (`*iniciar`, `*gerar`, etc.)
- Fica nessa persona até você digitar `*exit`

**O que define um agente** (em `agents/protocolo.md`):
```yaml
agent:
  id: protocolo
  name: Fio
  icon: 🧵
  role: Especialista em Onboarding

commands:
  - id: iniciar
    key: "*iniciar"
    task: protocolo-coletar-dados.md  ← aponta para uma Task
```

**Analogia:** O agente é o *personagem*. As Tasks são o *roteiro* do que ele faz.

---

### 2. Tasks (Task-First Architecture)

Uma **task** é um roteiro executável — descreve passo a passo o que o agente deve fazer.

No aiOS, tasks são o ponto de entrada principal, **não o agente**.

**Nossas 4 tasks:**

| Arquivo | Comando | O que instrui o agente a fazer |
|---|---|---|
| `protocolo-coletar-dados.md` | `*iniciar` | Como elicitar dados PF/PJ |
| `protocolo-definir-escopo.md` | `*escopo` | Como coletar marca, classes, pagamento |
| `protocolo-gerar-docs.md` | `*gerar` | Como montar o JSON e rodar o script Python |
| `protocolo-finalizar.md` | `*finalizar` | Como confirmar e fazer upload |

**Estrutura de uma task:**
```markdown
# Task: Protocolo — Coletar Dados
## Purpose        ← o que faz
## Prerequisites  ← o que precisa estar pronto
## Elicitation    ← como perguntar ao usuário
## Implementation Steps  ← passos em ordem
## Validation Checklist  ← como saber se funcionou
## Error Handling ← o que fazer se der errado
## Success Output ← o que mostrar ao usuário
```

---

### 3. Sinapses (Synapse Engine)

As **Sinapses** são o sistema que *injeta contexto automaticamente* no Claude durante a conversa.

Pense assim: o Claude normalmente não "sabe" que está no squad Protocolo. As Sinapses resolvem isso injetando regras relevantes no contexto antes de cada prompt.

**A pipeline tem 8 camadas (L0–L7):**

```
L0 Constitution  → Princípios non-negotiable do aiOS
L1 Global        → Configurações gerais do projeto
L2 Agent         → Regras do agente ativo (@protocolo)
L3 Workflow      → Regras do workflow em execução
L4 Task          → Regras da task em execução
L5 Squad         → Regras do squad ativo ← NOSSA INTEGRAÇÃO
L6 Keyword       → Regras ativadas por palavras no prompt ← NOSSA INTEGRAÇÃO
L7 StarCommand   → Regras ativadas por comandos *
```

**Como o L5 encontra o squad Protocolo:**
```
squads/protocolo/.synapse/manifest  ← arquivo que o L5 escaneia
squads/protocolo/.synapse/agent-protocolo  ← domain file (regras)
squads/protocolo/.synapse/onboarding      ← domain file (regras)
squads/protocolo/.synapse/qualificacao    ← domain file (regras)
```

**Formato do manifest (KEY=VALUE, não YAML):**
```
AGENT_PROTOCOLO_STATE=active
AGENT_PROTOCOLO_ALWAYS_ON=true
AGENT_PROTOCOLO_AGENT_TRIGGER=protocolo
ONBOARDING_RECALL=cliente,contrato,marca,inpi
```

**ATENÇÃO:** Por padrão, o engine executa apenas L0–L2. Para ativar L3–L7:
```bash
SYNAPSE_LEGACY_MODE=true
```

Mesmo sem isso, o `.synapse/manifest` já documenta a intenção e fica pronto para quando o engine ativar essas camadas.

---

## Parte 2: O que foi construído neste projeto

### Estrutura completa do squad

```
genesis/squads/protocolo/
│
├── squad.yaml              ← "Carteira de identidade" do squad
│                             Define: nome, versão, dependências,
│                             componentes, integração Drive e ClickUp futuro
│
├── README.md               ← Documentação de alto nível
│
├── .synapse/               ← INTEGRAÇÃO COM SINAPSES
│   ├── manifest            ← O que o L5 escaneia (KEY=VALUE)
│   ├── agent-protocolo     ← Regras do agente (sempre injetadas)
│   ├── workflow-contrato   ← Regras do workflow
│   ├── onboarding          ← Regras por palavras-chave
│   └── qualificacao        ← Regras de qualificação PF/PJ
│
├── agents/
│   └── protocolo.md        ← Persona Fio + comandos + estado de sessão
│
├── tasks/                  ← ROTEIROS EXECUTÁVEIS (Task-First)
│   ├── protocolo-coletar-dados.md
│   ├── protocolo-definir-escopo.md
│   ├── protocolo-gerar-docs.md
│   └── protocolo-finalizar.md
│
├── workflows/
│   └── contrato-procuracao.md   ← Visão geral das 4 fases
│
├── checklists/
│   ├── dados-pf.md         ← Validação campos PF
│   └── dados-pj.md         ← Validação campos PJ
│
├── scripts/
│   ├── assemble_contract.py     ← Gerador de PDF (ReportLab)
│   └── google_drive_service.py  ← Upload Google Drive (OAuth2)
│
├── resources/
│   ├── assets/             ← Fontes Sora + logo Genesis
│   ├── termos/             ← Templates: contrato.md, procuracao.md
│   ├── regras_qualificacao.md
│   ├── credentials.json    ← OAuth2 credentials (Google Cloud)
│   └── token.json          ← Token OAuth2 (renovação automática)
│
└── docs/
    └── guia-aprendizado.md ← Este arquivo
```

---

## Parte 3: Como o squad é ativado no Claude Code

### Via agente

```
@protocolo
```

O Claude Code lê:
1. `.claude/commands/AIOS/agents/protocolo.md` (slash command)
2. Que aponta para `squads/protocolo/agents/protocolo.md` (definição completa)

### Via AGENTS.md (shortcut registrado)

```
@protocolo  → squads/protocolo/agents/protocolo.md
```

### Via slash command

```
/AIOS:agents:protocolo
```

---

## Parte 4: O script Python e como é chamado

O `assemble_contract.py` recebe um JSON e:
1. Detecta PF/PJ pelo campo `tipo_pessoa`
2. Monta a qualificação jurídica formatada
3. Seleciona cláusulas da biblioteca (por `forma_pagamento` e `condicao_pagamento`)
4. Renderiza os templates de `resources/termos/`
5. Gera PDFs com fontes Sora e logo Genesis

**Caminhos internos do script (relativos ao próprio arquivo):**
```python
SCRIPT_DIR  = /squads/protocolo/scripts/
AGENT_DIR   = /squads/protocolo/        ← um nível acima
ASSETS_DIR  = /squads/protocolo/resources/assets/
TERMOS_DIR  = /squads/protocolo/resources/termos/
```

**Como a task chama o script:**
```bash
cd genesis/outputs/protocolo/ && \
  python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON>'
```

O `cd` é necessário para que os PDFs sejam gerados em `outputs/protocolo/`.

---

## Parte 5: Roadmap futuro

### ClickUp (próximo passo)

Após Fase 4 (`*finalizar`), criar card em `Genesis > Clientes > Protocolo`.

No `squad.yaml`, a integração já está preparada:
```yaml
integration:
  clickup:
    enabled: false       ← mude para true quando implementar
    workspace: Genesis
    list: "Clientes > Protocolo"
```

Você já tem acesso ao ClickUp via MCP. Quando chegarmos nisso, a task `protocolo-finalizar.md` receberá uma Fase 5 de criação do card.

### HITL UI (depois do ClickUp)

Interface visual para revisão dos documentos antes do upload. Opções possíveis:
- Preview do PDF inline no Claude Code
- Formulário web simples (React/Next.js)
- Integração com o sistema de aprovação do ClickUp

---

## Parte 6: Perguntas frequentes

**P: O squad funciona sem `SYNAPSE_LEGACY_MODE=true`?**
R: Sim. O agente @protocolo funciona normalmente — as tasks guiam o Claude. As Sinapses (`.synapse/`) só adicionam injeção automática de contexto. O squad é funcional sem elas.

**P: Posso modificar os templates de contrato/procuração?**
R: Sim, edite `resources/termos/contrato.md` e `resources/termos/procuracao.md`. Os placeholders `{{NOME_MARCA}}`, `{{QUALIFICACAO_CONTRATANTE}}` etc. são substituídos pelo script.

**P: O que acontece se o token do Google Drive expirar?**
R: O `google_drive_service.py` renova automaticamente usando o `credentials.json`. Se falhar, re-autentique:
```bash
python3 genesis/squads/protocolo/scripts/google_drive_service.py
```

**P: Como adiciono uma nova forma de pagamento?**
R: Edite `assemble_contract.py` no dicionário `CLAUSES['pagamento']` e adicione a nova chave. Depois atualize as tasks para listar a nova opção no menu.

---

*Squad Protocolo — Vialum Intelligence | Última atualização: 2026-02-25*
