# Plano de Refatoracao — Vialum Switch Agnostico

> Migrar tudo que é hardcoded para banco de dados, configuravel por tenant via API.
> Data: 2026-03-18 | Status: Aprovado


## Problema

O Switch funciona, mas tem 5 coisas hardcoded no codigo que impedem escalar pra outros tenants/sistemas:

| O que | Onde está | Onde deveria estar |
|----|----|----|
| Regras de auto-processamento (image → ocr+classify) | `webhook.routes.ts` | Banco: `switch_auto_rules` |
| Keywords dos classifiers (RG, CNH, etc) | `classify.ts` | Banco: `switch_classifiers` |
| Strategy (tesseract → gemini fallback) | Cada processor | Banco: `switch_strategies` |
| Gemini API key | `.env` fixo | Banco: `switch_provider_configs` |
| Webhook receiver | Endpoint especifico `/webhooks/media` | Endpoint generico `/webhooks` |


## Etapas

### Etapa 1 — Database (tabelas + migrations)

Criar 4 tabelas no schema do Switch:

```sql
-- 1. Auto-processing rules: quando arquivo chega, o que fazer?
CREATE TABLE switch_auto_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL,
  name         VARCHAR(100) NOT NULL,
  source       VARCHAR(50) NOT NULL DEFAULT '*',    -- media_service | vialum_chat | * (qualquer)
  event        VARCHAR(50) NOT NULL DEFAULT 'file.created',
  mime_pattern VARCHAR(50) NOT NULL,                -- image/* | audio/* | application/pdf | */*
  processors   JSONB NOT NULL,                      -- [{ processor: "ocr" }, { processor: "classify", params: { classifier: "document_type" } }]
  active       BOOLEAN DEFAULT true,
  priority     INTEGER DEFAULT 0,                   -- maior prioridade executa primeiro
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sar_account ON switch_auto_rules(account_id, active);

-- 2. Classifiers: labels + keywords configuraveis por tenant
CREATE TABLE switch_classifiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL,
  name         VARCHAR(100) NOT NULL,               -- document_type | payment_proof | legal_document
  description  TEXT,
  labels       JSONB NOT NULL,                      -- { "RG": { "strong": [...], "weak": [...] }, "CNH": { ... } }
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- 3. Strategies: cadeia de providers por processor por tenant
CREATE TABLE switch_strategies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL,
  processor    VARCHAR(50) NOT NULL,                -- ocr | classify | transcribe
  strategy     JSONB NOT NULL,                      -- [{ provider: "tesseract", minConfidence: 0.8, fallbackOnLow: true }, { provider: "gemini_flash" }]
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, processor)
);

-- 4. Provider configs: credenciais por tenant
CREATE TABLE switch_provider_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL,
  provider     VARCHAR(50) NOT NULL,                -- tesseract | gemini_flash | vialum_transcriber | openai_vision
  credentials  JSONB DEFAULT '{}',                  -- { apiKey: "..." }
  settings     JSONB DEFAULT '{}',                  -- { model: "gemini-2.0-flash-lite", maxTokens: 200, url: "http://..." }
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, provider)
);
```

### Etapa 2 — Seed: migrar dados hardcoded pro banco

Criar seed pra conta Genesis com os dados que hoje estao no codigo:

**Auto-rules:**

```json
[
  { "name": "Imagens → OCR + Classify", "mime_pattern": "image/*", "processors": [
    { "processor": "ocr" },
    { "processor": "classify", "params": { "classifier": "document_type" } }
  ]},
  { "name": "PDFs → OCR + Classify", "mime_pattern": "application/pdf", "processors": [
    { "processor": "ocr" },
    { "processor": "classify", "params": { "classifier": "document_type" } }
  ]},
  { "name": "Audio → Transcribe", "mime_pattern": "audio/*", "processors": [
    { "processor": "transcribe" }
  ]},
  { "name": "Video → Transcribe", "mime_pattern": "video/*", "processors": [
    { "processor": "transcribe" }
  ]}
]
```

**Classifiers:**

```json
{
  "document_type": {
    "RG": { "strong": ["REGISTRO GERAL", "INSTITUTO DE IDENTIFICAÇÃO", "CARTEIRA DE IDENTIDADE"], "weak": ["SECRETARIA DE SEGURANÇA", "FILIAÇÃO", "NATURALIDADE"] },
    "CNH": { "strong": ["CARTEIRA NACIONAL DE HABILITAÇÃO", "PERMISSÃO PARA DIRIGIR"], "weak": ["CATEGORIA", "DETRAN", "RENACH"] },
    "CPF": { "strong": ["CADASTRO DE PESSOAS FÍSICAS", "RECEITA FEDERAL"], "weak": ["MINISTÉRIO DA FAZENDA", "INSCRIÇÃO"] },
    "COMPROVANTE_RESIDENCIA": { "strong": ["CONTA DE ENERGIA", "CONTA DE LUZ", "CONTA DE ÁGUA", "CONTA DE GÁS", "NOTA FISCAL DE ENERGIA", "DANFE", "ENERGIA ELÉTRICA"], "weak": ["FATURA", "VENCIMENTO", "KWH", "CONSUMO", "CEMIG", "COPASA", "SABESP", "CPFL", "ENEL", "ENERGISA", "LEITURA", "MEDIDOR"] },
    "COMPROVANTE_PAGAMENTO": { "strong": ["COMPROVANTE DE TRANSFERÊNCIA", "COMPROVANTE PIX", "TRANSFERÊNCIA EFETUADA", "COMPROVANTE DE PAGAMENTO"], "weak": ["CHAVE PIX", "VALOR DEBITADO", "BANCO", "CÓDIGO DE BARRAS", "PAGADOR", "FAVORECIDO"] },
    "GRU_INPI": { "strong": ["GUIA DE RECOLHIMENTO DA UNIÃO", "GRU SIMPLES", "INSTITUTO NACIONAL DA PROPRIEDADE"], "weak": ["INPI", "CÓDIGO DE RECEITA", "TESOURO NACIONAL"] },
    "CONTRATO": { "strong": ["CONTRATO DE PRESTAÇÃO DE SERVIÇOS", "CLÁUSULA PRIMEIRA"], "weak": ["CONTRATANTE", "CONTRATADO", "FORO", "TESTEMUNHAS"] },
    "PROCURACAO": { "strong": ["PROCURAÇÃO", "OUTORGANTE", "OUTORGADO"], "weak": ["PODERES", "SUBSTABELECER", "INPI"] },
    "CERTIFICADO_PROFISSIONAL": { "strong": ["CERTIFICAMOS QUE", "CERTIFICADO DE CONCLUSÃO"], "weak": ["CARGA HORÁRIA", "APROVEITAMENTO", "CURSO"] }
  },
  "payment_proof": {
    "COMPROVANTE_PIX": { "strong": ["COMPROVANTE PIX", "PIX ENVIADO", "TRANSFERÊNCIA PIX", "PIX REALIZADO"], "weak": ["CHAVE PIX", "BANCO CENTRAL"] },
    "COMPROVANTE_TED": { "strong": ["COMPROVANTE TED", "TRANSFERÊNCIA ENTRE BANCOS"], "weak": ["TED", "DOC"] },
    "BOLETO_PAGO": { "strong": ["COMPROVANTE DE PAGAMENTO DE BOLETO", "BOLETO PAGO"], "weak": ["CÓDIGO DE BARRAS", "LINHA DIGITÁVEL"] },
    "GRU_PAGO": { "strong": ["GRU PAGA", "GUIA DE RECOLHIMENTO"], "weak": ["INPI", "TESOURO"] },
    "NAO_COMPROVANTE": { "strong": [], "weak": [] }
  },
  "signature_check": {
    "ASSINADO": { "strong": ["ASSINADO DIGITALMENTE", "CERTIFICADO DIGITAL", "ASSINATURA ELETRÔNICA", "GOV.BR"], "weak": ["ICP-BRASIL", "HASH", "CARIMBO DO TEMPO"] },
    "NAO_ASSINADO": { "strong": [], "weak": [] }
  }
}
```

**Strategies:**

```json
[
  { "processor": "ocr", "strategy": [
    { "provider": "tesseract", "minConfidence": 0.7, "fallbackOnLow": true },
    { "provider": "gemini_flash", "minConfidence": 0.5, "fallbackOnLow": false }
  ]},
  { "processor": "classify", "strategy": [
    { "provider": "keywords", "minConfidence": 0.7, "fallbackOnLow": true },
    { "provider": "gemini_flash", "minConfidence": 0.5, "fallbackOnLow": false }
  ]},
  { "processor": "transcribe", "strategy": [
    { "provider": "vialum_transcriber", "minConfidence": 0.5, "fallbackOnLow": false }
  ]}
]
```

**Provider configs:**

```json
[
  { "provider": "tesseract", "settings": { "language": "por", "psm": 3 } },
  { "provider": "gemini_flash", "credentials": { "apiKey": "AIza..." }, "settings": { "model": "gemini-2.0-flash-lite" } },
  { "provider": "vialum_transcriber", "settings": { "url": "http://transcriber-api:8000/transcribe" } },
  { "provider": "keywords", "settings": {} }
]
```


### Etapa 3 — Refatorar processors pra ler config do banco

**OCR processor:**

```
ANTES: tesseractOcr() hardcoded → geminiOcr() hardcoded
DEPOIS:
  1. Carregar strategy do banco: switch_strategies WHERE processor='ocr' AND account_id=X
  2. Carregar provider configs do banco
  3. Para cada provider na strategy:
     - Executar
     - Se confidence >= minConfidence → aceitar
     - Se fallbackOnLow → proximo provider
```

**Classify processor:**

```
ANTES: CLASSIFIERS const hardcoded no codigo
DEPOIS:
  1. Carregar classifier do banco: switch_classifiers WHERE name='document_type' AND account_id=X
  2. Carregar strategy do banco
  3. Provider "keywords" usa labels/keywords do banco
  4. Provider "gemini_flash" usa labels do banco no prompt
```

**Transcribe processor:**

```
ANTES: URL do transcriber hardcoded no env
DEPOIS:
  1. Carregar strategy do banco
  2. Provider "vialum_transcriber" lê URL do switch_provider_configs
```

**Interface do provider refatorada:**

```typescript
interface ProcessorProvider {
  readonly name: string;
  process(input: ProcessInput, config: ProviderConfig, classifierData?: ClassifierData): Promise<ProcessResult>;
}

// Registry de providers (separado do registry de processors)
registerProvider('tesseract', new TesseractProvider());
registerProvider('gemini_flash', new GeminiProvider());
registerProvider('keywords', new KeywordsProvider());
registerProvider('vialum_transcriber', new TranscriberProvider());
```


### Etapa 4 — Webhook receiver generico

```
ANTES: POST /webhooks/media (especifico, payload fixo)
DEPOIS: POST /webhooks (generico, qualquer source)

{
  "source": "media_service",        -- quem enviou
  "event": "file.created",          -- o que aconteceu
  "accountId": "uuid",              -- qual tenant
  "data": {                         -- dados do evento
    "id": "file_uuid",
    "mimeType": "image/jpeg",
    ...
  }
}

Switch processa:
  1. Buscar auto_rules WHERE account_id AND (source = body.source OR source = '*')
     AND event = body.event
  2. Filtrar por mime_pattern match
  3. Ordenar por priority
  4. Executar processors listados em cada rule
```


### Etapa 5 — APIs de configuracao

```
-- Auto-rules
GET    /switch/api/v1/config/auto-rules
POST   /switch/api/v1/config/auto-rules
PUT    /switch/api/v1/config/auto-rules/:id
DELETE /switch/api/v1/config/auto-rules/:id

-- Classifiers
GET    /switch/api/v1/config/classifiers
POST   /switch/api/v1/config/classifiers
PUT    /switch/api/v1/config/classifiers/:name
DELETE /switch/api/v1/config/classifiers/:name

-- Strategies
GET    /switch/api/v1/config/strategies
PUT    /switch/api/v1/config/strategies/:processor

-- Provider configs
GET    /switch/api/v1/config/providers
PUT    /switch/api/v1/config/providers/:provider
DELETE /switch/api/v1/config/providers/:provider
```


### Etapa 6 — Testes e validacao


1. Seed Genesis com dados atuais
2. Processar CPF.jpeg → deve dar CPF (como antes)
3. Processar comprovante_residencia.jpeg → deve dar COMPROVANTE_RESIDENCIA
4. Processar PG taxa INPI.jpg → deve dar COMPROVANTE_PAGAMENTO
5. Upload novo arquivo → auto-processing via webhook generico
6. Criar classifier novo via API → processar arquivo com ele
7. Mudar strategy via API → verificar que usa provider diferente


## Etapa 7 — Switch webhook de saida (job.completed)

O Switch precisa notificar outros servicos quando termina um processamento.
Isso é necessario pra fechar o pipeline:

```
Switch processa arquivo
  → Emite webhook job.completed
    → Vialum Chat recebe → salva textContent na mensagem
    → CRM Hub recebe → toma acao (tag PAGO, etc) [story 2.6, nao implementar agora]
```

**Implementacao:**

Tabela `switch_webhook_configs` ja existe no schema. O Switch precisa:

1. Ao completar job (no `processInBackground` e no `POST /process`):
   - Buscar webhook configs do tenant
   - Emitir POST pro URL configurado com payload:
     ```json
     {
       "event": "job.completed",
       "accountId": "uuid",
       "data": {
         "jobId": "uuid",
         "processor": "classify",
         "provider": "keywords",
         "result": { "label": "RG", "confidence": 0.95 },
         "input": { "fileId": "uuid", "mimeType": "image/jpeg" }
       }
     }
     ```

2. API pra configurar webhooks:
   ```
   GET    /switch/api/v1/config/webhooks
   PUT    /switch/api/v1/config/webhooks
   DELETE /switch/api/v1/config/webhooks/:id
   ```


## Etapa 8 — Vialum Chat: media worker + textContent

O Vialum Chat precisa de 2 mudancas pra fechar o pipeline ponta a ponta.
Isso pertence a Fase 2 (infraestrutura) porque sem isso a media do WhatsApp
nunca chega no pipeline.

### 8a. Media download worker (Chat → Media Service)

Quando Vialum Chat recebe mensagem com midia (imagem, audio, documento):

```
webhook-process.worker.ts:
  1. Persiste mensagem normalmente (como hoje)
  2. NOVO: Se contentType != 'text', enfileira job 'media-persist'

media-persist.worker.ts (NOVO):
  1. Recebe { messageId, accountId, contentType, contentAttributes }
  2. Chama Media Service: POST /files/from-whatsapp
     { provider, mediaUrl/mediaId, filename, mimeType,
       context_type: 'conversation', context_id: conversationId }
  3. Atualiza mensagem: contentAttributes.mediaFileId = response.id
```

Resultado: toda media do WhatsApp é persistida no MinIO automaticamente,
e o file.created do Media Service dispara o Switch.

### 8b. textContent (Switch → Chat)

Quando Switch completa processamento e emite webhook job.completed:

```
Vialum Chat recebe webhook job.completed:
  1. Verifica se o fileId tem uma mensagem associada
     (busca por contentAttributes.mediaFileId = fileId)
  2. Se encontrou:
     - processor == 'ocr' ou 'transcribe':
       textContent = "[{contentType}] {result.text}"
     - processor == 'classify':
       Nao atualiza textContent (classificacao vai pro Media Service)
  3. UPDATE messages SET text_content = textContent WHERE id = messageId
```

### Mudancas no Vialum Chat:

```
NOVOS ARQUIVOS:
  src/workers/media-persist.worker.ts     ← persiste media no Media Service
  src/modules/webhooks/switch.webhook.ts  ← recebe job.completed do Switch

ARQUIVOS MODIFICADOS:
  src/workers/webhook-process.worker.ts   ← enfileira media-persist
  prisma/schema.prisma                    ← add text_content ao Message model
  src/workers/index.ts                    ← registrar novo worker
```

### Campo textContent:

```sql
ALTER TABLE messages ADD COLUMN text_content TEXT;
```

Quando a IA (TreeFlow, squad) pede contexto da conversa via
GET /conversations/:id/messages, o response inclui textContent:

```json
{
  "contentType": "audio",
  "content": null,
  "textContent": "[Áudio] Oi, tô mandando os documentos agora..."
}
```

IA monta prompt usando textContent. Todas as mensagens viram texto.


## Etapa 9 — Script compartilhado switch_client.py (Squads)

Criar client Python pro Switch nos scripts compartilhados dos squads:

```
genesis/squads/shared/scripts/switch_client.py

class SwitchClient:
    def classify(self, file_id, classifier="document_type"):
        return self.post("/process", {
            "processor": "classify",
            "input": {"fileId": file_id},
            "params": {"classifier": classifier}
        })

    def ocr(self, file_id):
        return self.post("/process", {
            "processor": "ocr",
            "input": {"fileId": file_id}
        })

    def transcribe(self, file_id):
        return self.post("/process", {
            "processor": "transcribe",
            "input": {"fileId": file_id}
        })
```

Nao é over-engineering — é o client que os squads @documentos e @verificador
vao usar. Sem ele, cada squad reimplementa as chamadas HTTP.


---

## Ordem de execucao

```
SWITCH REFACTOR:
  Etapa 1 (banco)          → 15 min   | Migration + Prisma generate
  Etapa 2 (seed)           → 15 min   | Script SQL com dados Genesis
  Etapa 3 (refatorar)      → 45 min   | Processors leem config do banco
  Etapa 4 (webhook in)     → 15 min   | Receiver generico
  Etapa 5 (APIs config)    → 30 min   | CRUD de configuracao
  Etapa 6 (testes switch)  → 15 min   | Validar Switch funciona

INTEGRACAO:
  Etapa 7 (webhook out)    → 15 min   | Switch emite job.completed
  Etapa 8a (chat media)    → 30 min   | Chat persiste media no Media Service
  Etapa 8b (chat text)     → 20 min   | Chat recebe webhook e salva textContent
  Etapa 9 (squad script)   → 10 min   | switch_client.py

VALIDACAO:
  Etapa 10 (teste e2e)     → 20 min   | WhatsApp → Chat → Media → Switch → Chat (textContent)

TOTAL                      → ~3h45
```


## O que NAO muda

* Endpoint `POST /process` continua igual (mesma interface)
* Processors (ocr, classify, transcribe) continuam existindo
* Switch jobs (audit) continua igual
* JWT auth continua igual
* Dockerfile continua igual (Tesseract instalado)
* Media Service continua igual (so recebe mais uploads do Chat)


## O que NAO entra nesse plano (stories futuras)

* **CRM Hub Action Dispatcher** (story 2.6) — Switch emite webhook mas CRM Hub
  ainda nao age sobre ele. Quando 2.6 for implementada, o webhook ja esta la.
* **Portal Engine** (story 2.7) — Portal vai fazer upload pro Media Service que
  ja dispara o pipeline. Zero mudanca necessaria.
* **Squads completos** (stories 2.8-2.10) — Squads vao usar switch_client.py +
  crm_hub.py + media_service.py. Os scripts estarao prontos.
* **Pipelines encadeados** (v2.0 do Switch) — Arquitetura suporta mas nao implementa.
* **API Keys com permissoes granulares** — PRD preve mas nao é necessario agora.


## Resultado final

```
Pipeline completo funcionando:

WhatsApp msg com foto
  → Vialum Chat recebe
    → media-persist worker persiste no Media Service (MinIO)
      → Media Service emite webhook file.created
        → Switch recebe, auto-processa (OCR + classify)
          → Salva classification no Media Service
          → Emite webhook job.completed
            → Vialum Chat recebe, salva textContent na mensagem
            → [futuro] CRM Hub recebe, toma acao (tag PAGO, etc)

IA pede contexto:
  GET /conversations/:id/messages
  → Ve: "[Imagem: CPF] COMPROVANTE DE INSCRIÇÃO CPF 982.128.349-72 JAIRO OSCAR..."
  → Entende o que o cliente mandou sem precisar ver a imagem

Squad @documentos:
  switch_client.classify(file_id) → "RG" → anexa no ClickUp

Outro tenant (advocacia):
  POST /config/classifiers { name: "legal_document", labels: { PETICAO: {...} } }
  → Mesmo Switch, config diferente, zero codigo novo
```


