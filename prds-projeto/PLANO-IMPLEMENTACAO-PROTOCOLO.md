# Plano de Implementacao — Protocolo Completo

> Ordem de implementacao priorizada por dependencias.
> Data: 2026-03-17 | Status: Proposta


---

## Visao geral de dependencias

```
                    FASE 1                    FASE 2                    FASE 3
              (Infraestrutura)          (Servicos core)           (Orquestracao)
              ──────────────            ───────────────           ──────────────

              ┌─────────────┐
              │ MinIO Setup │
              └──────┬──────┘
                     │
              ┌──────▼──────┐     ┌─────────────────┐
              │Media Service│────→│Classification Hub│
              └──────┬──────┘     └────────┬────────┘
                     │                     │
              ┌──────▼─────────────────────▼──────┐
              │   CRM Hub v2.1 (write ops +       │
              │   webhooks + action dispatcher)    │
              └──────┬────────────────────────────┘
                     │
              ┌──────▼──────┐     ┌─────────────────┐
              │Portal Engine│     │TreeFlow Defs     │
              └─────────────┘     │(coleta-qualif +  │
                                  │ coleta-docs)     │
                                  └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │Vialum Chat      │
                                  │evoluções (media  │
                                  │download + send)  │
                                  └─────────────────┘

                                          FASE 4
                                     (Integracao E2E)
                                     ────────────────
                                  ┌─────────────────┐
                                  │ Teste end-to-end │
                                  │ Portal → Chat →  │
                                  │ Classify → CRM → │
                                  │ ClickUp → INPI   │
                                  └─────────────────┘
```


---

## FASE 1 — Infraestrutura (sem dependencias)

### 1.1 MinIO Setup

* **Status:** Config criada em `infrastructure/minio/`
* **Acao:** Deploy na VPS

  ```bash
  ssh vps-nova
  cd /opt/vialum/infrastructure/minio
  cp .env.example .env   # editar credenciais
  docker compose up -d
  ./init-buckets.sh
  ```
* **Validacao:** `mc ls vialum/` retorna buckets
* **Tempo estimado:** 30 min

### 1.2 ClickUp — Criar novos status

* **Acao:** Manual no ClickUp (instrucoes abaixo)
* **Validacao:** Lista Protocolo mostra 7 status na ordem correta
* **Tempo estimado:** 10 min


---

## FASE 2 — Servicos core (em paralelo)

### 2.1 Media Service (depende: MinIO)

* **PRD:** `PRD-MEDIA-SERVICE.md`
* **Escopo v1:**
  * Projeto Fastify + Prisma (schema `media`)
  * Endpoints: upload, from-url, from-whatsapp, metadata, pre-signed URL, list by context
  * S3 client com config portavel (MinIO ↔ AWS)
  * Webhook de notificacao (file.created)
  * Docker container
* **Validacao:** Upload arquivo via curl → arquivo aparece no MinIO → GET retorna metadata
* **Dependencias upstream:** MinIO rodando

### 2.2 Classification Hub (depende: Media Service para integracao, mas pode rodar standalone)

* **PRD:** `PRD-CLASSIFICATION-HUB.md`
* **Escopo v1:**
  * Projeto Fastify + Prisma (schema `classification`)
  * Provider: `tesseract_keywords` (OCR + keywords para docs brasileiros)
  * Provider: `gemini_flash` (fallback)
  * Endpoint: POST /classify
  * Chain of responsibility (strategy por tenant)
  * Docker container com Tesseract instalado
* **Validacao:** Enviar foto de RG → retorna `{ label: "RG", confidence: 0.9 }`
* **Pode ser desenvolvido em paralelo ao Media Service**

### 2.3 CRM Hub v2.1 (sem dependencias novas — evolucao do existente)

* **PRD:** `PRD-CRM-HUB-EVOLUCOES.md`
* **Escopo v1:**
  * ClickUp write operations (7 metodos + 7 rotas)
  * Webhook receiver (endpoint generico + normalizer)
  * Action dispatcher (rule engine + execution log)
  * Regras pre-configuradas para Genesis
* **Validacao:** POST criar task no ClickUp via CRM Hub → task aparece no ClickUp
* **Pode ser desenvolvido em paralelo aos outros servicos**


---

## FASE 3 — Orquestracao (depende: Fase 2)

### 3.1 Portal Engine (depende: CRM Hub write ops)

* **PRD:** `PRD-PORTAL-ENGINE.md`
* **Escopo v1:**
  * Projeto Fastify + Prisma (schema `portal`)
  * Form renderer (server-side)
  * Formulario "Novo Faturamento" configurado para Genesis
  * Tracking page (cards do ClickUp)
  * Auth system (portal_users)
  * Actions: criar task no ClickUp, enviar msg no Vialum Chat
  * Docker container
* **Validacao:** Submeter formulario → card criado no ClickUp → msg enviada ao cliente

### 3.2 Vialum Chat — Evolucoes (depende: Media Service)

* **Escopo:**
  * Novo worker: `media-download` (chama Media Service ao receber media)
  * Evolucao `message-send.worker`: suporte a envio de media (Evolution API primeiro)
  * Evolucao `post-processor`: acao de webhook para servicos externos
* **Validacao:** Cliente envia foto → aparece no MinIO → URL permanente no contentAttributes

### 3.3 Squads AIOS (depende: CRM Hub + Media Service + Classification Hub)

* **PRD:** `PRD-SQUADS-PROTOCOLO.md`
* **Escopo:**
  * Scripts compartilhados (vialum_chat.py, crm_hub.py, media_service.py, classification.py)
  * Squad @qualificacao (coleta dados PF/PJ via Vialum Chat API)
  * Squad @contrato (reutiliza protocolo-v2 + envio via WhatsApp)
  * Squad @verificador (assinatura IA + manual, pagamento por classificacao)
  * Squad @documentos (solicita, classifica, anexa)
  * Squad @protocolo (supersquad — monitora ClickUp, spawna squads)
  * Cron na VPS: `*/30 8-18 * * 1-5 @protocolo *processar`
* **Validacao:** @protocolo *processar encontra card → spawna squad correto → acao executada

### 3.4 Custom field no ClickUp

* Criar campo `conversation_id` (tipo Texto) na lista Protocolo
* Necessario para squads lerem/escreverem msgs na conversa do cliente


---

## FASE 4 — Integracao end-to-end

### 4.1 Fluxo completo


 1. Time submete no Portal Engine (faturamento)
 2. Portal cria card no ClickUp (status: preparacao contratual)
 3. Portal envia msg inicial via Vialum Chat External API
 4. @protocolo detecta card → spawna @qualificacao
 5. @qualificacao lê msgs do cliente, extrai dados, responde
 6. (ciclos até qualificação completa)
 7. @protocolo detecta qualificação completa → spawna @contrato
 8. @contrato gera PDFs + envia ao cliente + anexa no ClickUp
 9. Card move para "aguardando assinatura"
10. @verificador verifica assinatura (IA + botao manual)
 9. Tag ASSINADO aplicada
10. Comprovante de pagamento anexado no ClickUp
11. Classification Hub identifica como comprovante → tag PAGO
12. Gate: ASSINADO + PAGO → card move para "aguardando documentos"
13. TreeFlow coleta-documentos inicia
14. Cliente envia docs via WhatsApp
15. Media Service persiste → Classification Hub classifica → CRM Hub anexa no ClickUp
16. Todos docs recebidos → card move para "preparacao protocolo"
17. Responsavel notificado (contato@avelumia.com atribuido)

### 4.2 Testes

* Teste PF (pessoa fisica) completo
* Teste PJ (pessoa juridica) completo
* Teste follow-up (cliente nao responde)
* Teste documento ilegivel (rejeicao + re-envio)
* Teste pagamento antes da assinatura
* Teste pagamento depois da assinatura
* Teste gate parcial (so assinado, so pago)


---

## Docker Compose unificado (VPS)

```yaml
# /opt/vialum/docker-compose.yml
# Todos os servicos do ecossistema Vialum

services:
  # --- Infraestrutura ---
  postgres:
    image: postgres:16-alpine
    container_name: vialum-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${PG_USER:-vialum}
      POSTGRES_PASSWORD: ${PG_PASSWORD:?required}
      POSTGRES_DB: vialum
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks:
      - internal
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    container_name: vialum-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - internal
    deploy:
      resources:
        limits:
          memory: 256M

  minio:
    image: minio/minio:latest
    container_name: vialum-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    networks:
      - internal
      - proxy
    deploy:
      resources:
        limits:
          memory: 256M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.minio-api.rule=Host(`s3.luminai.ia.br`)"
      - "traefik.http.routers.minio-api.entrypoints=websecure"
      - "traefik.http.routers.minio-api.tls.certresolver=le"
      - "traefik.http.services.minio-api.loadbalancer.server.port=9000"

  traefik:
    image: traefik:v3.0
    container_name: vialum-traefik
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=contato@avelumia.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    networks:
      - proxy
    deploy:
      resources:
        limits:
          memory: 64M

  # --- Servicos Vialum ---
  vialum-chat:
    build: ./vialum-chat/api
    container_name: vialum-chat
    restart: unless-stopped
    env_file: ./vialum-chat/.env
    environment:
      DATABASE_URL: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/vialum?schema=chat
      REDIS_URL: redis://redis:6379
      MEDIA_SERVICE_URL: http://vialum-media:3002
    networks:
      - internal
      - proxy
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          memory: 512M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chat.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/chat`)"
      - "traefik.http.routers.chat.entrypoints=websecure"
      - "traefik.http.routers.chat.tls.certresolver=le"
      - "traefik.http.services.chat.loadbalancer.server.port=3000"

  vialum-crm-hub:
    build: ./vialum-crm-hub
    container_name: vialum-crm-hub
    restart: unless-stopped
    env_file: ./vialum-crm-hub/.env
    environment:
      DATABASE_URL: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/vialum?schema=crm
      MEDIA_SERVICE_URL: http://vialum-media:3002
      CLASSIFICATION_HUB_URL: http://vialum-classifier:3004
      VIALUM_CHAT_URL: http://vialum-chat:3000
    networks:
      - internal
      - proxy
    depends_on:
      - postgres
    deploy:
      resources:
        limits:
          memory: 256M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crm.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/crm`)"
      - "traefik.http.routers.crm.entrypoints=websecure"
      - "traefik.http.routers.crm.tls.certresolver=le"
      - "traefik.http.services.crm.loadbalancer.server.port=3001"

  vialum-media:
    build: ./vialum-media
    container_name: vialum-media
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/vialum?schema=media
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      S3_FORCE_PATH_STYLE: "true"
      S3_REGION: us-east-1
      JWT_SECRET: ${JWT_SECRET}
    networks:
      - internal
      - proxy
    depends_on:
      - postgres
      - minio
    deploy:
      resources:
        limits:
          memory: 128M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.media.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/media`)"
      - "traefik.http.routers.media.entrypoints=websecure"
      - "traefik.http.routers.media.tls.certresolver=le"
      - "traefik.http.services.media.loadbalancer.server.port=3002"

  vialum-portal:
    build: ./vialum-portal
    container_name: vialum-portal
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/vialum?schema=portal
      CRM_HUB_URL: http://vialum-crm-hub:3001
      VIALUM_CHAT_URL: http://vialum-chat:3000
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
    networks:
      - internal
      - proxy
    depends_on:
      - postgres
    deploy:
      resources:
        limits:
          memory: 128M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portal.rule=Host(`portal.luminai.ia.br`)"
      - "traefik.http.routers.portal.entrypoints=websecure"
      - "traefik.http.routers.portal.tls.certresolver=le"
      - "traefik.http.services.portal.loadbalancer.server.port=3003"

  vialum-classifier:
    build: ./vialum-classifier
    container_name: vialum-classifier
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/vialum?schema=classification
      MEDIA_SERVICE_URL: http://vialum-media:3002
      JWT_SECRET: ${JWT_SECRET}
    networks:
      - internal
      - proxy
    depends_on:
      - postgres
    deploy:
      resources:
        limits:
          memory: 256M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.classifier.rule=Host(`api.luminai.ia.br`) && PathPrefix(`/classify`)"
      - "traefik.http.routers.classifier.entrypoints=websecure"
      - "traefik.http.routers.classifier.tls.certresolver=le"
      - "traefik.http.services.classifier.loadbalancer.server.port=3004"

volumes:
  pg-data:
  redis-data:
  minio-data:
  traefik-certs:

networks:
  internal:
    driver: bridge
  proxy:
    external: true
```

### Consumo estimado de RAM (16GB VPS)

| Servico | Limite | Idle estimado |
|----|----|----|
| PostgreSQL | 1 GB | \~200 MB |
| Redis | 256 MB | \~30 MB |
| MinIO | 256 MB | \~80 MB |
| Traefik | 64 MB | \~30 MB |
| Vialum Chat | 512 MB | \~150 MB |
| CRM Hub | 256 MB | \~80 MB |
| Media Service | 128 MB | \~50 MB |
| Portal Engine | 128 MB | \~50 MB |
| Classification Hub | 256 MB | \~100 MB |
| **TOTAL** | **2.9 GB** | **\~770 MB** |
| **Livre para OS + picos** | **\~13 GB** |    |

Sobra bastante. Margem confortavel.


---

## Instrucoes — Criar status no ClickUp

### Lista: Protocolo (ID 901322069698)

**Caminho:** Workspace Avelum > Space Genesis > Folder Clientes > Lista Protocolo

### Passos:


1. Abra a lista Protocolo no ClickUp
2. No topo da lista, clique na area de status (onde aparecem as colunas)
3. Clique em "+ Add Status"
4. Adicione os seguintes status **na ordem exata**:

| # | Nome do Status | Cor sugerida | Hex |
|----|----|----|----|
| 1 | `preparação contratual` | Cinza | `#808080` |
| 2 | `aguardando assinatura` | Laranja | `#FFA500` |
| 3 | `aguardando documentos` | Azul | `#4169E1` |
| 4 | `documentos recebidos` | Verde claro | `#90EE90` |
| 5 | `preparação protocolo` | Roxo | `#9370DB` |
| 6 | `protocolo inpi` | Azul steel | `#4682B4` |
| 7 | `acompanhamento` | Amarelo | `#FFD700` |


5. O status `completo` use o status "Closed" padrao do ClickUp (ou crie como Done status)

### Status existentes:

* `contrato + proc` → **MANTER** (protocolo-v2 ainda usa)
* `pagamento & assinatura` → **MANTER** (protocolo-v2 ainda usa)

Eles coexistirao com os novos ate migrarmos completamente. Cards novos usarao os novos status; cards antigos continuam no fluxo atual.

### Verificacao:

Apos criar, a lista deve mostrar todos os status na Board view como colunas na ordem correta.