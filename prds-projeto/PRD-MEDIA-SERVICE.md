# PRD — Vialum Media Service

> Servico multi-tenant para recepcao, persistencia e distribuicao de arquivos.
> Versao: 1.0.0 | Data: 2026-03-17 | Status: Proposta


---

## 1. Problema

O ecossistema Vialum recebe e gera arquivos em multiplos pontos:

* **WhatsApp → Vialum Chat**: Cliente envia fotos de RG, CNH, comprovantes. As URLs do WhatsApp expiram em minutos/horas. Nao existe download nem persistencia.
* **Squad protocolo-v2 → ClickUp/Drive**: PDFs gerados (Contrato, Procuracao) precisam ser enviados ao cliente via WhatsApp e anexados no ClickUp. Hoje o upload é feito direto pelo script Python.
* **Portal → ClickUp**: Formularios podem precisar de anexos no futuro.
* **ClickUp → Sistema**: Comprovantes de pagamento anexados no ClickUp precisam ser lidos e classificados.

Cada sistema resolve (ou nao resolve) isso de forma isolada. Nao existe um ponto central, auditavel e multi-tenant para gerenciar arquivos.


---

## 2. Solucao

Um servico independente que:


1. **Recebe** arquivos de qualquer fonte (upload direto, URL para download, media ID do WhatsApp)
2. **Persiste** em storage S3-compativel (MinIO agora, AWS S3 depois)
3. **Serve** via URLs pre-assinadas (tempo limitado, auditavel)
4. **Organiza** por tenant, data e contexto (conversation, task, deal)
5. **Notifica** outros servicos quando um arquivo é recebido (webhook out)


---

## 3. Arquitetura

```
                    ┌─────────────────────────────┐
                    │      VIALUM MEDIA SERVICE    │
                    │         (Fastify)            │
                    │                               │
  Upload direto ──→ │  POST /files                  │
  URL download ──→  │  POST /files/from-url         │
  WA media ID ──→   │  POST /files/from-whatsapp    │
                    │                               │
                    │  GET  /files/:id              │ ──→ metadata
                    │  GET  /files/:id/url          │ ──→ pre-signed URL
                    │  GET  /files/:id/download     │ ──→ stream (proxy)
                    │                               │
                    │  DELETE /files/:id            │
                    │  GET    /files?context=X      │ ──→ listar por contexto
                    │                               │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │     S3-COMPATIBLE STORAGE      │
                    │  (MinIO local / AWS S3 prod)   │
                    │                               │
                    │  Bucket: vialum-media          │
                    │  Key: {accountId}/{YYYY/MM/DD}/{uuid}/{filename}
                    └───────────────────────────────┘
```


---

## 4. API Contracts

### 4.1 Upload direto

```
POST /media/api/v1/files
Content-Type: multipart/form-data
Authorization: Bearer <JWT>

Fields:
  file: <binary>                          (required)
  context_type: "conversation" | "task" | "deal" | "general"  (required)
  context_id: "conv_abc123"               (optional — link to entity)
  tags: "comprovante,pagamento"           (optional — comma-separated)
  metadata: '{"source":"clickup"}'        (optional — JSON string)

Response 201:
{
  "id": "file_uuid",
  "accountId": "acc_uuid",
  "filename": "comprovante_pix.pdf",
  "mimeType": "application/pdf",
  "size": 245000,
  "storageKey": "acc_uuid/2026/03/17/file_uuid/comprovante_pix.pdf",
  "contextType": "task",
  "contextId": "clickup_task_abc",
  "tags": ["comprovante", "pagamento"],
  "metadata": { "source": "clickup" },
  "createdAt": "2026-03-17T14:30:00Z"
}
```

### 4.2 Download de URL externa

```
POST /media/api/v1/files/from-url
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "url": "https://mmg.whatsapp.net/...",
  "filename": "foto_rg.jpg",           (optional — inferred from URL)
  "headers": { "Authorization": "..." }, (optional — for authenticated URLs)
  "context_type": "conversation",
  "context_id": "conv_abc123",
  "tags": ["documento", "cliente"]
}

Response 201: (same as upload)
```

### 4.3 Download de media do WhatsApp

```
POST /media/api/v1/files/from-whatsapp
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "provider": "evolution_api" | "cloud_api",
  "mediaId": "wamid.xxx",              (Cloud API)
  "mediaUrl": "https://mmg...",         (Evolution API)
  "instanceName": "genesis-wpp",        (Evolution API)
  "accessToken": "EAAx...",             (Cloud API)
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "context_type": "conversation",
  "context_id": "conv_abc123",
  "tags": ["documento"]
}

Response 201: (same as upload)
```

**Logica interna:**

* Evolution API: GET direto na `mediaUrl` (URL temporaria do WhatsApp)
* Cloud API: GET `https://graph.facebook.com/v18.0/{mediaId}` → obtem URL → GET URL com access token

### 4.4 Obter metadata

```
GET /media/api/v1/files/:id
Authorization: Bearer <JWT>

Response 200:
{
  "id": "file_uuid",
  "filename": "foto_rg.jpg",
  "mimeType": "image/jpeg",
  "size": 1240000,
  "tags": ["documento", "rg"],
  "contextType": "conversation",
  "contextId": "conv_abc123",
  "metadata": {},
  "createdAt": "2026-03-17T14:30:00Z",
  "classification": {                   (preenchido pelo Classification Hub)
    "type": "RG",
    "confidence": 0.95,
    "classifiedAt": "2026-03-17T14:30:05Z"
  }
}
```

### 4.5 URL pre-assinada (acesso temporario)

```
GET /media/api/v1/files/:id/url?expires=3600
Authorization: Bearer <JWT>

Response 200:
{
  "url": "https://s3.luminai.ia.br/vialum-media/acc_uuid/2026/...?X-Amz-Signature=...",
  "expiresAt": "2026-03-17T15:30:00Z"
}
```

### 4.6 Listar por contexto

```
GET /media/api/v1/files?context_type=task&context_id=clickup_abc&tags=documento
Authorization: Bearer <JWT>

Response 200:
{
  "files": [ ... ],
  "total": 5
}
```

### 4.7 Webhook de notificacao (saida)

Quando um arquivo é recebido, o Media Service pode notificar outros servicos:

```
POST {webhook_url}
{
  "event": "file.created",
  "accountId": "acc_uuid",
  "data": {
    "fileId": "file_uuid",
    "filename": "foto_rg.jpg",
    "mimeType": "image/jpeg",
    "contextType": "conversation",
    "contextId": "conv_abc123",
    "tags": ["documento"]
  }
}
```

Webhooks configurados por tenant via:

```
PUT /media/api/v1/config/webhooks
{
  "events": ["file.created"],
  "url": "https://api.luminai.ia.br/crm/api/v1/webhooks/media",
  "secret": "hmac_secret"
}
```


---

## 5. Database (schema `media` no Postgres compartilhado)

```sql
CREATE TABLE media_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL,
  filename      VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    BIGINT NOT NULL,
  storage_key   TEXT NOT NULL,          -- S3 key completa
  bucket        VARCHAR(100) NOT NULL DEFAULT 'vialum-media',
  context_type  VARCHAR(50),            -- conversation, task, deal, general
  context_id    VARCHAR(255),           -- ID da entidade relacionada
  tags          TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  classification JSONB,                 -- preenchido pelo Classification Hub
  uploaded_by   VARCHAR(255),           -- user, system, webhook
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ            -- soft delete
);

CREATE INDEX idx_media_account ON media_files(account_id);
CREATE INDEX idx_media_context ON media_files(account_id, context_type, context_id);
CREATE INDEX idx_media_tags ON media_files USING GIN(tags);
CREATE INDEX idx_media_created ON media_files(account_id, created_at DESC);

CREATE TABLE media_webhook_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  events      TEXT[] NOT NULL,
  url         TEXT NOT NULL,
  secret      VARCHAR(255),
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, url)
);
```


---

## 6. Storage Strategy — Portabilidade S3

O servico usa o **AWS SDK v3** (`@aws-sdk/client-s3`) que funciona com qualquer storage S3-compativel:

```typescript
// config/storage.ts
import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,           // MinIO: http://vialum-minio:9000
                                                // AWS:   https://s3.amazonaws.com
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',  // true para MinIO
});
```

**Para migrar de MinIO para AWS S3:**


1. Mudar 4 variáveis de ambiente (endpoint, keys, region, forcePathStyle)
2. Criar buckets no AWS S3 com mesmos nomes
3. Migrar dados com `mc mirror vialum/vialum-media s3/vialum-media`
4. Zero mudanca de codigo


---

## 7. Integracao com Vialum Chat

O Vialum Chat precisa de 2 mudancas:

### 7.1 Ao receber media (webhook-process.worker.ts)

Apos persistir a mensagem com contentAttributes, enfileirar job para Media Service:

```typescript
// Apos criar a mensagem com media
if (['image', 'document', 'video', 'audio'].includes(contentType)) {
  await mediaDownloadQueue.add('download-media', {
    accountId,
    messageId: message.id,
    conversationId,
    provider: inbox.provider,            // 'evolution_api' | 'cloud_api'
    mediaUrl: contentAttributes.url,     // Evolution
    mediaId: contentAttributes.mediaId,  // Cloud API
    filename: contentAttributes.fileName || `${contentType}_${Date.now()}`,
    mimeType: contentAttributes.mimetype,
    instanceName: providerConfig.instanceName,
    accessToken: providerConfig.accessToken,
  });
}
```

Novo worker `media-download.worker.ts`:

```typescript
// Chama Media Service para persistir
const response = await fetch(`${MEDIA_SERVICE_URL}/media/api/v1/files/from-whatsapp`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${serviceJwt}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider,
    mediaUrl, mediaId, instanceName, accessToken,
    filename, mimeType,
    context_type: 'conversation',
    context_id: conversationId,
    tags: ['whatsapp', 'incoming'],
  })
});

// Atualizar mensagem com referencia ao Media Service
await prisma.message.update({
  where: { id: messageId },
  data: {
    contentAttributes: {
      ...existingAttrs,
      mediaFileId: response.id,           // referencia permanente
      mediaUrl: response.storageKey,      // key no S3
    }
  }
});
```

### 7.2 Ao enviar media (message-send.worker.ts)

Adicionar suporte para envio de arquivos:

```typescript
// Se a mensagem tem mediaFileId, obter URL pre-assinada e enviar
if (contentType !== 'text' && contentAttributes?.mediaFileId) {
  const presigned = await getPresignedUrl(contentAttributes.mediaFileId);

  if (provider === 'evolution_api') {
    await sendMediaViaEvolution(config, recipientId, {
      type: contentType,        // image, document, video, audio
      url: presigned.url,
      caption: content,
      filename: contentAttributes.fileName,
      mimeType: contentAttributes.mimetype,
    });
  }
}
```


---

## 8. Multi-Tenancy

* Todas as queries filtram por `account_id`
* Storage keys prefixadas por `accountId`: `{accountId}/2026/03/17/{uuid}/{filename}`
* Webhooks configurados por tenant
* JWT com `accountId` no payload (mesmo padrao do CRM Hub)
* Quotas futuras: max storage por tenant, max file size


---

## 9. Tech Stack

* **Runtime**: Node.js 20 + Fastify
* **Storage**: AWS SDK v3 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
* **Database**: PostgreSQL (schema `media`, Postgres compartilhado)
* **ORM**: Prisma
* **Auth**: JWT (mesmo issuer do ecossistema)
* **Container**: Docker, \~128MB memory limit
* **Port**: 3002


---

## 10. Limites e defaults

| Parametro | Default | Configuravel por tenant |
|----|----|----|
| Max file size | 50MB | Futuro |
| Pre-signed URL TTL | 1 hora | Sim (query param) |
| Max files por contexto | Sem limite | Futuro |
| Retencao | Indefinida | Futuro (lifecycle rules no S3) |
| Webhooks por tenant | 5 | Futuro |


