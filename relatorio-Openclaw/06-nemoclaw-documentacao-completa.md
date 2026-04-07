# NemoClaw - Documentacao Completa

> Stack open-source da NVIDIA para deploy seguro de agentes OpenClaw
> Status: Alpha (Early Preview) | Lancado: 16 de marco de 2026 | Licenca: Apache 2.0

---

## Indice

1. [O que e NemoClaw e por que existe](#1-o-que-e-nemoclaw-e-por-que-existe)
2. [Historia e Anuncio GTC 2026](#2-historia-e-anuncio-gtc-2026)
3. [Relacao com OpenClaw](#3-relacao-com-openclaw)
4. [Arquitetura Tecnica](#4-arquitetura-tecnica)
5. [Instalacao e Configuracao](#5-instalacao-e-configuracao)
6. [CLI e Comandos](#6-cli-e-comandos)
7. [Sistema de Blueprints](#7-sistema-de-blueprints)
8. [Sistema de Policies](#8-sistema-de-policies)
9. [Modelos Suportados e Inference](#9-modelos-suportados-e-inference)
10. [Seguranca e Privacidade](#10-seguranca-e-privacidade)
11. [Multi-Agent e Subagentes](#11-multi-agent-e-subagentes)
12. [Hardware Suportado](#12-hardware-suportado)
13. [TUI de Monitoramento e Audit Trail](#13-tui-de-monitoramento-e-audit-trail)
14. [APIs e Extensibilidade](#14-apis-e-extensibilidade)
15. [Limitacoes Conhecidas](#15-limitacoes-conhecidas)
16. [Licenca e Status Atual](#16-licenca-e-status-atual)

---

## 1. O que e NemoClaw e por que existe

NemoClaw e uma **implementacao de referencia open-source** da NVIDIA que permite o deploy seguro de agentes autonomos OpenClaw. O sistema combina o runtime OpenShell da NVIDIA com capacidades de inferencia gerenciada para estabelecer um ambiente sandboxed onde as operacoes do agente sao governadas por **politicas de seguranca declarativas**.

### O Problema que Resolve

O OpenClaw, por si so, e um agente autonomo poderoso, mas opera com seguranca na **camada de aplicacao**. Isso significa que a responsabilidade de isolar o agente, controlar acesso a rede, restringir filesystem e gerenciar inferencia recai sobre a equipe de infraestrutura. Cada organizacao precisa montar seu proprio stack de seguranca -- com segmentacao de VLAN, root filesystems read-only, controles de hypervisor, etc.

NemoClaw resolve isso adicionando uma **camada de controle ao redor do OpenClaw**: sandboxing no nivel do kernel, enforcement de politicas, restricoes de rede, setup de lifecycle e roteamento de inferencia gerenciado. Em uma analogia da propria NVIDIA: se o OpenClaw e um "funcionario brilhante que faz qualquer coisa que pedirem", o NemoClaw e "o contrato de trabalho, o cracha de acesso e a autorizacao de seguranca".

### Proposito Central

- Tornar OpenClaw **enterprise-ready** sem sacrificar a flexibilidade open-source
- Fornecer **privacidade** mantendo dados sensiveis no dispositivo local
- Garantir **auditabilidade** completa de cada acao do agente
- Simplificar deploy em ambientes **regulados e compliance-heavy**

---

## 2. Historia e Anuncio GTC 2026

### Keynote de Jensen Huang - 16 de Marco de 2026

NemoClaw foi anunciado oficialmente durante a keynote de Jensen Huang na **GTC 2026**, realizada de 16 a 19 de marco de 2026 em San Jose, California.

Aproximadamente duas horas na keynote, Huang focou no fenomeno OpenClaw, que havia sido lancado em janeiro de 2026 pelo desenvolvedor austriaco Peter Steinberger e rapidamente se tornou viral. Huang chamou o OpenClaw de **"o projeto open-source mais popular da historia da humanidade"** e o comparou ao "proximo ChatGPT".

Na abertura criativa do keynote, um lagosta (lobster) foi incluido como referencia ao NemoClaw.

### Contexto Estrategico

O anuncio fez parte do **pivot mais amplo da NVIDIA em direcao a IA agentica**, que foi o tema central da GTC 2026. A NVIDIA posicionou o NemoClaw como a ponte entre o uso experimental do OpenClaw (por consumidores e desenvolvedores) e o deploy em ambientes corporativos criticos.

### Timeline

| Data | Evento |
|------|--------|
| Janeiro 2026 | Lancamento do OpenClaw por Peter Steinberger |
| 16 Marco 2026 | Anuncio do NemoClaw na GTC 2026 por Jensen Huang |
| 16 Marco 2026 | Lancamento Alpha (Early Preview) |
| Marco 2026 | Repositorio GitHub: 16k stars, 1.7k forks, 34 contributors |

---

## 3. Relacao com OpenClaw

### O que NemoClaw NAO e

- **Nao e um agente separado** -- NemoClaw e o OpenClaw rodando dentro de uma "jaula segura" construida pela NVIDIA
- **Nao substitui o OpenClaw** -- ele o complementa com infraestrutura de seguranca
- **Nao modifica o core do OpenClaw** -- adiciona camadas ao redor

### O que NemoClaw ADICIONA ao OpenClaw

| Aspecto | OpenClaw Puro | Com NemoClaw |
|---------|---------------|--------------|
| **Seguranca** | Camada de aplicacao | Camada de kernel (OpenShell) |
| **Rede** | Acesso aberto (voce configura) | Default-deny, whitelist explicita |
| **Filesystem** | Acesso total ao sistema | Restrito a `/sandbox` e `/tmp` |
| **Inferencia** | Voce configura providers | Roteamento gerenciado via gateway |
| **Monitoramento** | Logs basicos | TUI com audit trail completo |
| **Politicas** | Nenhuma built-in | YAML declarativo, hot-reload |
| **Sandbox** | Nenhum | Container isolado via OpenShell |
| **Processos** | Pode escalar privilegios | Prevencao de privilege escalation |

### Diferenca Fundamental de Abordagem

- **OpenClaw**: Projetado para **experimentacao e uso local**. A seguranca operacional (VLAN, hypervisor, filesystem read-only) e responsabilidade da equipe de infra.
- **NemoClaw**: Projetado para **ambientes controlados e producao**. Seguranca, compliance, auditabilidade e escalabilidade ja vem integrados.

---

## 4. Arquitetura Tecnica

NemoClaw e composto por **quatro camadas integradas**:

### 4.1 Plugin Layer (CLI)

- **Linguagem**: TypeScript
- **Funcao**: Interface de linha de comando para gerenciamento do ciclo de vida do sandbox
- **Comandos**: launch, connect, status, logs
- **Instalacao**: `npm install -g nemoclaw`
- **Principio**: O plugin se mantem pequeno e estavel; a logica de orquestracao vive no blueprint

### 4.2 Blueprint Artifact

- **Linguagem**: Python
- **Funcao**: Artefato versionado que orquestra provisionamento do sandbox, configuracao de politicas e setup de inferencia
- **Ciclo de vida**: Resolve artefato -> Verifica digest -> Planeja recursos -> Aplica via OpenShell CLI
- **Versionamento**: Imutavel, versionado e verificado por digest antes da execucao
- **Cadencia**: Evolui em seu proprio ciclo de release, independente do plugin

### 4.3 Sandbox Environment (OpenShell)

- **Runtime**: OpenShell (parte do NVIDIA Agent Toolkit)
- **Funcao**: Containers rodando OpenClaw com restricoes de rede, filesystem e processos enforcadas
- **Isolamento**: Cada agente roda em seu proprio sandbox
- **Separacao**: Operacoes da camada de aplicacao sao separadas do enforcement de politicas na camada de infraestrutura

### 4.4 Inference Gateway

- **Funcao**: Roteia chamadas de API de modelo atraves de caminhos controlados para backends
- **Transparencia**: Completamente transparente para o agente -- ele faz chamadas normais de API e o gateway intercepta e roteia
- **Privacy Router**: Mantém dados sensiveis no dispositivo, so roteando para modelos cloud (Claude, GPT) quando a politica permite

### Diagrama Conceitual

```
Usuario
  |
  v
[NemoClaw CLI (TypeScript)]
  |
  v
[Blueprint (Python)] --> [Politicas YAML]
  |
  v
[OpenShell Runtime]
  |--- [Sandbox Container]
  |      |--- [OpenClaw Agent]
  |      |--- [Filesystem: /sandbox, /tmp]
  |      |--- [Network: default-deny]
  |      |--- [Process: no privilege escalation]
  |
  |--- [Inference Gateway]
         |--- NVIDIA Endpoints (Nemotron)
         |--- Ollama (local, experimental)
         |--- vLLM (local, experimental)
```

---

## 5. Instalacao e Configuracao

### 5.1 Requisitos de Hardware

| Especificacao | Minimo | Recomendado |
|--------------|--------|-------------|
| **vCPU** | 4 | 4+ |
| **RAM** | 8 GB | 16 GB |
| **Disco** | 20 GB | 40 GB |
| **Imagem Sandbox** | ~2.4 GB comprimida | - |

> **Nota**: Maquinas com menos de 8 GB de RAM podem precisar configurar 8 GB de swap.

### 5.2 Requisitos de Software

- **OS**: Ubuntu 22.04 LTS ou superior
- **Node.js**: 20+ com npm 10+
- **Container Runtime**: Docker (veja tabela abaixo)
- **OpenShell**: Instalado automaticamente pelo instalador

### 5.3 Suporte a Container Runtime

| Plataforma | Runtime | Status |
|-----------|---------|--------|
| Linux | Docker | **Primario** |
| macOS (Apple Silicon) | Docker Desktop, Colima | Suportado |
| Windows WSL | Docker Desktop | Suportado |
| macOS | Podman | **Nao suportado ainda** |

### 5.4 Passo a Passo de Instalacao

#### Passo 1: Executar o Instalador

```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
```

O instalador executa um **wizard de onboarding interativo** que:
1. Instala Node.js se necessario
2. Cria um gateway OpenShell
3. Registra inference providers
4. Constroi a imagem do sandbox (~2.4 GB)
5. Cria o sandbox inicial
6. Aplica politicas de seguranca

Ao final, o sistema exibe os detalhes de configuracao do sandbox.

#### Passo 2: Conectar ao Sandbox

```bash
nemoclaw my-assistant connect
```

#### Passo 3: Acessar o OpenClaw

Via TUI:
```bash
openclaw tui
```

Via CLI:
```bash
openclaw agent --agent main --local -m "sua mensagem aqui" --session-id test
```

### 5.5 Configuracao de Inference Provider

Durante o onboarding, voce escolhe o provider:

**NVIDIA Endpoints (Padrao/Producao)**:
- Modelo: `nvidia/nemotron-3-super-120b-a12b`
- Requer API key de `build.nvidia.com`

**Ollama (Experimental)**:
- Requer Ollama rodando localmente
- URL padrao: `http://127.0.0.1:11434`
- Ativar com: `NEMOCLAW_EXPERIMENTAL=1`

**vLLM (Experimental)**:
- Requer vLLM rodando localmente com GPU NVIDIA
- Configurar via: `nemoclaw providers add` ou re-run `nemoclaw onboard`
- Informar URL base do vLLM e mapear model IDs

> **Importante**: Opcoes locais (Ollama, vLLM) sao experimentais, especialmente no macOS.

### 5.6 Deploy Remoto via Brev

```bash
nemoclaw deploy
```

O script de deploy:
1. Instala Docker na VM remota
2. Instala NVIDIA Container Toolkit (se GPU presente)
3. Instala OpenShell
4. Roda `nemoclaw setup`
5. Conecta ao sandbox

### 5.7 Desinstalacao

```bash
curl -fsSL https://raw.githubusercontent.com/NVIDIA/NemoClaw/refs/heads/main/uninstall.sh | bash
```

Flags disponiveis:
- `--yes`: Pula confirmacao
- `--keep-openshell`: Mantem binario do OpenShell
- `--delete-models`: Remove modelos do Ollama

---

## 6. CLI e Comandos

### 6.1 Comandos NemoClaw

| Comando | Funcao |
|---------|--------|
| `nemoclaw setup` | Wizard interativo de configuracao (cria gateway, providers, sandbox) |
| `nemoclaw onboard` | Re-executa onboarding (util apos mudancas em politicas) |
| `nemoclaw list` | Lista todos os sandboxes registrados com modelo, provider e presets |
| `nemoclaw <nome> connect` | Conecta ao shell de um sandbox especifico |
| `nemoclaw status` | Mostra status, saude e configuracao de inferencia do sandbox |
| `nemoclaw start` | Inicia servicos auxiliares |
| `nemoclaw stop` | Para servicos auxiliares |
| `nemoclaw logs` | Visualiza logs do sandbox (`--follow` para streaming) |
| `nemoclaw destroy` | Para container NIM e deleta o sandbox |
| `nemoclaw deploy` | Deploy remoto via Brev |
| `nemoclaw providers add` | Adiciona provider de inferencia customizado |
| `nemoclaw update --blueprint <path>` | Atualiza para uma versao diferente do blueprint |
| `nemoclaw --help` | Referencia completa da CLI |

### 6.2 Comandos OpenShell (dentro do sandbox)

| Comando | Funcao |
|---------|--------|
| `openshell term` | Abre TUI de monitoramento |
| `openshell policy set <policy-file>` | Aplica politica dinamicamente (reseta ao reiniciar) |
| `openshell inference set --provider nvidia-nim --model <model>` | Troca modelo em tempo real |
| `openshell sandbox list` | Lista sandboxes ativos |

### 6.3 Comandos OpenClaw (dentro do sandbox)

| Comando | Funcao |
|---------|--------|
| `openclaw tui` | Interface TUI do OpenClaw |
| `openclaw agent --agent main --local -m "msg" --session-id <id>` | Envia mensagem via CLI |

---

## 7. Sistema de Blueprints

### 7.1 O que e um Blueprint

O Blueprint e um **artefato Python versionado e imutavel** que contem toda a logica para:
- Criar sandboxes
- Aplicar politicas de seguranca
- Configurar inferencia
- Orquestrar o ambiente inteiro

### 7.2 Ciclo de Vida do Blueprint

1. **Resolve**: Localiza o artefato do blueprint
2. **Verify**: Verifica digest criptografico para garantir integridade
3. **Plan**: Planeja os recursos necessarios
4. **Apply**: Executa comandos OpenShell CLI para criar sandbox e configurar recursos

### 7.3 Estrutura do Blueprint

```
nemoclaw-blueprint/
  ├── blueprint.yaml          # Configuracao principal (inference profile, etc.)
  ├── policies/               # Definicoes de politicas de seguranca
  │   ├── openclaw-sandbox.yaml  # Politica principal do sandbox
  │   └── presets/            # Templates para integracoes comuns
  │       ├── discord.yaml
  │       ├── docker.yaml
  │       ├── huggingface.yaml
  │       ├── jira.yaml
  │       ├── npm.yaml
  │       ├── outlook.yaml
  │       ├── pypi.yaml
  │       ├── slack.yaml
  │       └── telegram.yaml
  └── ...
```

### 7.4 Inference Profile no Blueprint

O `blueprint.yaml` define o inference profile padrao, incluindo:
- Provider OpenShell de inferencia
- Rota do modelo
- Configuracoes de roteamento

### 7.5 Atualizacao de Blueprint

```bash
nemoclaw update --blueprint <path_to_new_blueprint>
```

Blueprints sao imutaveis e versionados -- cada atualizacao usa um novo artefato verificado.

---

## 8. Sistema de Policies

### 8.1 Filosofia: Default-Deny

A politica padrao do NemoClaw **nega todo acesso de rede** exceto endpoints explicitamente listados. Tentativas nao autorizadas de conexao sao surfaceadas na TUI do OpenShell para aprovacao ou negacao pelo operador.

### 8.2 Camadas de Politica

As politicas sao divididas em **secoes estaticas** (trancadas na criacao) e **secoes dinamicas** (atualizaveis em runtime):

| Camada | Tipo | Descricao |
|--------|------|-----------|
| **Network** | Dinamica | Bloqueia egress nao autorizado; hot-reloadable em runtime |
| **Filesystem** | Estatica | Restringe acesso a `/sandbox` e `/tmp`; trancado na criacao |
| **Process** | Estatica | Previne escalacao de privilegios e syscalls perigosas |
| **Inference** | Dinamica | Intercepta e roteia chamadas de API de modelo |

### 8.3 Configuracao Estatica (Persistente)

Editar o arquivo `nemoclaw-blueprint/policies/openclaw-sandbox.yaml` e re-executar:

```bash
nemoclaw onboard
```

As mudancas persistem entre reinicializacoes.

### 8.4 Configuracao Dinamica (Sessao)

Executar em um sandbox rodando:

```bash
openshell policy set <policy-file>
```

Mudancas dinamicas **resetam ao reiniciar** o sandbox.

### 8.5 Presets de Politica Disponiveis

| Preset | Descricao |
|--------|-----------|
| `discord` | Acesso a APIs e webhooks do Discord |
| `docker` | Docker Hub e NVIDIA container registry |
| `huggingface` | Acesso ao HuggingFace Hub |
| `jira` | Jira e Atlassian Cloud |
| `npm` | npm registry |
| `outlook` | Microsoft Outlook |
| `pypi` | Python Package Index |
| `slack` | Slack API e webhooks |
| `telegram` | Telegram Bot API |

Para usar um preset, aplique-o como esta ou use como template base para customizacao.

### 8.6 Formato YAML de Politica

As politicas sao definidas em YAML, tornando-as:
- **Auditaveis**: Facil de revisar o que e permitido
- **Versionaveis**: Git-friendly, trackable
- **Reproduziveis**: Mesmo YAML = mesmo ambiente

### 8.7 Aprovacao em Tempo Real

Quando o agente tenta acessar um endpoint nao coberto pela politica:
1. OpenShell **bloqueia** a requisicao
2. Surfacea na **TUI** (`openshell term`) para o operador
3. Operador pode **aprovar ou negar** em tempo real
4. Endpoints aprovados **persistem apenas para a sessao atual**

> **Nota de Seguranca**: Foi identificado (GitHub Issue #272) que presets em `nemoclaw-blueprint/policies/presets/` nao possuem campo `binaries`, o que significa que qualquer processo pode acessar endpoints permitidos, nao apenas binarios especificos.

---

## 9. Modelos Suportados e Inference

### 9.1 Modelo Padrao

- **Modelo**: `nvidia/nemotron-3-super-120b-a12b` (Nemotron 3 Super 120B)
- **Provider**: NVIDIA Endpoints via `build.nvidia.com`
- **Status**: Production-ready
- **Requisito**: API key da NVIDIA

### 9.2 Familia Nemotron

| Modelo | Parametros | VRAM | Uso |
|--------|-----------|------|-----|
| **Nemotron 3 Nano 4B** | 4B | Minimo | Qualquer GPU NVIDIA |
| **Nemotron 3 Super 120B** | 120B (MoE, 12B ativos) | Alto | DGX Spark, RTX PRO |

### 9.3 Outros Modelos no Catalogo

- **Qwen 3.5** (otimizado)
- **Mistral Small 4** (otimizado, roda localmente em DGX Spark e RTX PRO)

### 9.4 Trocar Modelo em Runtime

Apos o sandbox estar rodando:

```bash
openshell inference set --provider nvidia-nim --model <model-name>
```

A mudanca tem **efeito imediato**, sem necessidade de reiniciar.

### 9.5 Providers de Inferencia

| Provider | Status | Descricao |
|----------|--------|-----------|
| **NVIDIA Endpoints** | Producao | Via build.nvidia.com, requer API key |
| **Ollama** | Experimental | Inferencia local, macOS pendente |
| **vLLM** | Experimental | Inferencia local com GPU, macOS pendente |
| **NIM Containers** | Suportado | NVIDIA Inference Microservices em containers |

### 9.6 NIM (NVIDIA Inference Microservices)

NemoClaw tem integracao profunda com NVIDIA NIMs:
- Containers otimizados para modelos open-source
- Deploy containerizado via API
- Elastic scaling automatico baseado em carga
- Pode rodar localmente em RTX ou DGX Spark via containers NIM

### 9.7 Privacy Router

O gateway de inferencia funciona como um **privacy router**:
- Dados sensiveis ficam **no dispositivo**
- So roteia para modelos cloud (Claude, GPT, etc.) **quando a politica explicitamente permite**
- Decisoes sao orientadas pelas regras de custo e privacidade do usuario

---

## 10. Seguranca e Privacidade

Este e o **diferencial central** do NemoClaw em relacao ao OpenClaw puro.

### 10.1 Modelo de Seguranca em Camadas

#### Camada 1: Sandbox (OpenShell)
- Container isolado por agente
- Separacao entre camada de aplicacao e enforcement de politicas
- Principio do **Menor Privilegio**: agentes recebem apenas os recursos minimos necessarios

#### Camada 2: Network
- **Default-deny** para toda saida de rede
- Apenas endpoints explicitamente listados sao permitidos
- Hot-reloadable em runtime
- Aprovacao em tempo real via TUI para requisicoes bloqueadas

#### Camada 3: Filesystem
- Acesso restrito a `/sandbox` e `/tmp`
- Trancado na criacao do sandbox (imutavel em runtime)
- Impede acesso a dados sensiveis do host

#### Camada 4: Process
- Prevencao de **escalacao de privilegios**
- Bloqueio de **syscalls perigosas**
- Agentes nao podem executar codigo nao revisado fora do sandbox

#### Camada 5: Inference
- Interceptacao de todas as chamadas de API de modelo
- Roteamento controlado para backends autorizados
- Privacy router mantém dados sensiveis locais

### 10.2 Principio de Menor Privilegio

Agentes sao concedidos **apenas os recursos minimos necessarios** de sistema e acesso a rede, prevenindo acesso nao autorizado a informacoes sensiveis. Isso e aplicado no nivel do kernel via OpenShell, nao na camada de aplicacao.

### 10.3 Auditabilidade

- **Audit trail completo** de cada decisao allow/deny
- Registro de cada requisicao de rede
- Registro de cada operacao de filesystem
- Registro de cada chamada de inferencia
- **Compliance teams** podem revisar logs detalhados

### 10.4 Privacidade por Design

- Dados sensiveis podem ser mantidos **exclusivamente no dispositivo**
- Inferencia local via Ollama/vLLM elimina necessidade de enviar dados para cloud
- Privacy router garante que dados so saem quando explicitamente autorizado
- Compativel com ambientes **regulados** que nao toleram comportamento opaco de agentes

---

## 11. Multi-Agent e Subagentes

### 11.1 Capacidades Multi-Agent

NemoClaw e posicionado para **performance em escala** atraves de aceleracao NVIDIA, com workloads multi-agent e concorrentes projetados para throughput enterprise.

### 11.2 Subagentes

Dentro do OpenClaw rodando no NemoClaw:
- Skills podem **spawnar subagentes isolados** com suas proprias janelas de contexto (200k tokens)
- Subagentes rodam em suas proprias sessoes
- Quando terminam, anunciam resultados de volta ao canal do requisitante
- Comando: `/subagents spawn` com parametros de agentId, task, modelo e nivel de thinking

### 11.3 Seguranca Multi-Agent

- Cada sandbox e isolado dos demais
- Politicas sao aplicadas por sandbox individualmente
- Subagentes herdam restricoes do sandbox pai
- Subagentes tem acesso a: file read/write, shell commands e MCP tools (conforme politica)

### 11.4 MCP Tools

Subagentes podem acessar ferramentas externas via **MCP (Model Context Protocol)**, incluindo:
- Integracao com servicos externos (Sentry, etc.)
- Ferramentas customizadas
- Tools bundled como agentes unicos

---

## 12. Hardware Suportado

### 12.1 Hardware NVIDIA (Suporte Primario)

| Hardware | Modelos Suportados | Notas |
|----------|-------------------|-------|
| **RTX 30/40/50 series** | Nemotron 3 Nano 4B, modelos menores | Consumer GPUs |
| **RTX PRO** | Nemotron 3 Super 120B, Mistral Small 4 | Professional GPUs |
| **DGX Spark** | Todos os modelos locais | Desktop AI supercomputer |
| **DGX Station** | Todos os modelos | Workstation-class |
| **Qualquer GPU NVIDIA** | Nemotron 3 Nano 4B | VRAM minimo |

### 12.2 AMD e Intel

Segundo o repositorio comunitario, NemoClaw pode rodar em Windows e macOS com **emulacao de GPU AMD/Intel** e modelo Nemotron-3-Super-120B bundled. Entretanto, isto e via **emulacao**, nao suporte nativo.

### 12.3 Plataformas de Execucao

| Plataforma | Status | Notas |
|-----------|--------|-------|
| **Linux (Ubuntu 22.04+)** | Primario | Suporte completo |
| **macOS (Apple Silicon)** | Suportado | Com Docker Desktop ou Colima; gaps conhecidos |
| **Windows 11 (WSL2)** | Suportado | Requer intervencao manual; problemas de networking |
| **Cloud (via Brev)** | Suportado | Deploy remoto automatizado |
| **DigitalOcean** | Suportado | Tutorial oficial disponivel |

### 12.4 Inferencia Local vs Cloud

- **Com GPU NVIDIA**: Inferencia local via vLLM ou NIM containers
- **Sem GPU NVIDIA**: Pode usar NVIDIA Endpoints (cloud) ou Ollama em CPU (lento)
- **Vantagem local**: Melhor privacidade, sem custo de tokens, menor latencia

---

## 13. TUI de Monitoramento e Audit Trail

### 13.1 OpenShell TUI

Acessar via:
```bash
openshell term
```

O TUI monitora em **tempo real**:
- Cada requisicao de rede feita pelo agente
- Operacoes de read/write no filesystem
- Detalhes de chamadas de inferencia
- Status de saude do sandbox

### 13.2 Fluxo de Aprovacao

1. Agente tenta acessar endpoint nao autorizado
2. OpenShell bloqueia a requisicao
3. Requisicao aparece no TUI para o operador
4. Operador aprova ou nega
5. Decisao e registrada no audit trail
6. Se aprovado, endpoint acessivel **apenas para a sessao atual**

### 13.3 Audit Trail

- **Completo**: Toda decisao allow/deny e registrada
- **Formato**: Estruturado para analise por compliance teams
- **Escopo**: Rede, filesystem, inferencia, processos
- **Proposito**: Prover evidencia auditavel de que o agente operou dentro dos limites definidos

---

## 14. APIs e Extensibilidade

### 14.1 Politicas como Codigo

- Politicas definidas em **YAML declarativo**
- Versionaveis via Git
- Reproduziveis entre ambientes
- Templates (presets) para integracoes comuns

### 14.2 Extensibilidade do Blueprint

- Blueprints sao **artefatos Python** -- podem ser customizados
- Cadencia de release independente do plugin CLI
- Verificacao de integridade via digest criptografico

### 14.3 Inference Providers Customizados

```bash
nemoclaw providers add
```

Permite adicionar qualquer provider HTTP customizado:
- Informar URL base
- Mapear model IDs logicos para o deployment
- Trocar modelos em runtime sem reiniciar

### 14.4 Skills e Ferramentas

- Diretorio `.agents/skills/` para definicoes de skills
- Skills podem spawnar subagentes
- Integracao com MCP tools
- Lifecycle events programaveis

### 14.5 Presets como Extensao

Os presets em `nemoclaw-blueprint/policies/presets/` funcionam como **templates de extensao**:
- Use como esta para integracoes padrao
- Modifique para necessidades especificas
- Crie novos presets para suas integracoes

---

## 15. Limitacoes Conhecidas

### 15.1 Status Alpha

- **NAO usar em producao**
- APIs, schemas de configuracao e comportamento de runtime estao **sujeitos a breaking changes**
- Interfaces podem mudar entre releases

### 15.2 Problemas por Plataforma

#### macOS / Apple Silicon
- "Exec format error" em M1/M2/M3 quando imagem Linux-first e usada sem path arm64
- Inferencia local depende de suporte de host-routing do OpenShell
- Varios gaps documentados no **GitHub Issue #260**

#### Windows 11 / WSL2
- Requer **intervencao manual significativa** devido a problemas de networking de containers aninhados
- Cluster k3s interno do OpenShell nao alcanca container registries de forma confiavel dentro do stack de rede virtualizado do WSL2
- "Command not found: nemoclaw" apos install -- causado por mismatch de PATH entre Windows e WSL2
- Documentado no **GitHub Issue #305**

#### Docker Desktop
- "OpenShell exits immediately" com OOMKilled nos settings padrao
- Solucao: Aumentar alocacao de memoria do Docker Desktop antes do install

### 15.3 Limitacoes de Seguranca

- Presets de politica **nao possuem campo `binaries`** -- qualquer processo pode acessar endpoints permitidos (GitHub Issue #272)
- Politicas dinamicas **resetam ao reiniciar** o sandbox
- Endpoints aprovados em tempo real **so persistem na sessao atual**

### 15.4 Limitacoes de Inferencia

- Ollama e vLLM sao **experimentais**
- Suporte macOS para inferencia local esta **pendente**
- Opcoes locais requerem flag `NEMOCLAW_EXPERIMENTAL=1`
- Inferencia local em Ollama: routing pode falhar (GitHub Issue #385)

### 15.5 Suporte a Container

- **Podman**: Nao suportado ainda
- Colima: Suportado mas menos testado que Docker Desktop

---

## 16. Licenca e Status Atual

### Licenca

**Apache License 2.0** -- totalmente open-source, permissiva para uso comercial.

### Status Atual (Marco 2026)

| Aspecto | Detalhe |
|---------|---------|
| **Versao** | Alpha (Early Preview) |
| **Data de Lancamento** | 16 de Marco de 2026 |
| **GitHub Stars** | ~16,000 |
| **Forks** | ~1,700 |
| **Contributors** | 34 |
| **Producao** | NAO recomendado |
| **Uso Recomendado** | Avaliacao, desenvolvimento, experimentacao |

### Comunidade

- **Discord**: Servidor dedicado para suporte e discussao
- **GitHub Issues**: Para bug reports e feature requests
- **GitHub Discussions**: Para questoes e ideias
- **Documentacao oficial**: https://docs.nvidia.com/nemoclaw/latest/

### Repositorios Relacionados

- **Repositorio principal**: https://github.com/NVIDIA/NemoClaw
- **DGX Spark Playbooks**: https://github.com/NVIDIA/dgx-spark-playbooks (inclui playbook NemoClaw)
- **Awesome NemoClaw**: https://github.com/VoltAgent/awesome-nemoclaw (presets, recipes, playbooks comunitarios)
- **Build.nvidia.com**: https://build.nvidia.com/nemoclaw (deploy e instrucoes)

---

## Estrutura do Repositorio

```
NVIDIA/NemoClaw/
├── .agents/skills/          # Definicoes de skills
├── nemoclaw/               # Implementacao core do plugin (TypeScript)
├── nemoclaw-blueprint/     # Logica de orquestracao do blueprint (Python)
│   ├── blueprint.yaml      # Configuracao de inference profile
│   ├── policies/           # Definicoes de politicas de seguranca
│   │   ├── openclaw-sandbox.yaml  # Politica principal
│   │   └── presets/        # Templates para integracoes
│   │       ├── discord.yaml
│   │       ├── docker.yaml
│   │       ├── huggingface.yaml
│   │       ├── jira.yaml
│   │       ├── npm.yaml
│   │       ├── outlook.yaml
│   │       ├── pypi.yaml
│   │       ├── slack.yaml
│   │       └── telegram.yaml
├── docs/                   # Documentacao
├── scripts/                # Scripts utilitarios
├── test/                   # Suite de testes
├── ci/                     # Configuracao CI/CD
├── README.md
├── LICENSE                 # Apache 2.0
└── uninstall.sh
```

---

## Resumo Executivo

**NemoClaw = OpenClaw + OpenShell + Inferencia Gerenciada + Politicas Declarativas**

E a resposta da NVIDIA para a pergunta: "Como uso OpenClaw em ambiente corporativo sem expor minha infraestrutura?"

**Para usar amanha**, voce precisa:
1. Uma maquina Linux com Docker (ou macOS com Docker Desktop)
2. 8 GB+ RAM, 20 GB+ disco
3. Uma API key da NVIDIA (de build.nvidia.com) para o modelo Nemotron
4. Rodar `curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash`
5. Seguir o wizard de onboarding
6. Configurar politicas YAML conforme suas necessidades
7. Monitorar via `openshell term`

**Pontos criticos a considerar**:
- Alpha -- nao usar em producao ainda
- macOS e Windows tem gaps conhecidos
- Inferencia local e experimental
- Presets de politica tem lacuna de seguranca no campo `binaries`
- Manter expectativas de que APIs podem mudar entre releases

---

*Relatorio gerado em 24 de marco de 2026 com base na documentacao oficial NVIDIA, repositorio GitHub NVIDIA/NemoClaw, e fontes complementares.*

*Fontes principais:*
- *https://docs.nvidia.com/nemoclaw/latest/*
- *https://github.com/NVIDIA/NemoClaw*
- *https://www.nvidia.com/en-us/ai/nemoclaw/*
- *https://blogs.nvidia.com/blog/gtc-2026-news/*
- *https://nvidianews.nvidia.com/news/nvidia-announces-nemoclaw*
- *https://developer.nvidia.com/blog/run-autonomous-self-evolving-agents-more-safely-with-nvidia-openshell/*

