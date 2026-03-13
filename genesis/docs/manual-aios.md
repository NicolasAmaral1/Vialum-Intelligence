# Manual do Synkra aiOS v2.1
### Como trabalhar com Squads, Agentes, Tasks, Workflows e Sinapses

> Escrito para: Vialum Intelligence
> Versão do framework: 2.1.0
> Idioma: pt-BR
> Atualizado em: 2026-02-26

---

## Sumário

1. [O que é o aiOS](#1-o-que-é-o-aios)
2. [A Constituição — os 6 princípios](#2-a-constituição--os-6-princípios)
3. [Conceitos fundamentais](#3-conceitos-fundamentais)
4. [Squads — a arquitetura modular](#4-squads--a-arquitetura-modular)
5. [Agentes — criando personas](#5-agentes--criando-personas)
6. [Tasks — o motor da execução](#6-tasks--o-motor-da-execução)
7. [Workflows — orquestrando o fluxo](#7-workflows--orquestrando-o-fluxo)
8. [Sinapses — o sistema de contexto](#8-sinapses--o-sistema-de-contexto)
9. [Ativando agentes no Claude Code](#9-ativando-agentes-no-claude-code)
10. [Criando seu primeiro Squad do zero](#10-criando-seu-primeiro-squad-do-zero)
11. [Boas práticas e erros comuns](#11-boas-práticas-e-erros-comuns)
12. [Referência rápida de arquivos](#12-referência-rápida-de-arquivos)

---

## 1. O que é o aiOS

O **Synkra aiOS** é um framework de agentes de IA que roda dentro do Claude Code (e do Codex CLI). Ele não é um aplicativo — é um sistema de organização e execução de agentes inteligentes.

Pense assim: o Claude Code é o "computador". O aiOS é o "sistema operacional" que roda em cima dele, definindo como os agentes se comportam, quais regras elas seguem, e como elas se comunicam.

### O que o aiOS faz por você

- Define **personas** (agentes com nome, voz, estilo de comunicação)
- Cria **fluxos estruturados** de trabalho (tasks e workflows)
- Injeta **contexto relevante** automaticamente via Sinapses
- Organiza tudo em **Squads** — pacotes modulares e reutilizáveis
- Garante **qualidade** via checklists e gates de validação

### Onde fica tudo

```
genesis/                      ← raiz do aiOS no seu projeto
├── .aios-core/               ← motor do framework (NÃO modificar)
│   ├── constitution.md       ← princípios inegociáveis
│   ├── core-config.yaml      ← configuração do projeto
│   └── development/
│       ├── agents/           ← agentes do sistema (architect, dev, qa, etc.)
│       ├── tasks/            ← tasks do sistema
│       └── templates/        ← templates para criar componentes
├── squads/                   ← SEUS squads (aqui você trabalha)
│   └── meu-squad/
└── outputs/                  ← saídas geradas pelos agentes
```

---

## 2. A Constituição — os 6 princípios

A Constituição define regras **inegociáveis** que todos os agentes e squads devem seguir. Violações são bloqueadas automaticamente.

### I. CLI First (NON-NEGOTIABLE)
Toda funcionalidade nova deve funcionar 100% via CLI antes de qualquer UI.
> "O CLI é a fonte da verdade."

### II. Agent Authority (NON-NEGOTIABLE)
Cada agente tem autoridades exclusivas. Nenhum agente pode assumir o papel de outro.
> Exemplo: apenas `@devops` pode fazer `git push`. Outros agentes delegam para ele.

### III. Story-Driven Development (MUST)
Todo desenvolvimento começa e termina com uma story. Nenhum código é escrito sem uma story associada.

### IV. No Invention (MUST)
Agentes não inventam — apenas derivam dos requisitos. Tudo que um agente produz deve rastrear para um requisito real.

### V. Quality First (MUST)
Todo código passa por múltiplos gates antes de merge. Lint, typecheck, testes e build devem passar.

### VI. Absolute Imports (SHOULD)
Usar sempre imports absolutos com alias `@/`. Evitar `../../../`.

---

## 3. Conceitos fundamentais

Antes de criar qualquer coisa, é essencial entender como as peças se encaixam.

### O mapa de conceitos

```
Squad
└── é composto de:
    ├── Agent(s)     → "Quem sou eu e como me comporto"
    ├── Task(s)      → "O que fazer, passo a passo"
    ├── Workflow(s)  → "Em que ordem fazer as tasks"
    ├── Checklists   → "Como validar que fiz certo"
    ├── Scripts      → "Ferramentas que executo"
    └── Resources    → "Arquivos que uso (templates, fonts, etc.)"

Sinapses (.synapse/)
└── Injetam contexto relevante no momento certo
    ├── Quando um agente está ativo (ALWAYS_ON)
    ├── Quando palavras-chave aparecem no prompt (RECALL)
    └── Quando um workflow específico está rodando
```

### Como a execução funciona

1. Você digita `@meu-agente` ou `/meu-agente` no Claude Code
2. O Claude carrega o arquivo `agents/meu-agente.md`
3. O agente assume a persona definida e exibe o greeting
4. As Sinapses do squad são ativadas automaticamente
5. Você digita um comando (ex: `*iniciar`)
6. O agente carrega a task correspondente e a executa passo a passo
7. Ao final, o agente confirma o output e sugere o próximo passo

---

## 4. Squads — a arquitetura modular

Um **Squad** é um pacote completo e autocontido para resolver uma categoria de problema. É como um "módulo de software" mas para agentes.

### Estrutura de um Squad

```
squads/meu-squad/
├── squad.yaml                    ← manifest (obrigatório)
├── README.md                     ← documentação do squad
├── agents/
│   └── meu-agente.md             ← definição do agente
├── tasks/
│   ├── meu-squad-fase-1.md       ← task da fase 1
│   └── meu-squad-fase-2.md       ← task da fase 2
├── workflows/
│   └── fluxo-principal.md        ← orquestração das fases
├── checklists/
│   └── dados-obrigatorios.md     ← checklist de validação
├── scripts/
│   └── processar.py              ← scripts que o agente executa
├── resources/
│   ├── assets/                   ← imagens, fontes, etc.
│   └── termos/                   ← templates de documentos
└── .synapse/
    ├── manifest                  ← configuração das sinapses
    ├── agent-meu-agente          ← contexto do agente
    └── onboarding                ← contexto por palavras-chave
```

### O manifest do Squad (squad.yaml)

O `squad.yaml` é o "contrato" do squad — ele declara tudo que o squad contém e precisa.

```yaml
name: meu-squad
version: 1.0.0
short-title: Descrição curta do squad
description: >
  Descrição detalhada do que o squad faz.

author: Vialum Intelligence
license: UNLICENSED

slashPrefix: meu-squad        # prefixo para slash commands

aios:
  type: squad
  minVersion: 2.0.0

# Componentes do squad (task-first: tasks primeiro!)
components:
  tasks:
    - meu-squad-fase-1.md
    - meu-squad-fase-2.md
  agents:
    - meu-agente.md
  workflows:
    - fluxo-principal.md
  checklists:
    - dados-obrigatorios.md
  scripts:
    - processar.py

# Dependências externas
dependencies:
  python:
    - reportlab>=4.0.0

# Integrações
integration:
  google_drive:
    enabled: true
    credentials: resources/credentials.json
```

### Por que "Task-First"?

O aiOS usa arquitetura **Task-First** — isso significa que as tasks são o ponto de entrada primário, não os agentes. O agente é a persona, mas quem define O QUE fazer são as tasks.

> Regra de ouro: antes de criar um agente, crie as tasks que ele vai executar.

---

## 5. Agentes — criando personas

Um **Agente** é uma persona completa definida em um arquivo `.md`. Ele combina:
- Identidade (nome, persona, ícone)
- Regras de comportamento
- Comandos disponíveis
- Referências às tasks que executa

### Os 6 níveis de um agente de qualidade

Um agente completo no aiOS tem 6 níveis de profundidade:

| Nível | Nome | O que contém |
|-------|------|-------------|
| 0 | Command Loader | Mapa de comandos → arquivos de task |
| 1 | Identity | Nome, id, persona, ícone, role |
| 2 | Operational | Princípios, comandos, qualidade, dependências |
| 3 | Voice DNA | Vocabulário, metáforas, estados emocionais |
| 4 | Quality | Exemplos de output, anti-patterns |
| 5 | Credibility | Conquistas, influência (se baseado em especialista) |

> Um agente sem Voice DNA é genérico. Um agente sem tasks é decorativo.

### Estrutura do arquivo de agente

```markdown
# meu-agente

ACTIVATION-NOTICE: Este arquivo contém a definição completa do agente @meu-agente.

## COMPLETE AGENT DEFINITION FOLLOWS

```yaml
IDE-FILE-RESOLUTION:
  - Para comandos que referenciam dependências, mapeie para:
    squads/meu-squad/{type}/{name}

activation-instructions:
  - STEP 1: Leia este arquivo completo
  - STEP 2: Assuma a persona definida abaixo
  - STEP 3: Execute o greeting nativo
  - STEP 4: Aguarde comandos do usuário

agent:
  id: meu-agente
  name: MeuAgente
  persona: NomeDaPersona
  icon: 🎯
  version: 1.0.0
  squad: meu-squad
  role: Especialista em [domínio]

persona:
  name: NomeDaPersona
  tagline: "Frase que define o agente."
  communication:
    style: objetivo, acolhedor, direto
    language: pt-BR
    greeting_levels:
      archetypal: "🎯 NomeDaPersona — Especialista em [domínio]"
    signature_closing: "Pronto. Use *iniciar para começar."
  expertise:
    - Área de expertise 1
    - Área de expertise 2

# O command_loader é o "índice" — mapeia cada comando ao arquivo de task
command_loader:
  "*iniciar":
    description: "Inicia o fluxo"
    requires:
      - tasks/meu-squad-fase-1.md
    output_format: "JSON com dados coletados"
  "*gerar":
    description: "Gera o output"
    requires:
      - tasks/meu-squad-fase-2.md
    output_format: "Arquivo gerado"

# REGRA CRÍTICA: O agente DEVE carregar o arquivo de task antes de executar qualquer comando
CRITICAL_LOADER_RULE: |
  ANTES de executar QUALQUER comando (*):
  1. CONSULTAR command_loader[comando].requires
  2. PARAR — não prosseguir sem carregar os arquivos
  3. CARREGAR cada arquivo em requires completamente
  4. EXECUTAR o workflow do arquivo carregado EXATAMENTE como escrito

commands:
  - id: iniciar
    key: "*iniciar"
    description: "Inicia o fluxo completo"
    task: meu-squad-fase-1.md
    visibility: [key]

  - id: gerar
    key: "*gerar"
    description: "Gera o output final"
    task: meu-squad-fase-2.md
    visibility: [key]

  - id: status
    key: "*status"
    description: "Mostra estado atual"
    visibility: [key]

  - id: exit
    key: "*exit"
    description: "Sai do modo @meu-agente"
    visibility: [key]

state:
  fields:
    - campo_1
    - campo_2
    - output_gerado    # bool

memory:
  file: MEMORY.md
  location: squads/meu-squad/agents/
```\`\`\`

---

## Greeting (Nativo)

Ao ativar, exibir:

\```
🎯 NomeDaPersona — Especialista em [domínio] [permissão: {modo atual}]

**Role:** [role do agente]

**Fluxo (N etapas):**
  1. *iniciar  → Fase 1
  2. *gerar    → Fase 2

**Comandos:**
  *iniciar · *gerar · *status · *exit

Type `*iniciar` para começar.
\```

---

## Regras de Operação

1. Nunca invente dados
2. Sempre confirmar antes de executar ações irreversíveis
3. Manter estado na sessão
```

### Personalizando a Persona (Voice DNA)

A Voice DNA é o que diferencia um agente genérico de um agente com personalidade real.

```yaml
voice_dna:
  sentence_starters:
    analytical:
      - "Analisando os dados..."
      - "Com base no que foi informado..."
    decisive:
      - "A decisão aqui é clara:"
      - "O próximo passo é:"
    empathetic:
      - "Entendo a situação."
      - "Vamos resolver isso juntos."

  metaphors:
    - "Cada cliente é um vínculo bem amarrado."
    - "Documentos bem feitos são a fundação de tudo."

  vocabulary:
    always_use:
      - protocolo
      - registro
      - qualificação
      - mandato
      - cláusula

    never_use:
      - "não sei"
      - "talvez"
      - "acho que"

  emotional_states:
    focused:
      markers: "linguagem direta, sem rodeios"
    careful:
      markers: "confirma cada dado antes de avançar"
```

### Registrando o agente no AGENTS.md

Após criar o agente, adicione o shortcut no `genesis/AGENTS.md`:

```markdown
<!-- Squad Meu-Squad — carregados de squads/{id}/agents/{id}.md -->
* `@meu-agente`, `/meu-agente`, `/meu-agente.md` -> `squads/meu-squad/agents/meu-agente.md`
```

---

## 6. Tasks — o motor da execução

Uma **Task** é um workflow executável, passo a passo. Quando você digita `*iniciar`, o agente carrega a task correspondente e a executa exatamente como escrita.

> Princípio fundamental: **"Se o executor CONSEGUE improvisar, vai improvisar. E cada execução será diferente."**
> Tasks existem para eliminar a improvisação.

### Estrutura de uma Task

```markdown
# Task: [Nome da Task]

> **Comando:** `*meu-comando`
> **Agente:** @meu-agente
> **Fase:** N de N

---

## Purpose

O que esta task faz e por quê.

---

## Prerequisites

- Agente @meu-agente ativo
- [Pré-condições necessárias]

---

## Execution Mode

**Interativo** — coleta dados em diálogo antes de prosseguir.
(ou: **Automático** — executa sem interação do usuário)

---

## Elicitation Process (se interativo)

### Passo 1: [Nome do passo]

Pergunte ao usuário:
"[Pergunta exata]"

→ Se resposta X: faça Y
→ Se resposta Z: faça W

---

## Implementation Steps

1. [Passo 1 — ação específica]
2. [Passo 2 — ação específica]
3. [Passo 3 — confirmação]
4. [Passo 4 — registrar estado]
5. Sugerir próximo passo: `*proximo-comando`

---

## Validation Checklist

- [ ] Campo A preenchido
- [ ] Campo B validado
- [ ] Usuário confirmou os dados

---

## State Output (sessão)

```json
{
  "campo_1": "valor",
  "campo_2": "valor",
  "fase_concluida": true
}
```

---

## Error Handling

- **Campo vazio:** avisar e re-elicitar apenas o campo faltante
- **Formato inválido:** informar formato esperado e pedir novamente
- **Usuário cancela:** perguntar se quer `*reiniciar`

---

## Success Output

```
✅ [Mensagem de sucesso]
📋 [Resumo do que foi feito]
➡️  Próximo passo: *proximo-comando
```

---

```yaml
metadata:
  version: 1.0.0
  squad: meu-squad
  phase: 1
  next_task: meu-squad-fase-2.md
  tags: [tag1, tag2]
  updated_at: 2026-02-26
```
```

### Veto Conditions — o freio de segurança

Toda task deve ter **veto conditions**: situações em que a task para e não deixa o fluxo continuar.

```yaml
veto_conditions:
  - condition: "Campo obrigatório vazio"
    action: "VETO — não prosseguir"
    reason: "Documento inválido sem este dado"

  - condition: "Usuário não confirmou os dados"
    action: "VETO — não gerar documentos"
    reason: "Nunca gerar sem confirmação explícita"
```

---

## 7. Workflows — orquestrando o fluxo

Um **Workflow** descreve a sequência de tasks — em que ordem elas devem ser executadas, quais são as dependências entre elas, e qual é o estado esperado ao final de cada fase.

### Estrutura de um Workflow

```markdown
---
name: meu-workflow
version: 1.0.0
description: Descrição do workflow
agent: meu-agente
squad: meu-squad
---

# Workflow: [Nome]

## Visão Geral do Fluxo

```
┌─────────────┬──────────────┬─────────────────┐
│   FASE 1    │    FASE 2    │     FASE 3      │
│             │              │                 │
│  Coletar    │   Processar  │    Entregar     │
│   Dados     │              │                 │
│  *iniciar   │   *processar │    *entregar    │
└─────────────┴──────────────┴─────────────────┘
```

## Fase 1: [Nome da fase]

**Task:** `meu-squad-fase-1.md`
**Comando:** `*iniciar`
**Objetivo:** O que esta fase faz.

[Detalhes da fase...]

**Saída:** Estado com `fase_1_concluida = true`

---

## Fase 2: [Nome da fase]

[Continua...]

---

## Estado da Sessão

```yaml
session:
  fase_1_concluida: false
  fase_2_concluida: false
  fase_3_concluida: false
  dados_coletados: {}
  output_gerado: []
```
```

---

## 8. Sinapses — o sistema de contexto

**Sinapses** são o sistema de injeção de contexto do aiOS. Elas funcionam como uma "memória ativa" que enriquece o contexto do agente automaticamente — sem que você precise digitar nada.

### Como funcionam

Imagine que você está conversando com o Claude Code e menciona a palavra "contrato". As sinapses detectam essa palavra-chave e **injetam automaticamente** as regras relevantes no contexto — como se o Claude "lembrasse" de todas as regras do seu squad sobre contratos naquele momento.

### As 8 camadas (L0-L7)
'''
```
L0 — Constitution    → Princípios inegociáveis (sempre presentes)
L1 — Global          → Regras globais do projeto
L2 — Agent           → Regras do agente ativo (ALWAYS_ON)
L3 — Workflow        → Regras do workflow em execução
L4 — Task            → Regras da task atual
L5 — Squad           → Regras do squad (lidas via manifest)
L6 — Keyword         → Ativadas por palavras-chave no prompt
L7 — StarCommand     → Ativadas por comandos com *
```

### O manifest das Sinapses

O arquivo `.synapse/manifest` define quais sinapses existem e como são ativadas:

```ini
# Squad Meu-Squad — Synapse Manifest
# Formato: DOMAIN_ATTRIBUTE=value

# ──────────────────────────────────────
# AGENTE: sempre injetado quando @meu-agente está ativo
# Domain file: agent-meu-agente
# ──────────────────────────────────────
AGENT_MEU_AGENTE_STATE=active
AGENT_MEU_AGENTE_ALWAYS_ON=true
AGENT_MEU_AGENTE_AGENT_TRIGGER=meu-agente

# ──────────────────────────────────────
# WORKFLOW: injetado quando o workflow está ativo
# Domain file: workflow-meu-workflow
# ──────────────────────────────────────
WORKFLOW_MEU_WORKFLOW_STATE=active
WORKFLOW_MEU_WORKFLOW_WORKFLOW_TRIGGER=meu-workflow
WORKFLOW_MEU_WORKFLOW_RECALL=palavra1,palavra2,fluxo,etapa

# ──────────────────────────────────────
# DOMINIO: ativado por palavras-chave
# Domain file: dominio-principal
# ──────────────────────────────────────
DOMINIO_STATE=active
DOMINIO_RECALL=palavra-chave-1,palavra-chave-2,termo-relevante

# Merge mode: extend (adiciona às regras do core, não substitui)
MEU_SQUAD_EXTENDS=extend
```

### Os domain files

Cada entrada no manifest aponta para um arquivo no diretório `.synapse/`. Esses arquivos contêm as regras que são injetadas:

**`.synapse/agent-meu-agente`** (ativado quando o agente está ativo):
```
# Domain: agent-meu-agente
# Injetado pelo L2/L5 quando @meu-agente está ativo (ALWAYS_ON=true)

Você está operando como @meu-agente do Squad Meu-Squad.
Seu propósito é [descrever propósito].
O fluxo é: *iniciar → *processar → *entregar.
Nunca invente dados — tudo vem por elicitação estruturada.
Sempre confirme antes de executar ações irreversíveis.
```

**`.synapse/dominio-principal`** (ativado por palavras-chave):
```
# Domain: dominio-principal
# Injetado pelo L6 quando o prompt contém as palavras-chave configuradas.

Para [situação X], use o agente @meu-agente.
Para [situação Y], ative @meu-agente e use *iniciar.
Os templates ficam em squads/meu-squad/resources/termos/.
```

### Tipos de ativação

| Tipo | Quando ativa | Configuração |
|------|-------------|--------------|
| `ALWAYS_ON=true` | Sempre que o agente está ativo | `AGENT_X_ALWAYS_ON=true` |
| `WORKFLOW_TRIGGER` | Quando um workflow específico está rodando | `WORKFLOW_X_WORKFLOW_TRIGGER=nome` |
| `RECALL` | Quando palavras-chave aparecem no prompt | `X_RECALL=palavra1,palavra2` |

> **Nota:** L5 e L6 estão desabilitados por padrão (NOG-18). Para ativar: `SYNAPSE_LEGACY_MODE=true`

---

## 9. Ativando agentes no Claude Code

### Formas de ativar

```bash
# Forma 1: com @ (preferencial)
@meu-agente

# Forma 2: com /
/meu-agente

# Forma 3: nome completo do arquivo
/meu-agente.md
```

### Comandos padrão de todo agente

| Comando | Descrição |
|---------|-----------|
| `*help` | Lista todos os comandos disponíveis |
| `*status` | Mostra o estado atual do fluxo |
| `*reiniciar` | Descarta o estado e começa do zero |
| `*exit` | Sai do modo do agente |

### Comandos do sistema (agentes do framework)

| Agente | Papel |
|--------|-------|
| `@aios-master` (Orion) | Orquestrador mestre, cria componentes do framework |
| `@squad-creator` (Craft) | Cria e valida squads |
| `@architect` | Decisões de arquitetura |
| `@dev` | Implementação de código |
| `@qa` | Revisão e qualidade |
| `@devops` | Git push, PRs, deploys |
| `@pm` | Criação de PRDs e epics |
| `@sm` | Criação de stories |

---

## 10. Criando seu primeiro Squad do zero

Aqui está o processo completo, passo a passo, para criar um squad novo.

### Passo 1: Planeje antes de criar

Responda estas perguntas:
- Qual problema este squad resolve?
- Quais são as etapas do fluxo?
- Quais dados o agente precisa coletar?
- Quais outputs o agente gera?
- Quais integrações externas são necessárias?

### Passo 2: Use o @squad-creator

O aiOS tem um agente especializado em criar squads:

```
@squad-creator
*design-squad
```

Ele vai fazer as perguntas certas e gerar a estrutura completa.

### Passo 3: Criar manualmente (alternativa)

Se preferir criar manualmente:

```bash
# Estrutura mínima
squads/meu-squad/
├── squad.yaml
├── agents/
│   └── meu-agente.md
├── tasks/
│   └── meu-squad-fase-1.md
└── .synapse/
    ├── manifest
    └── agent-meu-agente
```

#### 3.1 Crie o squad.yaml

```yaml
name: meu-squad
version: 1.0.0
short-title: Título do Squad
description: >
  O que este squad faz.

author: Vialum Intelligence
license: UNLICENSED
slashPrefix: meu-squad

aios:
  type: squad
  minVersion: 2.0.0

components:
  tasks:
    - meu-squad-fase-1.md
  agents:
    - meu-agente.md
```

#### 3.2 Crie a task primeiro (Task-First!)

Antes do agente, defina o que ele vai fazer.
Use a estrutura da Seção 6 como guia.

#### 3.3 Crie o agente

Com a task criada, defina a persona.
Use a estrutura da Seção 5 como guia.

#### 3.4 Configure as Sinapses

Crie `.synapse/manifest` e o domain file do agente.

#### 3.5 Registre no AGENTS.md

Adicione o shortcut em `genesis/AGENTS.md`.

### Passo 4: Valide o squad

```
@squad-creator
*validate-squad meu-squad
```

---

## 11. Boas práticas e erros comuns

### ✅ Boas práticas

**Sobre Squads:**
- Sempre crie as tasks antes do agente (Task-First)
- Mantenha o `squad.yaml` atualizado com todos os componentes
- Documente o squad no `README.md`

**Sobre Agentes:**
- Dê ao agente um nome de pessoa e uma tagline memorável
- Defina Voice DNA específico — vocabulário que o agente sempre usa e nunca usa
- Inclua pelo menos 3 exemplos de output reais no agente
- Sempre defina `CRITICAL_LOADER_RULE` — isso garante que o agente carregue as tasks

**Sobre Tasks:**
- Cada task deve ser executável por qualquer agente que a leia
- Inclua veto conditions — sem elas, o agente improvisa
- Termine sempre sugerindo o próximo passo (`➡️ Próximo: *proximo`)
- Armazene o estado em JSON ao final (`fase_N_concluida = true`)

**Sobre Sinapses:**
- Use `ALWAYS_ON=true` para o domain file do agente — isso garante que as regras estejam sempre presentes
- Seja específico nas palavras-chave do `RECALL` — palavras muito genéricas ativam sinapses desnecessárias
- Use `extends=extend` para não sobrescrever as regras do core

### ❌ Erros comuns

| Erro | Consequência | Como evitar |
|------|-------------|-------------|
| Criar agente sem tasks | O agente improvisa em vez de seguir o fluxo | Tasks primeiro, sempre |
| Não definir veto conditions | Fluxo avança mesmo com dados inválidos | Adicionar veto em cada task crítica |
| Não registrar no AGENTS.md | `@meu-agente` não funciona | Sempre atualizar o AGENTS.md |
| Modificar `.aios-core/` | Corrompe o framework | Nunca modificar arquivos protegidos |
| Agent sem Voice DNA | Persona genérica e inconsistente | Definir vocabulário, metáforas e estados |

---

## 12. Referência rápida de arquivos

### Arquivos que você CRIA (seus squads)

| Arquivo | Onde fica | Para que serve |
|---------|-----------|----------------|
| `squad.yaml` | `squads/meu-squad/` | Manifest do squad |
| `meu-agente.md` | `squads/meu-squad/agents/` | Definição da persona |
| `fase-1.md` | `squads/meu-squad/tasks/` | Workflow da fase 1 |
| `fluxo.md` | `squads/meu-squad/workflows/` | Orquestração |
| `checklist.md` | `squads/meu-squad/checklists/` | Validação |
| `manifest` | `squads/meu-squad/.synapse/` | Config das sinapses |
| `agent-nome` | `squads/meu-squad/.synapse/` | Regras always-on |

### Arquivos que você CONSULTA (do framework)

| Arquivo | Onde fica | Para que serve |
|---------|-----------|----------------|
| `constitution.md` | `genesis/.aios-core/` | Princípios inegociáveis |
| `core-config.yaml` | `genesis/.aios-core/` | Config do projeto |
| `AGENTS.md` | `genesis/` | Registro de shortcuts |
| `create-agent.md` | `genesis/.aios-core/development/tasks/` | Task de criação de agente |
| `squad-creator.md` | `genesis/.aios-core/development/agents/` | Agente criador de squads |

### Comandos que você USA

```bash
# Ativar agentes do sistema
@squad-creator    # para criar/validar squads
@aios-master      # para orquestrar e criar componentes

# Criar componentes
@squad-creator *design-squad     # design guiado
@squad-creator *create-squad nome
@squad-creator *validate-squad nome
@squad-creator *analyze-squad nome

# Trabalhar com squads existentes
@meu-agente *iniciar
@meu-agente *status
@meu-agente *exit
```

---

## Próximos passos recomendados

1. **Ler** a Constituição completa: `genesis/.aios-core/constitution.md`
2. **Explorar** o Squad Protocolo como exemplo real: `genesis/squads/protocolo/`
3. **Ativar** `@squad-creator` e rodar `*analyze-squad protocolo` para ver uma análise real
4. **Criar** seu próximo squad com `@squad-creator *design-squad`

---

*Manual gerado por Vialum Intelligence | aiOS v2.1.0 | 2026-02-26*
