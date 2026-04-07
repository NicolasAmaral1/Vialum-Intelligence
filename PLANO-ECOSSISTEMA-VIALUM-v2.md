# Vialum Platform — Theory Document v2

**Data:** 2026-04-06
**Autor:** Nicolas + Claude
**Status:** Decisão arquitetural final

---

## 1. Arquitetura

### Fundação (VPS Nicolas — compartilhada por todos os tenants)

| Serviço | Porta | Função |
|---------|-------|--------|
| **Hub** | 3100 | Identidade. Contatos, operações, entidades. Fonte de verdade de "quem é quem". |
| **Media + Switch** | 3002 / 3004 | Storage + processamento. Upload → OCR/transcrição/classificação → armazena resultado. |
| **Tasks Engine** | 3005 | Orquestração. Decide o que fazer, despacha jobs, gerencia inbox HITL. |
| **Chat** | 4000 | WhatsApp. Conversas, TreeFlow (SDR experimental), webhooks Evolution/Cloud API. |

### Lado do Cliente (VPS do cliente)

| Componente | Função |
|------------|--------|
| **Tasks Agent** | Daemon leve. Recebe jobs do Engine via WebSocket, spawna Claude CLI. |
| **Claude CLI** | Roda com Max subscription ou API key do cliente. |
| **Workspace** | Arquivos, CLAUDE.md, scripts, contexto do domínio. |
| **Product Worker** | Event handler determinístico com lógica de negócio (ex: Genesis Worker). |

### Diagrama

```
VPS DO CLIENTE                              VPS NICOLAS (fundação)
┌────────────────────────┐                  ┌─────────────────────────────┐
│                        │                  │                             │
│  Tasks Agent ──────────┼── WSS outbound ─►│  Tasks Engine (:3005)       │
│    │ spawn             │                  │    │                        │
│  Claude CLI            │                  │  Hub (:3100)                │
│  (Max ou BYOK)         │                  │  Media (:3002) + MinIO      │
│                        │                  │  Switch (:3004)             │
│  Workspace             │                  │  Chat (:4000) + Redis       │
│  /root/genesis/        │                  │                             │
│                        │                  │  PostgreSQL (5 databases)   │
│  Product Worker ◄──────┼── webhook ───────│                             │
│  (genesis-protocolo)   │                  │                             │
└────────────────────────┘                  └─────────────────────────────┘
```

**Fase 1 (Genesis):** Tudo na mesma VPS. Separação é lógica, não física.

---

## 2. Comunicação Tasks Engine ↔ Tasks Agent

### Protocolo: WebSocket outbound + streaming

O Agent conecta **de saída** pro Engine (não precisa abrir porta no firewall do cliente).

**Conexão:**
1. Agent lê config de `/etc/vialum/agent.yaml` (engine_url, agent_token, workspace_path)
2. Abre WSS para `wss://tasks.vialum.io/ws/agent` com JWT no header
3. Heartbeat a cada 30s com lista de jobs ativos

**Job dispatch (Engine → Agent):**
```json
{
  "type": "job.dispatch",
  "jobId": "<step_execution_id>",
  "action": "execute_step",
  "payload": {
    "prompt": "...",
    "cwd": "/root/genesis",
    "resumeSessionId": "<uuid ou null>",
    "timeout_ms": 1800000
  }
}
```

**Resposta (Agent → Engine):**
```json
{ "type": "job.transcript", "jobId": "...", "entry": { "kind": "message", "text": "..." } }
{ "type": "job.completed", "jobId": "...", "output": {...}, "usage": { "costUsd": 0.015 } }
```

**Crash recovery:**
- Sem heartbeat por 90s → agent marcado `disconnected`
- Agent reconecta → envia lista de jobs ativos → Engine reconcilia
- Claude CLI continua rodando na VPS do cliente mesmo sem conexão → Agent buffer local, envia quando reconectar

---

## 3. Product Workers (System Steps)

Product Workers são event handlers para lógica de negócio determinística.

**Fluxo:**
1. Tasks Engine chega num step `executor: system`
2. Engine faz POST pro webhook URL do Worker (configurado em `AdapterConfig`)
3. Worker executa (classifica doc, gera PDF, atualiza ClickUp, etc.)
4. Worker chama callback: `POST /tasks/api/v1/events/system-callback`
5. Engine avança workflow

**Step YAML:**
```yaml
- id: gerar_contrato
  executor: system
  adapterType: script
  config:
    webhookUrl: https://genesis-worker.example.com/generate-contract
  inputSchema:
    contactName: { $ref: "$.clientData.contactName" }
    marcas: { $ref: "$.clientData.marcas" }
```

---

## 4. Matriz de Comunicação

| De | Para | Método | Auth | Propósito |
|----|------|--------|------|-----------|
| Tasks Engine | Tasks Agent | WebSocket | Agent JWT | Despachar jobs, receber resultados |
| Tasks Engine | Hub | HTTP | Service JWT | Criar/atualizar contatos, operações |
| Tasks Engine | Chat | HTTP | Service JWT | Enviar mensagens WhatsApp |
| Tasks Engine | Media | HTTP | Service JWT | Upload/download arquivos |
| Tasks Engine | Product Worker | HTTP webhook | X-Webhook-Secret | Despachar system steps |
| Chat | Tasks Engine | HTTP webhook | X-Webhook-Secret | Cliente respondeu (resume awaiting_client) |
| Chat | Hub | HTTP | Service JWT | Sincronizar contatos |
| Chat | Media | HTTP | Service JWT | Persistir mídia do WhatsApp |
| Hub | Tasks Engine | HTTP webhook | X-Webhook-Secret | ClickUp/Pipedrive mudou status |
| Media | Switch | HTTP webhook | X-Webhook-Secret | Arquivo novo → processar |
| Switch | Media | HTTP | Service JWT | Atualizar classificação |
| Product Worker | Tasks Engine | HTTP callback | X-Webhook-Secret | Resultado do system step |
| WhatsApp | Chat | HTTP webhook | HMAC signature | Mensagens incoming |
| Tasks Agent | Claude CLI | spawn local | - | Executar squads |

---

## 5. Onboarding de Tenant

### Fase 1 (Manual — agora)
1. Nicolas cria account (gera `accountId`)
2. Configura providers no Hub (ClickUp, Pipedrive, GDrive)
3. Cria inbox no Chat (WhatsApp)
4. Cria workflow definitions no Tasks (YAML)
5. Instala Tasks Agent na VPS do cliente
6. Deploya Product Worker se necessário

### Fase 3 (Self-service — futuro)
1. Cliente se cadastra no portal
2. Conecta integrações via OAuth
3. Escolhe templates de workflow no marketplace
4. Baixa e instala Tasks Agent (Docker)
5. Configura credenciais Anthropic
6. Roda workflow de teste

---

## 6. Modelo Comercial

### O que cada parte paga

| Nicolas fornece | Cliente fornece |
|-----------------|-----------------|
| Foundation APIs (Hub, Media, Switch, Tasks, Chat) | Assinatura Anthropic (Max ou API key) |
| Tasks Web UI (dashboard, inbox) | VPS própria (para Agent + Claude CLI) |
| Implementação e consultoria | API keys das integrações (ClickUp, Pipedrive, GDrive) |
| Workflow definitions e templates | |

### Pricing

| Tier | Preço | Inclui |
|------|-------|--------|
| **Solo** | R$997/mês | 1 inbox WhatsApp, 3 workflows, 50 execuções/mês, 1 operador |
| **Team** | R$2.497/mês | 3 inboxes, workflows ilimitados, 5 operadores, TreeFlow SDR |
| **Enterprise** | R$4.997+/mês | VPS dedicada, workers custom, SLA, white-label, audit logs |

### Revenue Streams

1. **SaaS mensal** — receita recorrente principal
2. **Implementação** — R$3k-15k one-time (setup workflows, treinar squads, configurar integrações)
3. **Marketplace de workflows** (futuro) — comissão sobre templates vendidos
4. **Marketplace de Product Workers** (futuro) — add-ons de domínio específico

### Estrutura de custo (10 tenants Team)

| Item | Custo |
|------|-------|
| VPS fundação | ~R$1.000/mês |
| Anthropic (uso próprio) | ~R$1.000/mês |
| Domínios + SSL | desprezível |
| **Total** | ~R$2.000/mês |
| **Receita** | R$24.970/mês |
| **Margem** | ~92% |

---

## 7. Estratégia de Negócio

### Mercado-alvo
Empresas brasileiras de serviços com 5-50 funcionários, operação pesada em WhatsApp, workflows de documentos repetitivos. Início: escritórios de PI/marcas.

### Posicionamento

| Concorrente | Diferença do Vialum |
|-------------|---------------------|
| n8n / Make / Zapier | Vialum tem AI nativa (Claude faz o trabalho, não só move dados) + HITL |
| OpenClaw | Vialum é plataforma operacional, não agente individual. Dados conectados. |
| Chatwoot | Vialum Chat é similar mas integrado com workflow engine completa |
| CrewAI / LangGraph | Vialum é pra operadores, não devs. HITL, inbox, YAML, UI. |

### Moat (defesa competitiva)
1. **Grafo de dados operacionais** — Hub conecta tudo. Custo de troca aumenta com profundidade.
2. **Modelo cimento** — AI aprende com HITL, congela em automação. Único no mercado.
3. **HITL compliance** — Humano sempre no loop. Seguro pra Anthropic ToS e pra confiança do cliente.
4. **WhatsApp depth** — No Brasil, WhatsApp É o canal de negócios.

### Crescimento

| Fase | Quando | Meta |
|------|--------|------|
| 1. Genesis operacional | Agora | Provar que funciona internamente |
| 2. Primeiro cliente externo | Mês 3-4 | Provar multi-tenant, aprender onboarding |
| 3. Vertical PI (5-10 firmas) | Mês 6-12 | Templates padronizados, R$15-25k/mês |
| 4. Expansão horizontal | Mês 12-18 | Marketplace, novos verticais, R$50-100k/mês |
| 5. Escala | Mês 18+ | Self-service, LatAm, desenvolvedores terceiros |

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Anthropic muda pricing | BYOK — cliente absorve risco. Max é preço fixo. |
| Anthropic bane por automação | HITL gates. Nunca 100% autônomo. |
| Dependência do Nicolas | Documentar tudo. Padronizar onboarding. Contratar. |
| Concorrência da Anthropic | Anthropic faz tools, não produtos verticais. Vialum é domínio + operação. |

---

## 8. Decisões Arquiteturais

| Decisão | Motivo |
|---------|--------|
| DBs separadas por serviço | Independência de evolução. Migration num serviço não afeta outros. |
| WebSocket pro Agent (não polling/gRPC) | Bidirecional, funciona atrás de NAT, suporte nativo no browser. |
| YAML definitions (não visual builder) | Versionável, diffable, Claude pode gerar/modificar. Visual builder gera YAML por baixo (futuro). |
| Product Workers fora do Tasks | Lógica de negócio muda frequentemente. Fundação muda raramente. Separar previne monolito. |
| accountId em tudo (sem accounts service) | Simplicidade. UUID no JWT. Se precisar de billing, adiciona serviço depois sem refatorar. |
| Agent conecta outbound (não Engine → Agent) | Cliente pode estar atrás de NAT/firewall. Outbound WSS sempre funciona. |
