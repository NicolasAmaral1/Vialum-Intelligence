# Squad: Protocolo Genesis

**Versão:** 1.0.0
**Agente:** @protocolo (Fio)
**Squad ID:** `protocolo`

---

## O que é este Squad?

O Squad Protocolo automatiza o fluxo completo de onboarding de novos clientes da **Genesis Registro de Marcas**, desde a coleta de dados do cliente até o upload dos documentos assinados no Google Drive.

Gera automaticamente dois documentos jurídicos em PDF:
- **Contrato de Serviços** — registro de marca junto ao INPI
- **Procuração/Instrumento de Mandato** — autorização para representação junto ao INPI

---

## Como Usar

No Claude Code, ative o agente digitando:

```
@protocolo
```

Ou via slash command:

```
/protocolo
```

O agente **Fio** irá se apresentar e guiar você pelo fluxo de 4 etapas.

---

## Fluxo de 4 Etapas

```
*iniciar → *escopo → *gerar → *finalizar
```

| Etapa | Comando | O que faz |
|---|---|---|
| 1 — Coleta de Dados | `*iniciar` | Elicita dados do cliente (PF ou PJ) |
| 2 — Definição de Escopo | `*escopo` | Marca, classes INPI, pagamento |
| 3 — Geração de Documentos | `*gerar` | Executa script Python → PDFs |
| 4 — Finalização e Upload | `*finalizar` | Confirma e envia pro Google Drive |

---

## Estrutura de Arquivos

```
squads/protocolo/
├── squad.yaml                    ← Manifesto do squad (schema aiOS)
├── README.md                     ← Este arquivo
│
├── agents/
│   └── protocolo.md              ← Definição do agente @protocolo (Fio)
│
├── tasks/
│   ├── protocolo-coletar-dados.md   ← Task: Fase 1
│   ├── protocolo-definir-escopo.md  ← Task: Fase 2
│   ├── protocolo-gerar-docs.md      ← Task: Fase 3
│   └── protocolo-finalizar.md       ← Task: Fase 4
│
├── workflows/
│   └── contrato-procuracao.md    ← Workflow completo das 4 fases
│
├── checklists/
│   ├── dados-pf.md               ← Validação Pessoa Física
│   └── dados-pj.md               ← Validação Pessoa Jurídica
│
├── scripts/
│   ├── assemble_contract.py      ← Gerador de PDFs (ReportLab)
│   └── google_drive_service.py   ← Integração Google Drive (OAuth2)
│
└── resources/
    ├── assets/
    │   ├── Sora-Regular.ttf      ← Fonte Genesis
    │   ├── Sora-Bold.ttf         ← Fonte Genesis Bold
    │   └── logo-genesis.png      ← Logo para header dos PDFs
    ├── termos/
    │   ├── contrato.md           ← Template do Contrato
    │   ├── procuracao.md         ← Template da Procuração
    │   └── biblioteca_clausulas.md ← Biblioteca de cláusulas
    └── regras_qualificacao.md    ← Regras de qualificação jurídica PF/PJ
```

**Output local:** `genesis/outputs/protocolo/`

---

## Pré-requisitos

```bash
# Python 3.9+
python3 --version

# Dependências Python
pip3 install reportlab google-api-python-client google-auth-oauthlib google-auth-httplib2
```

**Credenciais Google Drive:**
- `resources/credentials.json` — OAuth2 credentials (Google Cloud Console)
- `resources/token.json` — Token gerado no primeiro login

> Se o token não existir, o script irá solicitar autenticação na primeira execução.

---

## Formas de Pagamento Disponíveis

| ID | Descrição |
|---|---|
| `cartao` | Cartão de Crédito (link de pagamento) |
| `pix_manual` | PIX Manual (chave CNPJ Genesis) |
| `pix_auto` | PIX Automático (BR Code / QR Code) |
| `boleto_manual` | Boleto Bancário Manual (PDF por e-mail) |

---

## Roadmap de Integrações

### ClickUp (planejado)
- Criar card automaticamente em `Genesis > Clientes > Protocolo` após upload
- Configuração: `squad.yaml > integration.clickup`

### HITL UI (planejado)
- Interface visual para revisão dos documentos antes do upload
- Preview dos PDFs + botões de confirmação inline

---

## Arquitetura Técnica

O squad segue o padrão **Task-First Architecture** do aiOS:

- **Tasks** são o ponto de entrada principal (não os agentes)
- O **agente Fio** executa as tasks em sequência
- O **workflow** `contrato-procuracao.md` define a orquestração
- O **script Python** `assemble_contract.py` é chamado via Bash na Fase 3
- A **Sinapse aiOS** injeta contexto do squad nas camadas L5 (Squad) e L6 (Keywords)

---

## Contribuição

Para modificar o squad:
1. Edite as tasks em `tasks/` para ajustar o fluxo de elicitação
2. Edite os templates em `resources/termos/` para modificar os documentos
3. Atualize `squad.yaml` se adicionar novos componentes
4. Consulte o `@squad-creator` para criação de novos squads

---

*Squad Protocolo — Vialum Intelligence para Genesis Registro de Marcas*
