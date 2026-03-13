---
name: contrato-procuracao
version: 1.0.0
description: Workflow completo de geração de Contrato e Procuração para clientes Genesis
agent: protocolo
squad: protocolo
---

# Workflow: Contrato e Procuração Genesis

Orquestra o fluxo completo de 4 fases para onboarding de novos clientes da Genesis Registro de Marcas,
desde a coleta de dados até o upload dos documentos assinados no Google Drive.

---

## Visão Geral do Fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW: CONTRATO + PROCURAÇÃO                   │
├─────────────┬──────────────┬─────────────────┬───────────────────── ┤
│   FASE 1    │    FASE 2    │     FASE 3      │       FASE 4         │
│             │              │                 │                      │
│  Coletar    │   Definir    │    Gerar PDFs   │  Finalizar + Upload  │
│   Dados     │   Escopo     │  (auto script)  │    Google Drive      │
│             │              │                 │                      │
│  *iniciar   │   *escopo    │    *gerar       │    *finalizar        │
└─────────────┴──────────────┴─────────────────┴──────────────────────┘
```

---

## Fase 1: Coleta de Dados do Cliente

**Task:** `protocolo-coletar-dados.md`
**Comando:** `*iniciar`
**Objetivo:** Elicitar todos os dados do cliente necessários para os documentos jurídicos.

**Detecção automática de tipo:**
- CPF (11 dígitos) → Pessoa Física
- CNPJ (14 dígitos) → Pessoa Jurídica

**Dados PF:** nome, cpf, nacionalidade, estado_civil, profissao, rg, orgao_emissor,
endereco, cep, email

**Dados PJ:** razao_social, cnpj, endereco_sede, cep_sede + representante legal completo

**Saída:** JSON de sessão com `coleta_concluida = true`

---

## Fase 2: Definição de Escopo

**Task:** `protocolo-definir-escopo.md`
**Comando:** `*escopo`
**Objetivo:** Definir marca, classes INPI, forma e condição de pagamento.

**Decisão de classes:**
```
Usuário sabe quais classes?
  ├── SIM → lista_classes = "35, 42 e 45" (automático: qtd_classes = 3)
  └── NÃO → qtd_classes = "2 (duas)" (apenas quantidade)
```

**Formas de pagamento disponíveis:**
- `cartao` — Link de pagamento por Cartão de Crédito
- `pix_manual` — PIX com envio de comprovante (Chave: CNPJ Genesis)
- `pix_auto` — PIX Automático via BR Code / QR Code
- `boleto_manual` — Boleto bancário em PDF por e-mail

**Condições:**
- `vista` — Pagamento único no ato da contratação
- `parcelado` — Até X vezes (informar `num_parcelas`)

**Saída:** Estado de sessão com `escopo_concluido = true`

---

## Fase 3: Geração dos Documentos

**Task:** `protocolo-gerar-docs.md`
**Comando:** `*gerar`
**Objetivo:** Executar `assemble_contract.py` e gerar os PDFs.

**Execução:**
```bash
cd genesis/outputs/protocolo/ && \
  python3 ../../squads/protocolo/scripts/assemble_contract.py '<JSON>'
```

**Documentos gerados:**
- `Contrato_{nome_arquivo_suffix}.pdf` — Contrato de Serviços
- `Procuracao_{nome_arquivo_suffix}.pdf` — Instrumento de Procuração/Mandato

**Localização:** `genesis/outputs/protocolo/`

**Script aplica automaticamente:**
- Qualificação jurídica formatada (CONTRATANTE + CONTRATADO - Genesis)
- Cláusula de classes (quantidade ou lista específica)
- Cláusula de pagamento correspondente à forma selecionada
- Cláusula de condição (à vista / parcelado)
- Bloco de assinatura adequado ao tipo de pessoa
- Header com logo Genesis + footer com endereço

**Saída:** Arquivos PDF em disco, `geracao_concluida = true`

---

## Fase 4: Finalização e Upload

**Task:** `protocolo-finalizar.md`
**Comando:** `*finalizar`
**Objetivo:** Confirmar documentos e fazer upload para o Google Drive.

**Confirmação obrigatória antes do upload:**
```
"Os documentos foram revisados e estão corretos? Confirmar upload? (s/n)"
```

**Destino no Drive:**
```
Clientes/
  └── {nome_marca} - {nome_cliente}/
        ├── Contrato_{sufixo}.pdf
        └── Procuracao_{sufixo}.pdf
```

**Script:** `google_drive_service.py`
- Cria a pasta se não existir
- Faz upload de ambos os arquivos
- Credenciais: `resources/credentials.json` + `resources/token.json`

---

## Comandos de Controle

| Comando | Descrição |
|---|---|
| `*iniciar` | Inicia a Fase 1 (coleta de dados) |
| `*escopo` | Avança para a Fase 2 |
| `*gerar` | Executa a Fase 3 (geração dos PDFs) |
| `*finalizar` | Executa a Fase 4 (upload Drive) |
| `*status` | Exibe estado atual do protocolo |
| `*reiniciar` | Descarta estado e reinicia do zero |
| `*exit` | Encerra o agente @protocolo |

---

## Pré-condições do Workflow

- [ ] Python 3.9+ instalado
- [ ] `reportlab` instalado (`pip3 install reportlab`)
- [ ] `google-api-python-client`, `google-auth-oauthlib` instalados
- [ ] `resources/credentials.json` presente no squad
- [ ] `resources/token.json` presente (ou fluxo OAuth2 concluído)
- [ ] `genesis/outputs/protocolo/` com permissão de escrita

---

## Estado da Sessão (controle de progresso)

```yaml
session:
  coleta_concluida: false      # Fase 1
  escopo_concluido: false      # Fase 2
  geracao_concluida: false     # Fase 3
  upload_realizado: false      # Fase 4
  arquivos_gerados: []
  dados_cliente: {}
```

---

## Roadmap de Integrações Futuras

### ClickUp (planejado)
- Após Fase 4: criar card em `Genesis > Clientes > Protocolo`
- Campos: nome do cliente, marca, data, link do Drive
- Configuração: `squad.yaml > integration.clickup`

### HITL UI (planejado)
- Interface visual para revisão dos documentos antes do upload
- Preview dos PDFs no Claude Code
- Botões de confirmação/edição inline

---

```yaml
metadata:
  version: 1.0.0
  squad: protocolo
  phases: 4
  documents: [contrato, procuracao]
  payment_methods: [cartao, pix_manual, pix_auto, boleto_manual]
  output_dir: genesis/outputs/protocolo/
  updated_at: 2026-02-25
```
