# Synkra AIOS -- Analise Completa do Framework

> **Data:** 2026-03-23 | **Autor:** Analise automatizada via Claude Code | **Versao analisada:** AIOS v4.31.1 / AIOX v1.0.0-rc.10

---

## 1. O que e o Synkra AIOS

O Synkra AIOS (AI-Orchestrated System) e um meta-framework open-source de orquestracao de agentes de IA. Criado pela SynkraAI, ele **nao e apenas um framework de desenvolvimento de software** — e uma **plataforma de automacao de negocios** onde squads de agentes especializados (cada um com persona, escopo e autoridades exclusivas) executam workflows complexos de qualquer dominio: juridico, comercial, operacional, estrategico.

O Nicolas utiliza o Synkra como **sistema operacional de negocio**, com squads especializados para:
- **Direito agrario** (Malvina Safra): 12 agentes que transformam documentos juridicos brutos em pecas de defesa completas
- **Estrategia comercial** (AGER): 6 squads — auditoria interna, captacao de leads, defesa extrajudicial, estrategia, pesquisa de cliente/mercado
- **Propriedade intelectual** (Vialum/Genesis): squads de laudo de viabilidade, protocolo INPI, procuracao
- **Contestacao judicial** (Caso de uso/direito): squads de contestacao com 14 fases automatizadas

A premissa central e que **trabalho de conhecimento assistido por IA** sofre de dois problemas criticos:

1. **Inconsistencia de planejamento** -- LLMs geram planos fragmentados e contradictorios
2. **Perda de contexto** -- informacao se perde na transicao entre fases do workflow

O AIOS resolve ambos com agentes especializados com personas, Constitution formal com gates automaticos, e handoff protocol que preserva contexto entre trocas de agentes.

### Nomenclatura

O framework existe em duas variantes:
- **AIOS** (`aios-core`) -- versao original, usada no projeto Genesis Full
- **AIOX** (`aiox-core`) -- variante com branding diferente, mesma arquitetura, usada no projeto Malvina Safra

Ambos compartilham a mesma constitution, arquitetura de agentes e filosofia.

---

## 2. Arquitetura e Componentes Principais

### 2.1 Hierarquia CLI First

O principio arquitetural mais fundamental, declarado como **NON-NEGOTIABLE** na Constitution:

```
CLI (Maxima) -> Observability (Secundaria) -> UI (Terciaria)
```

Toda funcionalidade nova deve funcionar 100% via CLI antes de qualquer UI. Dashboards apenas observam, nunca controlam. A UI nunca e requisito para operacao do sistema.

### 2.2 Estrutura de Diretorios

```
.aios-core/                    # Framework core
  agents/                      # 11+ agentes com personas definidas
  tasks/                       # 45+ tasks executaveis
  checklists/                  # 10+ checklists de validacao
  data/                        # Knowledge base
  templates/                   # Templates de documentos
  workflows/                   # Workflows multi-step
  tools/                       # Configuracoes de ferramentas
  utils/                       # 70+ utilitarios
  constitution.md              # Principios inegociaveis
  core-config.yaml             # Configuracao do projeto
  user-guide.md                # Guia do usuario

.claude/                       # Integracao Claude Code
  commands/AIOS/               # Comandos de agentes e tasks
  rules/                       # Regras contextuais

.cursor/rules/                 # Integracao Cursor
.gemini/                       # Integracao Gemini CLI
.codex/                        # Integracao Codex CLI
AGENTS.md                      # Instrucoes para Codex CLI
```

### 2.3 Sistema de Agentes

O AIOS define 12+ agentes, cada um com persona unica, nome proprio e escopo exclusivo:

| Agente | Persona | Escopo |
|--------|---------|--------|
| `@dev` | Dex | Implementacao de codigo |
| `@qa` | Quinn | Testes e qualidade |
| `@architect` | Aria | Arquitetura e design tecnico |
| `@pm` | Morgan | Product Management |
| `@po` | Pax | Product Owner, stories/epics |
| `@sm` | River | Scrum Master, criacao de stories |
| `@analyst` | Alex | Pesquisa e analise |
| `@data-engineer` | Dara | Database design |
| `@ux-design-expert` | Uma | UX/UI design |
| `@devops` | Gage | CI/CD, git push (EXCLUSIVO) |
| `@squad-creator` | -- | Criacao de novos squads |
| `@aios-master` | -- | Governanca do framework |

**Agent Authority** (NON-NEGOTIABLE): Cada agente tem autoridades exclusivas que nao podem ser violadas. Exemplo: somente `@devops` pode fazer `git push`, criar PRs e releases. Somente `@architect` toma decisoes de arquitetura. Somente `@qa` emite vereditos de qualidade.

### 2.4 Constitution (Governanca Formal)

A Constitution e um documento versionado (v1.0.0) com 6 artigos:

| Artigo | Principio | Severidade |
|--------|-----------|------------|
| I | CLI First | NON-NEGOTIABLE |
| II | Agent Authority | NON-NEGOTIABLE |
| III | Story-Driven Development | MUST |
| IV | No Invention | MUST |
| V | Quality First | MUST |
| VI | Absolute Imports | SHOULD |

Gates automaticos bloqueiam violacoes de principios NON-NEGOTIABLE e MUST criticos. Violacoes de SHOULD sao reportadas mas nao bloqueiam.

### 2.5 Sistema de Gates

| Severidade | Comportamento | Uso |
|------------|---------------|-----|
| BLOCK | Impede execucao | NON-NEGOTIABLE, MUST criticos |
| WARN | Permite com alerta | MUST nao-criticos |
| INFO | Apenas reporta | SHOULD |

### 2.6 Modelo de 4 Camadas (Boundary Protection)

| Camada | Mutabilidade | Paths |
|--------|-------------|-------|
| L1 Framework Core | NEVER modify | `.aios-core/core/`, `constitution.md`, `bin/` |
| L2 Framework Templates | NEVER modify | `tasks/`, `templates/`, `checklists/`, `workflows/` |
| L3 Project Config | Mutable (excecoes) | `.aios-core/data/`, `MEMORY.md`, `core-config.yaml` |
| L4 Project Runtime | ALWAYS modify | `docs/stories/`, `packages/`, `squads/`, `tests/` |

### 2.7 Squads (Times de Agentes)

Squads sao conjuntos de agentes especializados para dominios especificos. Vao alem do desenvolvimento de software:

- **hybrid-ops** -- Metodologia Pedro Valerio (squad padrao de desenvolvimento)
- **expansion-creator** -- Criador de novos squads customizados
- **aios-infrastructure-devops** -- Utilidades DevOps
- **meeting-notes** -- Assistente de reunioes

Squads podem ser criados para qualquer dominio: escrita criativa, estrategia de negocios, saude, educacao, e aplicacoes customizadas.

### 2.8 Workflows Principais

O AIOS possui 4 workflows primarios:

**1. Story Development Cycle (SDC)** -- Fluxo principal:
```
@sm cria story -> @po valida (10 pontos) -> @dev implementa -> @qa valida (7 checks) -> @devops push
```

**2. QA Loop** -- Ciclo iterativo de revisao (max 5 iteracoes):
```
@qa review -> veredito -> @dev corrige -> re-review
```

**3. Spec Pipeline** -- Pre-implementacao (6 fases):
```
@pm gather -> @architect assess -> @analyst research -> @pm spec -> @qa critique -> @architect plan
```

**4. Brownfield Discovery** -- Avaliacao de divida tecnica (10 fases) para codebases existentes.

### 2.9 Agent Handoff Protocol

Para otimizar a janela de contexto, o AIOS implementa um protocolo de compactacao ao trocar entre agentes. Em vez de manter a persona completa do agente anterior (~3-5K tokens), gera um artefato de handoff compacto (~379 tokens) com: story ativa, decisoes tomadas, arquivos modificados, bloqueios e proxima acao.

Resultado: reducao de 33% por troca, 57% apos duas trocas.

---

## 3. Integracao com IDEs e Ferramentas de IA

### 3.1 Nivel de Integracao (AIOS 4.2)

| IDE/Ferramenta | Nivel | Mecanismo |
|----------------|-------|-----------|
| **Claude Code** | Completo (referencia) | `.claude/commands/`, `.claude/rules/`, `CLAUDE.md` |
| **Gemini CLI** | Alto | `.gemini/`, eventos nativos |
| **Codex CLI** | Parcial | `AGENTS.md`, `.codex/skills`, MCP |
| **Cursor** | Regras only | `.cursor/rules/*.mdc` (30+ rules) |
| **GitHub Copilot** | Sem lifecycle hooks | -- |
| **AntiGravity** | Workflow-based | `.antigravity/` |

### 3.2 Como Funciona com Claude Code

A integracao mais madura. O AIOS injeta:
- `CLAUDE.md` com todas as regras do framework
- Rules contextuais em `.claude/rules/` (carregadas automaticamente quando relevantes)
- Comandos slash em `.claude/commands/AIOS/` (11 agentes + 45+ tasks)
- MCP server configurations para ferramentas externas

### 3.3 Ecossistema MCP

O AIOS integra com Docker MCP Toolkit para ferramentas externas:

| MCP | Proposito |
|-----|-----------|
| Playwright | Automacao de browser, screenshots |
| EXA | Web search e pesquisa |
| Context7 | Documentacao de bibliotecas |
| Apify | Web scraping, dados de redes sociais |
| CodeRabbit | Code review automatizado |

Regra: operacoes MCP sao gerenciadas exclusivamente por `@devops`.

---

## 4. Como o Nicolas Usa no Dia a Dia

### 4.1 AGER — Automacao de Negocios Agrarios (6 Squads)

**Tipo:** Automacao de negocios completa | **Dominio:** Direito agrario, agronegocio

O AGER e o projeto que melhor ilustra o uso do Synkra como **sistema operacional de negocio**. Possui 6 squads operacionais:

| Squad | Descricao | Dominio |
|-------|-----------|---------|
| `auditoria-interna` | Auditoria de processos internos | Compliance |
| `captacao-leads` | Funil de qualificacao, conteudo inbound, parcerias com sindicatos rurais | Comercial/SDR |
| `defesa-extrajudicial` | Elaboracao de defesas contra bancos, cooperativas e revendedoras | Juridico |
| `estrategia` | Consolida outputs e propoe sistema geral (funil, automacao, CRM) | Estrategia |
| `pesquisa-cliente` | Pesquisa e analise de clientes potenciais | Inteligencia comercial |
| `pesquisa-mercado` | Analise de mercado e concorrencia | Inteligencia de mercado |

Cada squad tem: `agents/`, `tasks/`, `workflows/`, `squad.yaml`, `README.md`. Os squads sao **PROPRIETARY** (nao open-source).

### 4.2 Malvina Safra — Automacao Juridica (2 Squads, 12+ Agentes)

**Tipo:** Automacao juridica | **Versao:** AIOX (variante)

Transforma documentos juridicos brutos em pecas de defesa completas com workflow de **14 fases**:

**Squad Pecas Processuais** (12 agentes):
- `@intake` (Atlas) — organiza documentos do caso
- `@extractor` (Lector) — extrai PDFs/DOCX para Markdown, OCR em imagens
- `@analyst` (Juris) — analisa caso, sniff test de merito (18 teses), analise de preliminares (14 defesas)
- `@drafter` (Quill) — redige pecas processuais no estilo do escritorio
- `@reviewer` (Vigil) — checkpoints HITL (validacao humana)
- `@esp-inexistencia` (Nulo) — argumentos de inexistencia contratual
- `@esp-dano-moral` (Tempera) — argumentos de danos morais
- `@esp-pericia` (Grafos) — argumentos de pericia grafotecnica
- `@esp-calculos` (Cifra) — calculos processuais

**Padrao: Sequencial → Paralelo → Sequencial**
```
Fases 1-7:  Sequencial (intake → extracao → analise)
Fase 8:     PARALELO — Especialistas trabalham simultaneamente
Fases 9-14: Sequencial (redacao → revisao → entrega)
```

**Squad Bases Juridicas** (3 agentes): ingere documentos brutos e estrutura knowledge base consumida pelo Squad 1.

### 4.3 Vialum Intelligence / Genesis — Propriedade Intelectual (3 Squads)

**Tipo:** Automacao de registro de marcas | **Dominio:** PI

| Squad | O que faz |
|-------|-----------|
| `laudo-viabilidade` | Automatiza analise de viabilidade de marcas no INPI |
| `protocolo` | Automatiza processo de registro de marcas (contrato → pagamento → docs → INPI) |
| `protocolo-v2` | Versao evoluida do protocolo com workflow completo |

### 4.4 Outros Projetos com Squads

- **Caso de uso/direito**: Squads `contestacao` e `bases-juridicas` (modelo original replicado no Malvina Safra)
- **Procuracao-Artigo-Automatico**: Squad `genesis-protocolo` para automacao de procuracoes

### 4.5 Visao Consolidada: O Nicolas nao programa com Synkra — ele opera negocios

O uso do Synkra pelo Nicolas e fundamentalmente **operacional e estrategico**:
- **Squads sao equipes de trabalho virtuais** que produzem outputs de negocio (pecas juridicas, laudos, analises de mercado, estrategias)
- **Agentes sao trabalhadores especializados** com personas (Atlas, Juris, Quill) que executam tarefas de conhecimento
- **Workflows sao processos de negocio** com fases, checkpoints humanos e paralelizacao
- O Synkra e o **motor de automacao intelectual** que transforma inputs (documentos, dados, requisitos) em outputs de valor (pecas juridicas, laudos, estrategias)

---

## 5. Filosofia de Desenvolvimento

### 5.1 Agent-Driven Agile Development

O AIOS reimagina o Agile substituindo papeis humanos por agentes de IA especializados, mantendo o humano como decisor final (human-in-the-loop). Cada agente:

- Tem uma persona com nome e personalidade
- Possui escopo e autoridades exclusivas (nao pode invadir o escopo de outro)
- Segue workflows e tasks pre-definidos
- Comunica-se via handoff artifacts compactos
- Opera sob uma Constitution formal com gates automaticos

### 5.2 No Invention

Artigo IV da Constitution: especificacoes nao inventam, apenas derivam dos requisitos. Todo statement deve rastrear para um requisito funcional (FR-*), nao-funcional (NFR-*), constraint (CON-*) ou finding de pesquisa verificado. Isso previne o problema comum de LLMs "inventarem" features nao solicitadas.

### 5.3 Story-Driven Development

Todo desenvolvimento comeca e termina com uma story. Nenhum codigo e escrito sem story associada. Stories possuem acceptance criteria claros, progresso rastreado via checkboxes e file list atualizada. Isso garante rastreabilidade completa.

### 5.4 Quality First

Qualidade nao e negociavel. Todo codigo passa por multiplos gates: lint, typecheck, testes, build, CodeRabbit review, e status da story. Falha em qualquer check bloqueia o progresso.

### 5.5 Duas Fases Separadas

**Fase 1 - Planejamento (Interface Web):** Usa LLMs via interface web (Claude.ai, ChatGPT, Gemini) para criar briefing, PRD, arquitetura e UX design com agentes de planejamento.

**Fase 2 - Desenvolvimento (IDE):** Usa LLMs via IDE (Claude Code, Cursor, Codex) com agentes de desenvolvimento para fragmentar em stories, implementar, testar e entregar.

---

## 6. Pontos Fortes

1. **Separacao clara de responsabilidades** -- Agent Authority garante que cada agente opera dentro de seu escopo, evitando o caos de LLMs tentando fazer tudo ao mesmo tempo.

2. **Constitution como contrato social** -- Gates automaticos que bloqueiam violacoes transformam boas praticas em requisitos enforced, nao sugestoes.

3. **Extensibilidade via Squads** -- O caso Malvina Safra (dominio juridico) prova que o framework transcende desenvolvimento de software. Qualquer dominio pode ter seus proprios agentes especializados.

4. **Multi-IDE real** -- Suporte a Claude Code, Cursor, Gemini CLI, Codex CLI e AntiGravity, com niveis variados de integracao.

5. **Handoff Protocol** -- Solucao elegante para o problema de janela de contexto ao trocar entre agentes, reduzindo consumo de tokens em ate 57%.

6. **Rastreabilidade completa** -- Story-Driven + No Invention + Quality Gates criam uma cadeia de rastreabilidade do requisito ao codigo.

7. **Framework protection boundary** -- Modelo de 4 camadas (L1-L4) impede que o projeto corrompa o framework e vice-versa.

8. **Decision Logging** -- ADRs automaticos registram decisoes tecnicas para consulta futura.

---

## 7. Limitacoes e Pontos de Atencao

1. **Curva de aprendizado elevada** -- 12+ agentes, 45+ tasks, 4 workflows, 6 artigos constitucionais, modelo de 4 camadas. A complexidade do meta-framework pode sobrecarregar novos usuarios.

2. **Dependencia de contexto LLM** -- Apesar do Handoff Protocol, o framework depende da capacidade do LLM de "assumir" personas e seguir regras complexas. LLMs menores ou com janela de contexto limitada podem ter dificuldade.

3. **Integracao desigual entre IDEs** -- Claude Code e a implementacao de referencia com hook parity completo. Cursor e Copilot nao possuem lifecycle hooks equivalentes, limitando a experiencia.

4. **Overhead de processo** -- O ciclo completo (story creation -> validation -> implementation -> QA gate -> push) adiciona cerimonial que pode ser excessivo para fixes triviais, embora o "YOLO mode" mitigue parcialmente.

5. **Versioning em transicao** -- A coexistencia de versoes v4.31.1 (GitHub) e v1.0.0-rc.10 (NPM) gera confusao e requer force-upgrade.

6. **MCP Docker bugs** -- O workaround de segredos hardcoded no Docker MCP Toolkit e uma fragilidade de seguranca reconhecida.

7. **Framework vs. Projeto** -- A distincao entre "Framework Development Mode" e "Project Development Mode" ainda nao e explicita (Story 3.14 pendente), dependendo de heuristicas.

---

## 8. Resumo Executivo

O Synkra AIOS e uma **plataforma de orquestracao de agentes de IA para negocios**, nao apenas para desenvolvimento de software. Seus diferenciais sao: Constitution formal com gates automaticos, sistema de agentes com autoridades exclusivas, squads especializados por dominio, e workflows com HITL checkpoints.

Nicolas opera **5+ projetos de negocio** com Synkra:
- **AGER** (6 squads: captacao de leads, estrategia, auditoria, defesa extrajudicial, pesquisa)
- **Malvina Safra** (12+ agentes juridicos, 14 fases de workflow para pecas processuais)
- **Vialum/Genesis** (squads de registro de marcas, laudos INPI)
- **Caso de uso/direito** (contestacao judicial automatizada)
- **Procuracao** (automacao de procuracoes)

O uso do Synkra pelo Nicolas e **operacional e estrategico**: squads sao equipes virtuais que produzem outputs de negocio (pecas juridicas, laudos, analises de mercado), nao codigo. O framework funciona como **motor de automacao intelectual** que transforma inputs em outputs de valor.

O framework abstrai o LLM subjacente -- funciona com Claude, GPT-4, Gemini ou qualquer modelo capaz de seguir instrucoes complexas. A integracao mais madura e com Claude Code, mas o suporte multi-IDE e um diferencial estrategico.

---

## Fontes Analisadas

| Arquivo | Projeto |
|---------|---------|
| `.aios-core/user-guide.md` | Genesis Full |
| `.aios-core/constitution.md` | Genesis Full |
| `.aios-core/package.json` | Genesis Full |
| `.aios-core/core-config.yaml` | Genesis Full |
| `AGENTS.md` | Genesis Full |
| `.claude/CLAUDE.md` | Genesis Full |
| `.claude/rules/agent-authority.md` | Genesis Full |
| `.claude/rules/agent-handoff.md` | Genesis Full |
| `.claude/rules/workflow-execution.md` | Genesis Full |
| `.claude/rules/mcp-usage.md` | Genesis Full |
| `.aiox-core/user-guide.md` | Malvina Safra |
| `.aiox-core/constitution.md` | Malvina Safra |
| `AGENTS.md` | Malvina Safra |
| GitHub README | github.com/SynkraAI/aios-core |

