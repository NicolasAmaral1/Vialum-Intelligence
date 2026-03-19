# PRD — Vialum Switch

> Hub de processamento de media agnostico e multi-tenant.
> Recebe arquivo, roteia pro processor certo, devolve resultado.
> Versao: 1.0.0 | Data: 2026-03-18 | Status: Proposta


---

## 1. O que é

Vialum Switch é um servico que recebe qualquer tipo de media e executa
**processamentos configuraveis** sobre ela. Nao é um classificador. Nao é
um OCR. Nao é um transcritor. É todos eles — e qualquer outro que precisar no futuro.

"Switch" porque roteia: recebe input, decide qual processor usar, delega
pro provider certo, devolve o resultado.


---

## 2. Conceitos

| Conceito | O que é | Exemplo |
|----|----|----|
| **Processor** | Um tipo de processamento | `ocr`, `transcribe`, `classify`, `extract` |
| **Provider** | Um motor que executa o processamento | `tesseract`, `whisper`, `gemini_flash`, `vialum_transcriber` |
| **Strategy** | A cadeia de providers tentados (cheap → expensive) | `[tesseract → gemini_flash]` |
| **Job** | Uma requisicao de processamento com input + resultado | `{ fileId, processor: "ocr" }` |
| **Pipeline** | Sequencia de processors encadeados | `ocr → classify → extract` (futuro) |


---

## 3. Arquitetura

```
Qualquer servico
    │
    │  POST /switch/api/v1/process
    │  { fileId, processor, params }
    │
    ▼
┌──────────────────────────────────────────────┐
│              VIALUM SWITCH                    │
│                                                │
│  1. Validar input (fileId existe? mime ok?)    │
│  2. Resolver strategy do tenant               │
│  3. Executar chain: provider1 → provider2      │
│  4. Cachear resultado                          │
│  5. Salvar no banco (audit)                    │
│  6. Notificar via webhook (opcional)           │
│  7. Retornar resultado                         │
│                                                │
│  Processors:                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ ocr        │ Extrai texto de imagem/PDF  │  │
│  │ transcribe │ Audio/video → texto         │  │
│  │ classify   │ Classifica tipo de media    │  │
│  │ extract    │ Extrai dados estruturados   │  │
│  │ detect     │ Detecta elementos visuais   │  │
│  │ (custom)   │ Qualquer processamento      │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Cada processor → N providers:                 │
│  ┌──────────┬───────────┬──────────────────┐  │
│  │ LOCAL    │ API CHEAP │ API PREMIUM      │  │
│  │ (gratis) │ (~$0.001) │ (~$0.01+)        │  │
│  ├──────────┼───────────┼──────────────────┤  │
│  │tesseract │gemini_lite│ openai_vision    │  │
│  │whisper   │deepgram   │ anthropic_vision │  │
│  │keywords  │gemini_pro │ aws_textract     │  │
│  │regex     │           │                  │  │
│  └──────────┴───────────┴──────────────────┘  │
└──────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   Media Service    Transcriber    APIs externas
   (busca arquivo)  (já existe)    (Gemini, etc)
```


---

## 4. API

### 4.1 Processar (endpoint principal)

```
POST /switch/api/v1/process
Authorization: Bearer <JWT>

{
  "processor": "ocr",                        // obrigatorio
  "input": {
    "fileId": "media-service-uuid",          // referencia ao Media Service
    "fileUrl": "https://...",                 // OU URL direta (um ou outro)
    "text": "texto para processar",           // OU texto puro
    "mimeType": "image/jpeg"                 // obrigatorio se fileUrl
  },
  "params": {                                 // especifico do processor
    "language": "por",                        // OCR: idioma
    "classifier": "document_type",            // classify: qual classificador
    "schema": "payment_proof",                // extract: qual schema
    "format": "srt"                           // transcribe: formato de saida
  },
  "options": {
    "providers": ["tesseract", "gemini"],     // override strategy (opcional)
    "minConfidence": 0.7,                     // threshold (opcional)
    "skipCache": false,                       // pular cache (opcional)
    "timeout": 30000                          // timeout ms (opcional)
  }
}

Response 200:
{
  "id": "job_uuid",
  "processor": "ocr",
  "provider": "tesseract",
  "result": {
    "text": "REGISTRO GERAL\nNome: João da Silva\n...",
    "confidence": 0.87,
    "language": "por",
    "wordCount": 45
  },
  "cached": false,
  "processingMs": 340,
  "createdAt": "2026-03-18T..."
}
```

### 4.2 Processar em batch

```
POST /switch/api/v1/process/batch
Authorization: Bearer <JWT>

{
  "jobs": [
    { "processor": "ocr", "input": { "fileId": "abc" } },
    { "processor": "classify", "input": { "fileId": "abc" }, "params": { "classifier": "document_type" } },
    { "processor": "transcribe", "input": { "fileId": "xyz" } }
  ]
}

Response 200:
{
  "results": [
    { "id": "job1", "processor": "ocr", "result": { ... }, "processingMs": 340 },
    { "id": "job2", "processor": "classify", "result": { ... }, "processingMs": 120 },
    { "id": "job3", "processor": "transcribe", "result": { ... }, "processingMs": 2100 }
  ]
}
```

### 4.3 Buscar resultado (job ja processado)

```
GET /switch/api/v1/jobs/:jobId
Authorization: Bearer <JWT>

Response 200:
{
  "id": "job_uuid",
  "processor": "ocr",
  "provider": "tesseract",
  "status": "completed",
  "result": { ... },
  "input": { "fileId": "abc" },
  "processingMs": 340,
  "createdAt": "2026-03-18T..."
}
```

### 4.4 Listar processors disponiveis

```
GET /switch/api/v1/processors
Authorization: Bearer <JWT>

Response 200:
{
  "processors": [
    {
      "name": "ocr",
      "description": "Extrai texto de imagens e PDFs",
      "supportedMimeTypes": ["image/*", "application/pdf"],
      "inputTypes": ["file", "url"],
      "providers": ["tesseract", "gemini_flash", "google_vision"],
      "defaultStrategy": ["tesseract", "gemini_flash"]
    },
    {
      "name": "transcribe",
      "description": "Transcreve audio e video para texto",
      "supportedMimeTypes": ["audio/*", "video/*"],
      "inputTypes": ["file", "url"],
      "providers": ["vialum_transcriber", "whisper_api"],
      "defaultStrategy": ["vialum_transcriber"]
    },
    {
      "name": "classify",
      "description": "Classifica tipo de media",
      "supportedMimeTypes": ["image/*", "application/pdf"],
      "inputTypes": ["file", "url"],
      "params": {
        "classifier": {
          "required": true,
          "options": ["document_type", "payment_proof", "signature_check"]
        }
      },
      "providers": ["keywords", "gemini_flash"],
      "defaultStrategy": ["keywords", "gemini_flash"]
    },
    {
      "name": "extract",
      "description": "Extrai dados estruturados de documentos",
      "supportedMimeTypes": ["image/*", "application/pdf", "text/*"],
      "inputTypes": ["file", "url", "text"],
      "params": {
        "schema": {
          "required": true,
          "options": ["payment_proof", "identity_document", "address_proof", "custom"]
        }
      },
      "providers": ["regex", "gemini_flash"],
      "defaultStrategy": ["regex", "gemini_flash"]
    }
  ]
}
```

### 4.5 Configurar strategy por tenant

```
PUT /switch/api/v1/config/strategies
Authorization: Bearer <JWT>

{
  "processor": "ocr",
  "strategy": [
    { "provider": "tesseract", "minConfidence": 0.8, "fallbackOnLow": true },
    { "provider": "gemini_flash", "minConfidence": 0.6, "fallbackOnLow": false }
  ]
}
```

### 4.6 Configurar provider credentials

```
PUT /switch/api/v1/config/providers/:provider
Authorization: Bearer <JWT>

{
  "credentials": { "apiKey": "AIza..." },
  "settings": { "model": "gemini-2.0-flash-lite", "maxTokens": 200 }
}
```

### 4.7 Webhook config

```
PUT /switch/api/v1/config/webhooks
Authorization: Bearer <JWT>

{
  "events": ["job.completed"],
  "url": "https://api.luminai.ia.br/crm/api/v1/webhooks/switch",
  "secret": "hmac_secret"
}
```


---

## 5. Processors (v1)

### 5.1 `ocr` — Extrair texto

| Provider | Como funciona | Custo | Precisao |
|----|----|----|----|
| `tesseract` | Tesseract OCR local, idioma `por` | $0.00 | ~80% |
| `gemini_flash` | Gemini 2.0 Flash-Lite, prompt "extraia todo texto" | ~$0.0001 | ~95% |
| `google_vision` | Google Cloud Vision OCR API | $0.0015 | ~97% |

**Output:**
```json
{
  "text": "REGISTRO GERAL\nRepública Federativa do Brasil...",
  "confidence": 0.87,
  "language": "por",
  "wordCount": 45,
  "blocks": [                    // opcional, se provider suportar
    { "text": "REGISTRO GERAL", "bbox": [10, 20, 200, 50] }
  ]
}
```

### 5.2 `transcribe` — Audio/video para texto

| Provider | Como funciona | Custo | Precisao |
|----|----|----|----|
| `vialum_transcriber` | Servico ja rodando na VPS (porta 8787) | $0.00 | ~85% |
| `whisper_api` | OpenAI Whisper API | $0.006/min | ~95% |
| `deepgram` | Deepgram Nova-2 API | $0.0043/min | ~95% |

**Output:**
```json
{
  "text": "Oi, tô mandando os documentos agora...",
  "language": "pt-BR",
  "duration": 12.5,
  "segments": [
    { "start": 0.0, "end": 2.1, "text": "Oi," },
    { "start": 2.1, "end": 5.3, "text": "tô mandando os documentos agora..." }
  ]
}
```

### 5.3 `classify` — Classificar tipo

| Provider | Como funciona | Custo |
|----|----|----|
| `keywords` | OCR (tesseract) + keyword matching com pesos | $0.00 |
| `gemini_flash` | Envia imagem + prompt com labels | ~$0.0001 |

**Classifiers disponiveis:**

**`document_type`:**
```
Labels: RG, CNH, CPF, COMPROVANTE_RESIDENCIA, CERTIFICADO_PROFISSIONAL,
        COMPROVANTE_PAGAMENTO, GRU_INPI, CONTRATO, PROCURACAO, OUTRO
```

**`payment_proof`:**
```
Labels: COMPROVANTE_PIX, COMPROVANTE_TED, BOLETO_PAGO, GRU_PAGO, NAO_COMPROVANTE
```

**`signature_check`:**
```
Labels: ASSINADO, NAO_ASSINADO, INCONCLUSIVO
```

**Output:**
```json
{
  "label": "RG",
  "confidence": 0.92,
  "alternatives": [
    { "label": "CNH", "confidence": 0.05 },
    { "label": "CPF", "confidence": 0.03 }
  ]
}
```

**Keywords por label (provider `keywords`):**

```yaml
RG:
  strong: ["REGISTRO GERAL", "INSTITUTO DE IDENTIFICAÇÃO"]
  weak: ["SECRETARIA DE SEGURANÇA", "FILIAÇÃO", "NATURALIDADE"]

CNH:
  strong: ["CARTEIRA NACIONAL DE HABILITAÇÃO", "PERMISSÃO PARA DIRIGIR"]
  weak: ["CATEGORIA", "DETRAN", "RENACH"]

CPF:
  strong: ["CADASTRO DE PESSOAS FÍSICAS", "RECEITA FEDERAL"]
  weak: ["MINISTÉRIO DA FAZENDA", "INSCRIÇÃO"]

COMPROVANTE_RESIDENCIA:
  strong: ["CONTA DE ENERGIA", "CONTA DE LUZ", "CONTA DE ÁGUA"]
  weak: ["FATURA", "VENCIMENTO", "kWh", "CONSUMO", "CEMIG", "COPASA", "ENEL"]

CERTIFICADO_PROFISSIONAL:
  strong: ["CERTIFICAMOS QUE", "CERTIFICADO DE CONCLUSÃO"]
  weak: ["CARGA HORÁRIA", "APROVEITAMENTO", "CURSO"]

COMPROVANTE_PAGAMENTO:
  strong: ["COMPROVANTE DE TRANSFERÊNCIA", "COMPROVANTE PIX"]
  weak: ["CHAVE PIX", "51.829.412/0001-70", "VALOR DEBITADO", "BANCO"]

GRU_INPI:
  strong: ["GUIA DE RECOLHIMENTO DA UNIÃO", "GRU"]
  weak: ["INPI", "CÓDIGO DE RECEITA", "MINISTÉRIO DA ECONOMIA"]
```

### 5.4 `extract` — Extrair dados estruturados

| Provider | Como funciona | Custo |
|----|----|----|
| `regex` | OCR (tesseract) + regex patterns | $0.00 |
| `gemini_flash` | Envia imagem + schema JSON esperado | ~$0.0002 |

**Schemas:**

**`payment_proof`:**
```json
{
  "type": "PIX|TED|BOLETO",
  "value": 1500.00,
  "date": "2026-03-17",
  "payer": "João da Silva",
  "receiver": "LUAN VIEIRA MENDES LTDA",
  "transactionId": "E123..."
}
```

**`identity_document`:**
```json
{
  "documentType": "RG|CNH|CPF",
  "name": "João da Silva",
  "documentNumber": "12.345.678-9",
  "cpf": "123.456.789-00",
  "birthDate": "1990-01-15",
  "issuer": "SSP/PR"
}
```

**Output:**
```json
{
  "schema": "payment_proof",
  "data": {
    "type": "PIX",
    "value": 1500.00,
    "date": "2026-03-17",
    "payer": "João da Silva"
  },
  "confidence": 0.85,
  "missingFields": ["transactionId"]
}
```


---

## 6. Chain of Responsibility (motor de strategy)

```
process(processor, input, options)
  │
  ├── 1. Validar input (mime type compativel? fileId existe?)
  │
  ├── 2. Check cache (processor + input hash)
  │     Se cache hit e nao skipCache → retorna cached
  │
  ├── 3. Resolver input
  │     fileId → buscar URL no Media Service
  │     fileUrl → usar direto
  │     text → passar direto
  │
  ├── 4. Load strategy
  │     tenant config || processor default
  │
  ├── 5. Para cada provider na strategy:
  │     ├── Provider suporta o mime type? Se nao → SKIP
  │     ├── Executar processamento
  │     ├── Se confidence >= minConfidence → ACEITAR
  │     ├── Se confidence < minConfidence e fallbackOnLow → PROXIMO
  │     └── Se ultimo → retornar melhor resultado
  │
  ├── 6. Salvar job no banco (audit trail)
  │
  ├── 7. Atualizar Media Service (PATCH /files/:id/classification)
  │     (se processor == classify e resultado tem label)
  │
  └── 8. Emitir webhook: job.completed
```


---

## 7. Integracao com servicos existentes

### Media Service → Switch

```
Media Service recebe arquivo (file.created)
  → Webhook para Switch
  → Switch auto-processa baseado em mime type:
      imagem → classify (document_type)
      audio  → transcribe
      video  → transcribe
      pdf    → ocr + classify
```

### Switch → Media Service

```
Switch classifica documento
  → PATCH /media/api/v1/files/:id/classification
  → Media Service salva resultado no registro do arquivo
  → Qualquer servico que buscar o arquivo ja ve a classificacao
```

### Switch → CRM Hub

```
Switch completa job
  → Webhook para CRM Hub
  → CRM Hub Action Dispatcher avalia:
      classify = COMPROVANTE_PAGAMENTO → add tag PAGO
      classify = RG → attach to ClickUp task
```

### Vialum Chat → Switch

```
Cliente manda audio no WhatsApp
  → Vialum Chat persiste no Media Service
  → Chama Switch: POST /process { processor: "transcribe", fileId }
  → Switch retorna texto transcrito
  → Vialum Chat usa texto como input pra TreeFlow/IA
```

### Squads → Switch

```python
# Squad @documentos recebe foto do cliente
result = switch.process(
    processor="classify",
    file_id="abc",
    params={"classifier": "document_type"}
)
# result.label = "RG" → anexa no ClickUp com tag
```


---

## 8. Database

```sql
CREATE TABLE switch_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  processor       VARCHAR(50) NOT NULL,
  provider        VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  input_type      VARCHAR(20) NOT NULL,     -- file, url, text
  input_ref       TEXT,                      -- fileId, URL, ou hash do texto
  input_mime      VARCHAR(100),
  params          JSONB DEFAULT '{}',
  result          JSONB,
  confidence      DECIMAL(3,2),
  processing_ms   INTEGER,
  cached          BOOLEAN DEFAULT false,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sj_account ON switch_jobs(account_id, created_at DESC);
CREATE INDEX idx_sj_cache ON switch_jobs(account_id, processor, input_ref);

CREATE TABLE switch_strategies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  processor   VARCHAR(50) NOT NULL,
  strategy    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, processor)
);

CREATE TABLE switch_provider_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  provider    VARCHAR(50) NOT NULL,
  credentials JSONB NOT NULL,
  settings    JSONB DEFAULT '{}',
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, provider)
);

CREATE TABLE switch_webhook_configs (
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

## 9. Pipelines (futuro)

Encadear processors automaticamente:

```
POST /switch/api/v1/pipelines
{
  "name": "document_intake",
  "steps": [
    { "processor": "ocr", "output": "text" },
    { "processor": "classify", "input": "previous.text", "params": { "classifier": "document_type" } },
    { "processor": "extract", "input": "previous.text", "params": { "schema": "{{previous.result.label}}" } }
  ]
}

// Uso:
POST /switch/api/v1/process
{ "pipeline": "document_intake", "input": { "fileId": "abc" } }

// Resultado:
{
  "steps": [
    { "processor": "ocr", "result": { "text": "REGISTRO GERAL..." } },
    { "processor": "classify", "result": { "label": "RG" } },
    { "processor": "extract", "result": { "data": { "name": "João", "rg": "12.345" } } }
  ]
}
```

Isso nao entra no v1 mas a arquitetura ja suporta.


---

## 10. Tech Stack

| Componente | Tecnologia |
|----|----|
| Runtime | Node.js 20 + Fastify |
| OCR | Tesseract CLI (`tesseract-ocr` + `tesseract-ocr-por`) |
| Image resize | sharp (pre-processamento pra OCR) |
| Transcricao | HTTP call pro vialum_transcriber existente |
| LLM | Google Generative AI SDK (`@google/generative-ai`) |
| Database | PostgreSQL (schema compartilhado) |
| ORM | Prisma |
| Auth | JWT (compartilhado com ecossistema) |
| Container | Docker, ~256MB limit (Tesseract usa RAM) |
| Port | 3004 |

**Dockerfile precisa de:**
```dockerfile
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-por
```


---

## 11. Fases de implementacao

### v1.0 — MVP (o que precisamos pro protocolo)

- Processor `classify` com provider `keywords` (Tesseract + keyword matching)
- Processor `classify` com provider `gemini_flash` (fallback)
- Processor `ocr` com provider `tesseract`
- Chain of responsibility
- Cache por input hash
- Webhook de notificacao
- Multi-tenant
- Integracao com Media Service (busca arquivo por fileId)

### v1.1 — Transcricao

- Processor `transcribe` com provider `vialum_transcriber` (servico existente)
- Auto-processamento de audios recebidos no Vialum Chat

### v1.2 — Extracao

- Processor `extract` com providers `regex` e `gemini_flash`
- Schemas configuraveis por tenant

### v2.0 — Pipelines

- Encadeamento de processors
- Pipeline configuravel por tenant
- Pipeline pre-definidos (document_intake, payment_verification)


---

## 12. Extensibilidade

**Adicionar novo processor:**
1. Criar classe que implementa `Processor` interface
2. Registrar no processor registry
3. Pronto — disponivel via `POST /process { processor: "novo" }`

**Adicionar novo provider:**
1. Criar classe que implementa interface do processor
2. Registrar no provider registry do processor
3. Tenants configuram na strategy
4. Chain of responsibility resolve o resto

**Adicionar novo classifier:**
1. Adicionar labels + keywords no provider `keywords`
2. Pronto — disponivel via `params.classifier = "novo_classifier"`


---

## 13. Texto Universal — Integracao profunda com Vialum Chat

### Problema

Quando a IA lê o contexto de uma conversa, ela vê:

```json
{ "contentType": "text", "content": "Olá, quero registrar minha marca" }
{ "contentType": "audio", "content": null, "contentAttributes": { "mediaId": "xyz" } }
{ "contentType": "image", "content": null, "contentAttributes": { "url": "..." } }
{ "contentType": "document", "content": "comprovante.pdf", "contentAttributes": { "mediaId": "abc" } }
```

A IA só consegue ler a primeira mensagem. As outras 3 são caixas pretas — ela
sabe que existem mas nao sabe o que dizem.

### Solucao: campo `textContent` pre-processado

Toda mensagem de media ganha um campo `textContent` que contem a representacao
em texto daquela media. Esse campo é preenchido automaticamente pelo Switch
no momento que a media é recebida.

```json
{ "contentType": "text", "content": "Olá, quero registrar minha marca", "textContent": "Olá, quero registrar minha marca" }
{ "contentType": "audio", "content": null, "textContent": "[Áudio transcrito] Oi, tô mandando os documentos agora, me diz se tá tudo certo" }
{ "contentType": "image", "content": null, "textContent": "[Imagem: documento RG] REGISTRO GERAL - João da Silva - CPF 123.456.789-00..." }
{ "contentType": "document", "content": "comprovante.pdf", "textContent": "[Documento PDF: comprovante de pagamento] PIX R$ 1.500,00 - 17/03/2026 - João da Silva → LUAN VIEIRA MENDES LTDA" }
```

Agora a IA lê TODAS as mensagens como texto. Ela sabe:
- O que o cliente disse no audio
- O que tem na imagem
- O que contem o PDF

### Fluxo automatico

```
WhatsApp msg com audio chega
  → Vialum Chat persiste no Media Service (file.created)
  → Vialum Chat chama Switch: POST /process { processor: "transcribe", fileId }
  → Switch transcreve: "Oi, tô mandando os documentos..."
  → Vialum Chat salva no campo textContent da mensagem:
      "[Áudio transcrito] Oi, tô mandando os documentos..."
  → Quando IA pede contexto, ve o texto

WhatsApp msg com imagem chega
  → Vialum Chat persiste no Media Service (file.created)
  → Vialum Chat chama Switch: POST /process { processor: "ocr", fileId }
  → Switch extrai: "REGISTRO GERAL João da Silva..."
  → Vialum Chat salva no textContent:
      "[Imagem: documento] REGISTRO GERAL João da Silva..."
  → Em paralelo, Switch classifica: { label: "RG", confidence: 0.95 }
  → Media Service atualiza classification
```

### Mudanca no Vialum Chat

Adicionar campo `text_content` na tabela `messages`:

```sql
ALTER TABLE messages ADD COLUMN text_content TEXT;
```

Novo worker `media-process.worker.ts`:

```typescript
// Quando mensagem de media é criada, enfileira processamento
if (['image', 'audio', 'video', 'document'].includes(contentType)) {
  await mediaProcessQueue.add('process-media', {
    messageId, accountId, fileId, contentType, mimeType,
  });
}

// Worker:
async function processMediaMessage(job) {
  const { messageId, fileId, contentType } = job.data;
  let textContent = '';

  if (['audio'].includes(contentType)) {
    const result = await switchClient.process('transcribe', { fileId });
    textContent = `[Áudio transcrito] ${result.text}`;
  }

  if (['image'].includes(contentType)) {
    const ocr = await switchClient.process('ocr', { fileId });
    textContent = `[Imagem] ${ocr.text}`;
    // Classificar em paralelo
    switchClient.process('classify', { fileId }, { classifier: 'document_type' });
  }

  if (['document'].includes(contentType)) {
    const ocr = await switchClient.process('ocr', { fileId });
    textContent = `[Documento] ${ocr.text}`;
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { textContent },
  });
}
```

### API de contexto (como a IA consome)

Quando a IA (TreeFlow, squad, ou qualquer servico) pede o contexto:

```
GET /chat/api/v1/accounts/:id/conversations/:convId/messages?limit=20

Resposta inclui textContent:
{
  "data": [
    {
      "id": "msg1",
      "contentType": "text",
      "content": "Olá!",
      "textContent": "Olá!",
      "createdAt": "..."
    },
    {
      "id": "msg2",
      "contentType": "audio",
      "content": null,
      "textContent": "[Áudio transcrito] Quero registrar minha marca ACME...",
      "contentAttributes": { "mediaFileId": "file_uuid" },
      "createdAt": "..."
    }
  ]
}
```

A IA monta o prompt usando `textContent` de cada mensagem, ignorando o `contentType`.
Todas as mensagens viram texto. Contexto completo.


---

## 14. Processamento multi-modal (caso juridico e futuros)

### Problema

Um processo juridico pode ser um PDF de 50 paginas contendo:
- Texto corrido (peticao, sentenca)
- Imagens embutidas (provas fotograficas)
- Referencias a audios (prova oral, depoimento)
- Tabelas, graficos

Processar isso nao é um `ocr` simples. É um pipeline multi-modal.

### Solucao: processor `multimodal`

```
POST /switch/api/v1/process
{
  "processor": "multimodal",
  "input": { "fileId": "pdf_processo_uuid" },
  "params": {
    "extractText": true,         // extrair todo texto
    "extractImages": true,        // extrair imagens embutidas
    "processImages": "ocr",       // processar cada imagem extraida
    "transcribeAudio": true,      // se houver audio referenciado
    "outputFormat": "unified_text" // tudo vira um texto continuo
  }
}

Response:
{
  "result": {
    "text": "PETIÇÃO INICIAL\n\n1. Dos Fatos\n[...]\n\n[Imagem Prova 1: Foto do local com danos visiveis no telhado]\n\n[Áudio Depoimento 1: 'Eu estava em casa quando ouvi o barulho...']\n\n2. Do Direito\n[...]",
    "pages": 50,
    "images_extracted": 3,
    "audios_referenced": 1,
    "total_words": 15000
  }
}
```

### Como funciona internamente

O processor `multimodal` é um **orquestrador** que chama outros processors:

```
multimodal(pdf)
  ├── 1. Extrair texto do PDF (lib pdf-parse ou pdfjs)
  ├── 2. Detectar imagens embutidas (extrair como arquivos separados)
  │     Para cada imagem:
  │       ├── Upload no Media Service
  │       └── Chamar processor "ocr" → texto
  ├── 3. Detectar referencias a audio (se houver links/embeds)
  │     Para cada audio:
  │       ├── Download/upload no Media Service
  │       └── Chamar processor "transcribe" → texto
  ├── 4. Montar texto unificado
  │     Intercalar texto original com resultados dos sub-processamentos
  │     Marcar com [Imagem X: ...] e [Áudio X: ...]
  └── 5. Retornar texto completo
```

Isso nao entra no v1 mas a arquitetura de processors ja suporta.
O `multimodal` é so mais um processor que delega pra outros.


---

## 15. Backends plugaveis — Filosofia do Switch

### Principio

O Switch nao faz processamento. Ele **delega**.
Cada provider é um backend plugavel — pode ser:

| Tipo | Exemplo | Quando usar |
|----|----|----|
| **Local** | Tesseract rodando na mesma maquina | Gratis, rapido, sem dependencia |
| **Servico interno** | `vialum_transcriber` (porta 8787) | Servico que voce ja tem rodando |
| **API externa** | Gemini Flash, OpenAI Whisper, Deepgram | Qualidade premium, paga por uso |
| **Modelo local** | MobileNet, Whisper small via Docker | Gratis, precisa de GPU/RAM |
| **Servico customizado** | Qualquer URL que aceite POST | Qualquer coisa que voce queira plugar |

### Registrar novo backend

```
PUT /switch/api/v1/config/backends
Authorization: Bearer <JWT>

{
  "name": "meu_ocr_custom",
  "type": "http",                           // http | local_cli | docker
  "processor": "ocr",                       // qual processor ele serve
  "config": {
    // type: http
    "url": "https://meu-servico.com/ocr",   // endpoint
    "method": "POST",
    "headers": { "X-Api-Key": "..." },
    "inputField": "image_url",              // nome do campo de input
    "outputPath": "result.text",            // jq-like path pro resultado

    // type: local_cli
    "command": "tesseract {{input}} stdout -l por",
    "inputMode": "file",                    // file | stdin

    // type: docker
    "image": "whisper:latest",
    "command": "whisper --model small --language pt {{input}}",
    "gpu": false
  }
}
```

### Tipos de backend

**`http`** — Chama qualquer API via HTTP:
```
Switch recebe job
  → Monta request: POST url { [inputField]: fileUrl }
  → Envia com headers configurados
  → Extrai resultado via outputPath
  → Retorna
```

**`local_cli`** — Executa comando local:
```
Switch recebe job
  → Baixa arquivo pra /tmp
  → Executa: command (com {{input}} substituido)
  → Captura stdout
  → Retorna
```

**`docker`** — Roda container sob demanda (futuro):
```
Switch recebe job
  → docker run image command
  → Captura output
  → Remove container
  → Retorna
```

### Exemplo: plugar servico de transcricao existente

```
PUT /switch/api/v1/config/backends
{
  "name": "vialum_transcriber",
  "type": "http",
  "processor": "transcribe",
  "config": {
    "url": "http://transcriber-api:8000/transcribe",
    "method": "POST",
    "headers": {},
    "inputField": "audio_url",
    "outputPath": "transcription.text"
  }
}
```

Pronto. Agora `vialum_transcriber` aparece como provider disponivel
no processor `transcribe`. Sem codigo novo — so configuracao.

### Exemplo: plugar Gemini Flash como backend

```
PUT /switch/api/v1/config/backends
{
  "name": "gemini_flash",
  "type": "http",
  "processor": "classify",
  "config": {
    "url": "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent",
    "method": "POST",
    "headers": { "x-goog-api-key": "AIza..." },
    "requestTemplate": {
      "contents": [
        { "parts": [
          { "text": "Classifique: {{params.classifier}}. Labels: {{params.labels}}. Responda JSON." },
          { "inline_data": { "mime_type": "{{input.mimeType}}", "data": "{{input.base64}}" } }
        ]}
      ]
    },
    "outputPath": "candidates[0].content.parts[0].text"
  }
}
```

### Composição: o mesmo provider serve vários processors

Um backend genérico como Gemini pode servir OCR, classify, extract — dependendo do prompt. O `requestTemplate` permite configurar prompts diferentes por processor.


---

## 16. Autenticacao e permissoes granulares

### Modelo de acesso

```
Tenant (accountId)
  └── API Keys
       ├── key_admin  → acesso total
       ├── key_chat   → só transcribe + classify (Vialum Chat usa)
       ├── key_squad  → só classify + ocr + extract (squads usam)
       └── key_ext    → só transcribe (cliente externo)
```

### Tabela de API keys

```sql
CREATE TABLE switch_api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  key_hash    VARCHAR(64) NOT NULL,         -- SHA256 da key
  name        VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',  -- { processors: ["ocr", "classify"], providers: ["*"] }
  rate_limit  INTEGER DEFAULT 100,          -- requests por minuto
  active      BOOLEAN DEFAULT true,
  expires_at  TIMESTAMPTZ,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(key_hash)
);
```

### Estrutura de permissoes

```json
{
  "processors": ["ocr", "transcribe", "classify"],  // quais processors pode usar
  "providers": ["*"],                                 // quais providers (* = todos)
  "maxFileSize": 52428800,                            // 50MB max
  "rateLimit": 100,                                   // req/min
  "pipelines": ["document_intake"]                    // quais pipelines (futuro)
}
```

### Autenticacao dupla

O Switch aceita **dois metodos** de autenticacao:

**1. JWT (servicos internos)** — mesmo JWT do ecossistema Vialum:
```
Authorization: Bearer <jwt>
→ Extrai accountId do payload
→ Acesso total (servico interno confiavel)
```

**2. API Key (servicos externos ou isolados)** — granular:
```
X-Switch-Key: sk_live_abc123...
→ Hash SHA256 → lookup na tabela
→ Extrai accountId + permissions
→ Valida: processor permitido? provider permitido? dentro do rate limit?
```

### Exemplo de validacao

```typescript
// Middleware de auth
async function switchAuth(request, reply) {
  const jwt = request.headers.authorization;
  const apiKey = request.headers['x-switch-key'];

  if (jwt) {
    // JWT: acesso total do tenant
    request.switchAuth = { accountId, permissions: { processors: ['*'], providers: ['*'] } };
  } else if (apiKey) {
    // API Key: acesso restrito
    const key = await lookupKey(apiKey);
    if (!key.active || key.expired) throw 401;
    enforceRateLimit(`switch:${key.id}`, key.rateLimit);
    request.switchAuth = { accountId: key.accountId, permissions: key.permissions };
  } else {
    throw 401;
  }
}

// No handler do /process
async function processHandler(request) {
  const { processor } = request.body;
  const { permissions } = request.switchAuth;

  if (!permissions.processors.includes('*') && !permissions.processors.includes(processor)) {
    throw { statusCode: 403, message: `Not authorized to use processor: ${processor}` };
  }

  // Processa...
}
```

### Rotas de gestao de API keys

```
POST   /switch/api/v1/keys                → criar API key (retorna key uma vez so)
GET    /switch/api/v1/keys                → listar keys (sem mostrar a key)
PATCH  /switch/api/v1/keys/:keyId         → atualizar permissoes/rate limit
DELETE /switch/api/v1/keys/:keyId         → revogar key
```

### Logs de uso por key

Cada job registra qual key foi usada:

```sql
ALTER TABLE switch_jobs ADD COLUMN api_key_id UUID REFERENCES switch_api_keys(id);
```

Permite auditoria: "quantas chamadas a key_chat fez hoje?" "qual key está consumindo mais?"
