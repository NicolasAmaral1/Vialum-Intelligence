# PRD — Vialum Classification Hub

> Hub multi-tenant para classificacao inteligente via APIs externas.
> Nao é apenas documentos — qualquer tipo de classificacao.
> Versao: 1.0.0 | Data: 2026-03-17 | Status: Proposta


---

## 1. Visao

Um servico generico que recebe dados (imagem, texto, PDF, audio) e retorna uma classificacao, delegando o trabalho a **providers** configuraveis por tenant. Hoje classifica documentos brasileiros; amanha pode classificar sentimento, idioma, intencao, spam, categoria de produto — qualquer coisa.


---

## 2. Conceitos

| Conceito | Descricao |
|----|----|
| **Classification** | Uma requisicao de classificacao com input + resultado |
| **Classifier** | Um tipo de classificacao registrado (ex: `document_type`, `payment_proof`, `sentiment`) |
| **Provider** | Um motor que executa a classificacao (ex: `tesseract_keywords`, `gemini_flash`, `openai_vision`) |
| **Strategy** | A ordem em que providers sao tentados (chain of responsibility) |


---

## 3. Arquitetura

```
                     ┌──────────────────────────────────┐
                     │    VIALUM CLASSIFICATION HUB     │
                     │           (Fastify)              │
                     │                                    │
  Qualquer servico → │  POST /classify                    │
                     │    { classifier, input, options }  │
                     │                                    │
                     │  Estrategia por tenant:            │
                     │    1. Tentar provider barato       │
                     │    2. Se low confidence → fallback │
                     │    3. Cachear resultado            │
                     │                                    │
                     └──────┬───────┬───────┬────────────┘
                            │       │       │
                   ┌────────┘       │       └────────┐
                   v                v                v
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │ Tesseract  │  │  Gemini    │  │  OpenAI    │
            │ + Keywords │  │  Flash     │  │  (futuro)  │
            │  (local)   │  │  (API)     │  │            │
            └────────────┘  └────────────┘  └────────────┘
```


---

## 4. API Contracts

### 4.1 Classificar

```
POST /classify/api/v1/classify
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "classifier": "document_type",
  "input": {
    "type": "file",                          // file | text | url
    "fileId": "media_file_uuid",             // referencia ao Media Service
    "fileUrl": "https://s3.../file.jpg",     // OU URL direta
    "text": "texto para classificar"         // OU texto puro
  },
  "options": {
    "providers": ["tesseract_keywords", "gemini_flash"],  // override strategy
    "minConfidence": 0.7,                                  // threshold
    "skipCache": false
  }
}

Response 200:
{
  "id": "cls_uuid",
  "classifier": "document_type",
  "result": {
    "label": "RG",
    "confidence": 0.92,
    "provider": "tesseract_keywords",
    "alternatives": [
      { "label": "CNH", "confidence": 0.05 },
      { "label": "CPF", "confidence": 0.03 }
    ]
  },
  "input": { "type": "file", "fileId": "media_file_uuid" },
  "cached": false,
  "processingTimeMs": 340,
  "createdAt": "2026-03-17T14:30:05Z"
}
```

### 4.2 Classificadores disponiveis

```
GET /classify/api/v1/classifiers
Authorization: Bearer <JWT>

Response 200:
{
  "classifiers": [
    {
      "name": "document_type",
      "description": "Classifica tipo de documento brasileiro",
      "labels": ["RG", "CNH", "CPF", "COMPROVANTE_RESIDENCIA", "CERTIFICADO_PROFISSIONAL",
                 "COMPROVANTE_PAGAMENTO", "GRU_INPI", "CONTRATO", "PROCURACAO", "OUTRO"],
      "inputTypes": ["file", "url"],
      "defaultStrategy": ["tesseract_keywords", "gemini_flash"]
    },
    {
      "name": "payment_proof",
      "description": "Verifica se documento é comprovante de pagamento e extrai dados",
      "labels": ["COMPROVANTE_PIX", "COMPROVANTE_TED", "BOLETO_PAGO", "GRU_PAGO", "NAO_COMPROVANTE"],
      "inputTypes": ["file", "url"],
      "defaultStrategy": ["tesseract_keywords", "gemini_flash"]
    },
    {
      "name": "signature_check",
      "description": "Verifica se documento possui assinatura",
      "labels": ["ASSINADO", "NAO_ASSINADO", "INCONCLUSIVO"],
      "inputTypes": ["file", "url"],
      "defaultStrategy": ["gemini_flash"]
    }
  ]
}
```

### 4.3 Configurar strategy por tenant

```
PUT /classify/api/v1/config/strategies
Authorization: Bearer <JWT>

{
  "classifier": "document_type",
  "strategy": [
    {
      "provider": "tesseract_keywords",
      "minConfidence": 0.8,
      "fallbackOnLow": true
    },
    {
      "provider": "gemini_flash",
      "minConfidence": 0.7,
      "fallbackOnLow": false
    }
  ]
}
```

### 4.4 Configurar provider credentials

```
PUT /classify/api/v1/config/providers/:provider
Authorization: Bearer <JWT>

{
  "provider": "gemini_flash",
  "credentials": {
    "apiKey": "AIza..."
  },
  "settings": {
    "model": "gemini-2.0-flash-lite",
    "maxTokens": 100
  }
}
```


---

## 5. Providers implementados (v1)

### 5.1 `tesseract_keywords` (local, gratis)

* Tesseract OCR extrai texto da imagem
* Keyword matching com pesos (strong=3, weak=1)
* Threshold configuravel
* Suporta classificadores: `document_type`, `payment_proof`

```
Keywords por label (document_type):

RG:
  strong: "REGISTRO GERAL", "INSTITUTO DE IDENTIFICAÇÃO"
  weak:   "SECRETARIA DE SEGURANÇA", "FILIAÇÃO", "NATURALIDADE"

CNH:
  strong: "CARTEIRA NACIONAL DE HABILITAÇÃO", "PERMISSÃO PARA DIRIGIR"
  weak:   "CATEGORIA", "DETRAN", "RENACH"

CPF:
  strong: "CADASTRO DE PESSOAS FÍSICAS", "RECEITA FEDERAL"
  weak:   "MINISTÉRIO DA FAZENDA", "INSCRIÇÃO"

COMPROVANTE_RESIDENCIA:
  strong: "CONTA DE ENERGIA", "CONTA DE LUZ", "CONTA DE ÁGUA"
  weak:   "FATURA", "VENCIMENTO", "kWh", "CONSUMO", "CEMIG", "COPASA",
          "SABESP", "CPFL", "ENEL", "ENERGISA"

CERTIFICADO_PROFISSIONAL:
  strong: "CERTIFICAMOS QUE", "CERTIFICADO DE CONCLUSÃO"
  weak:   "CARGA HORÁRIA", "APROVEITAMENTO", "CURSO"

COMPROVANTE_PAGAMENTO:
  strong: "COMPROVANTE DE TRANSFERÊNCIA", "COMPROVANTE PIX"
  weak:   "TRANSFERÊNCIA REALIZADA", "CHAVE PIX", "51.829.412/0001-70",
          "VALOR DEBITADO", "BANCO"

GRU_INPI:
  strong: "GUIA DE RECOLHIMENTO DA UNIÃO", "GRU"
  weak:   "INPI", "CÓDIGO DE RECEITA", "MINISTÉRIO DA ECONOMIA"
```

### 5.2 `gemini_flash` (API, \~$0.0001/classificacao)

* Google Gemini 2.0 Flash-Lite
* Envia imagem + prompt com labels possiveis
* Retorna label + confidence
* Fallback quando Tesseract tem baixa confianca

Prompt template:

```
Classifique a imagem do documento em UMA das seguintes categorias:
{labels}

Responda SOMENTE em JSON: {"label": "CATEGORIA", "confidence": 0.0-1.0}
```

### 5.3 Providers futuros

| Provider | Uso | Custo |
|----|----|----|
| `mobilenet_bid` | Modelo local treinado no BID Dataset | $0.00 |
| `openai_vision` | Fallback premium | \~$0.01 |
| `claude_vision` | Fallback premium | \~$0.005 |
| `custom_model` | Modelo proprio fine-tuned | $0.00 |


---

## 6. Database (schema `classification` no Postgres compartilhado)

```sql
CREATE TABLE classifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL,
  classifier      VARCHAR(100) NOT NULL,    -- document_type, payment_proof, etc
  input_type      VARCHAR(20) NOT NULL,     -- file, text, url
  input_ref       TEXT,                      -- fileId, URL, ou hash do texto
  result_label    VARCHAR(100),
  result_confidence DECIMAL(3,2),
  result_provider VARCHAR(100),
  result_alternatives JSONB,
  processing_ms   INTEGER,
  cached          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cls_account ON classifications(account_id);
CREATE INDEX idx_cls_lookup ON classifications(account_id, classifier, input_ref);
CREATE INDEX idx_cls_created ON classifications(account_id, created_at DESC);

CREATE TABLE classifier_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  classifier  VARCHAR(100) NOT NULL,
  strategy    JSONB NOT NULL,             -- array de {provider, minConfidence, fallbackOnLow}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, classifier)
);

CREATE TABLE classifier_provider_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL,
  provider    VARCHAR(100) NOT NULL,
  credentials JSONB NOT NULL,             -- encrypted
  settings    JSONB DEFAULT '{}',
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, provider)
);
```


---

## 7. Chain of Responsibility (motor de estrategia)

```
classify(classifier, input, options)
  │
  ├── 1. Check cache (input_ref + classifier)
  │     Se cache hit e nao skipCache → retorna cached
  │
  ├── 2. Load strategy para classifier + accountId
  │     Default: tenant config || classifier default
  │
  ├── 3. Para cada provider na strategy:
  │     ├── Executar classificacao
  │     ├── Se confidence >= minConfidence → ACEITAR, salvar, retornar
  │     ├── Se confidence < minConfidence e fallbackOnLow → PROXIMO provider
  │     └── Se ultimo provider → retornar melhor resultado disponivel
  │
  └── 4. Salvar no banco (audit trail)
```


---

## 8. Integracao com Media Service

Fluxo automatico quando arquivo chega:

```
Media Service recebe arquivo
  → Webhook: file.created { fileId, mimeType, tags, contextType }
  │
  Classification Hub recebe webhook
  │
  ├── mimeType é imagem/PDF?
  │     → Classificar com "document_type"
  │     → Atualizar Media Service: PATCH /files/:id { classification: result }
  │
  ├── tags contem "pagamento" ou "comprovante"?
  │     → Classificar com "payment_proof"
  │
  └── Emitir webhook: classification.completed
      → CRM Hub recebe e toma acao (ex: aplicar tag PAGO no ClickUp)
```


---

## 9. Tech Stack

* **Runtime**: Node.js 20 + Fastify
* **OCR**: node-tesseract-ocr (wrapper do Tesseract CLI)
* **Image processing**: sharp (resize antes de OCR para performance)
* **APIs externas**: Google Generative AI SDK (@google/generative-ai)
* **Database**: PostgreSQL (schema `classification`)
* **ORM**: Prisma
* **Auth**: JWT
* **Container**: Docker, \~256MB memory limit (Tesseract usa mais RAM)
* **Port**: 3004

Dependencia Docker: `tesseract-ocr` + `tesseract-ocr-por` (portugues) instalados na imagem.


---

## 10. Extensibilidade

Para adicionar um novo classificador (ex: `sentiment`):


1. Registrar classifier com labels e input types
2. Implementar logica no provider relevante (ou criar novo provider)
3. Configurar strategy por tenant
4. Pronto — API é a mesma: `POST /classify { classifier: "sentiment", input: { text: "..." } }`

Para adicionar um novo provider (ex: `aws_comprehend`):


1. Implementar interface `ClassificationProvider`
2. Registrar no provider registry
3. Tenants podem incluir na strategy
4. Pronto — chain of responsibility resolve o resto


