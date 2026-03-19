# PRD — Squads do Protocolo Completo

> Squads AIOS para automacao do fluxo de registro de marcas.
> Substitui o PRD-TREEFLOW-PROTOCOLO (TreeFlow adiado para fase futura).
> Versao: 1.0.0 | Data: 2026-03-17 | Status: Proposta


---

## 1. Visao geral

4 squads especializados + 1 supersquad orquestrador.
Cada squad é independente, testavel isoladamente, e invocavel via CLI.
O supersquad monitora o ClickUp e spawna os squads certos no momento certo.

```
@protocolo (supersquad)
  ├── spawna @qualificacao   (coleta dados PF/PJ via WhatsApp)
  ├── spawna @contrato       (gera PDFs — já existe como protocolo-v2)
  ├── spawna @verificador    (verifica assinatura + pagamento)
  └── spawna @documentos     (solicita e recebe docs do cliente)
```


---

## 2. Infraestrutura compartilhada

### 2.1 Custom field novo no ClickUp

| Campo | ID | Tipo | Uso |
|-------|-----|------|-----|
| conversation_id | (a criar) | Texto | ID da conversa no Vialum Chat |

Necessario para que squads leiam/escrevam mensagens na conversa do cliente.

### 2.2 Scripts compartilhados

```
genesis/squads/shared/
├── scripts/
│   ├── vialum_chat.py        # Ler msgs, enviar msgs, obter conversa
│   ├── crm_hub.py            # Identity resolve, ClickUp write ops
│   ├── media_service.py      # Upload, download, get URL
│   └── classification.py     # Classificar documento
└── resources/
    └── config.json           # URLs dos servicos, credentials
```

Cada script é um **client SDK** simples:

```python
# vialum_chat.py

import requests

class VialumChat:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {"X-Api-Key": api_key}

    def send_message(self, phone, content, inbox_id, mode="direct"):
        """Envia mensagem via External API."""
        return requests.post(f"{self.base_url}/chat/api/v1/external/messages",
            headers=self.headers,
            json={"phone": phone, "inboxId": inbox_id,
                  "content": content, "mode": mode})

    def get_messages(self, account_id, conversation_id, limit=10):
        """Lê últimas mensagens de uma conversa."""
        return requests.get(
            f"{self.base_url}/chat/api/v1/accounts/{account_id}/conversations/{conversation_id}/messages",
            headers=self.headers,
            params={"limit": limit, "page": 1})

    def get_new_messages_since(self, account_id, conversation_id, since_timestamp):
        """Retorna mensagens recebidas após timestamp."""
        msgs = self.get_messages(account_id, conversation_id, limit=50)
        return [m for m in msgs.json()["data"]
                if m["createdAt"] > since_timestamp and m["senderType"] == "contact"]
```

```python
# crm_hub.py

class CrmHub:
    def __init__(self, base_url, jwt_token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {jwt_token}"}

    def resolve_identity(self, phone=None, cnpj=None):
        return requests.post(f"{self.base_url}/crm/api/v1/identity/resolve",
            headers=self.headers,
            json={"phone": phone, "cnpj": cnpj})

    def create_clickup_task(self, list_id, name, description, status, custom_fields=None):
        return requests.post(f"{self.base_url}/crm/api/v1/clickup/tasks",
            headers=self.headers,
            json={"listId": list_id, "name": name, "description": description,
                  "status": status, "customFields": custom_fields or []})

    def update_task_status(self, task_id, status):
        return requests.put(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/status",
            headers=self.headers, json={"status": status})

    def add_comment(self, task_id, text):
        return requests.post(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/comments",
            headers=self.headers, json={"text": text})

    def add_attachment(self, task_id, file_url, filename):
        return requests.post(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/attachments",
            headers=self.headers, json={"fileUrl": file_url, "filename": filename})

    def set_custom_field(self, task_id, field_id, value):
        return requests.put(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/custom-fields/{field_id}",
            headers=self.headers, json={"value": value})

    def assign_task(self, task_id, assignee_ids):
        return requests.put(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/assignees",
            headers=self.headers, json={"assigneeIds": assignee_ids})

    def add_tag(self, task_id, tag):
        return requests.post(f"{self.base_url}/crm/api/v1/clickup/tasks/{task_id}/tags",
            headers=self.headers, json={"tag": tag})
```


---

## 3. @qualificacao — Squad de coleta de dados

### 3.1 Estrutura

```
squads/qualificacao/
├── squad.yaml
├── agents/
│   └── qualificacao.md
├── tasks/
│   ├── qualificacao-iniciar.md       # Envia msg inicial + detecta PF/PJ
│   ├── qualificacao-processar.md     # Lê respostas, extrai dados, responde
│   └── qualificacao-follow-up.md     # Envia lembrete se inativo
└── workflows/
    └── coleta-dados.md
```

### 3.2 Agent: @qualificacao

```yaml
slashPrefix: qualificacao
icon: 📋

commands:
  "*iniciar":
    requires:
      - tasks/qualificacao-iniciar.md
    args: "{task_id}"

  "*processar":
    requires:
      - tasks/qualificacao-processar.md
    args: "{task_id}"

  "*follow-up":
    requires:
      - tasks/qualificacao-follow-up.md
    args: "{task_id}"

state:
  fields:
    - task_id
    - conversation_id
    - tipo_pessoa          # PF | PJ
    - dados_coletados      # JSON com campos preenchidos
    - campos_faltantes     # lista de campos ainda nao recebidos
    - ultima_mensagem_at   # timestamp da ultima msg do cliente
    - qualificacao_completa # bool
```

### 3.3 Task: qualificacao-iniciar

```markdown
## Objetivo
Enviar primeira mensagem ao cliente solicitando dados de qualificacao.

## Entrada
- task_id do ClickUp (argumento CLI)

## Passos

1. Ler card do ClickUp via CRM Hub API:
   GET /crm/api/v1/clickup/tasks/{task_id}
   Extrair: nome_marca, nome_cliente, tipo_pessoa, telefone, conversation_id

2. Se conversation_id nao existe:
   - Enviar msg via Vialum Chat External API (mode: direct)
   - Guardar conversation_id retornado
   - Salvar conversation_id no custom field do card

3. Montar mensagem inicial baseada no tipo_pessoa:

   PF:
   "Olá, {nome_cliente}! Para darmos continuidade ao registro da marca
   *{nome_marca}*, precisamos de alguns dados seus:

   - Nome completo
   - CPF
   - RG
   - Nacionalidade
   - Estado civil
   - Profissão
   - Endereço completo com CEP
   - Email

   Pode enviar tudo de uma vez ou aos poucos, como preferir!"

   PJ:
   "Olá, {nome_cliente}! Para o registro da marca *{nome_marca}*,
   precisamos dos dados da empresa e do representante legal:

   *Da empresa:*
   - Razão social
   - CNPJ
   - Endereço da sede

   *Do representante legal:*
   - Nome completo
   - CPF e RG
   - Nacionalidade, estado civil e profissão
   - Endereço de domicílio
   - Email

   Pode enviar como preferir!"

4. Enviar mensagem via script:
   python3 shared/scripts/vialum_chat.py send \
     --phone {telefone} --content "{mensagem}" --mode direct

5. Atualizar card no ClickUp:
   - Custom field conversation_id = {id retornado}
   - Comentario: "📋 Mensagem de coleta de dados enviada ao cliente"

6. Salvar estado: campos_faltantes = lista completa para PF ou PJ
```

### 3.4 Task: qualificacao-processar

```markdown
## Objetivo
Ler novas mensagens do cliente, extrair dados de qualificacao, responder.

## Entrada
- task_id do ClickUp

## Passos

1. Ler card: conversation_id, tipo_pessoa, dados ja coletados (da descricao)

2. Ler mensagens novas via Vialum Chat API:
   GET /conversations/{conversation_id}/messages?limit=20
   Filtrar: senderType == "contact", createdAt > ultima_interacao

3. Se nao ha mensagens novas → SAIR (nada a fazer)

4. ANALISE COM IA (Claude como agente):
   Usando o contexto do tipo_pessoa e campos_faltantes,
   analisar as mensagens do cliente e extrair campos.

   Regras de extracao:
   - CPF: 11 digitos, formato ###.###.###-##
   - CNPJ: 14 digitos, formato ##.###.###/####-##
   - Email: contem @
   - Endereco: rua/av + numero + cidade + estado
   - CEP: 8 digitos, formato #####-###
   - Estado civil: solteiro|casado|divorciado|viuvo|uniao estavel
   - Se cliente mandou tudo junto, extrair todos os campos

5. Atualizar dados_coletados com novos campos extraidos
   Atualizar campos_faltantes removendo os preenchidos

6. Se ainda faltam campos:
   Montar mensagem pedindo APENAS os campos faltantes:
   "Obrigado! Já registrei seus dados. Ainda falta:
   - {campo1}
   - {campo2}
   Pode me enviar?"

   Enviar via Vialum Chat External API

7. Se TODOS os campos foram preenchidos:
   Montar resumo e pedir confirmacao:
   "Perfeito! Confira seus dados:
   Nome: {nome}
   CPF: {cpf}
   ...
   Está tudo correto?"

   Enviar via Vialum Chat External API
   Marcar estado: aguardando_confirmacao = true

8. Se aguardando_confirmacao e cliente respondeu "sim"/"correto"/"ok":
   - qualificacao_completa = true
   - Atualizar descricao do card com todos os dados formatados
   - Comentar no card: "✅ Qualificação completa"
   - NÃO mover o card (o supersquad faz isso)

9. Se cliente respondeu "não"/"corrigir":
   - Perguntar o que quer corrigir
   - Voltar ao passo 4 no proximo ciclo

10. Atualizar card:
    - Custom field ou descricao com dados parciais
    - Comentario se houve interacao
```

### 3.5 Task: qualificacao-follow-up

```markdown
## Objetivo
Enviar lembrete se cliente nao respondeu.

## Regras
- Primeiro follow-up: D+1 apos ultima mensagem
- Demais: a cada 2 dias
- Pular sabados e domingos
- Maximo 5 follow-ups
- Apos 5 follow-ups sem resposta: comentar no card e parar

## Passos

1. Ler card: conversation_id, ultima_mensagem_at, follow_up_count

2. Calcular se é hora de follow-up:
   - Hoje é sabado ou domingo? → SAIR
   - Dias desde ultima mensagem < threshold? → SAIR
   - follow_up_count >= 5? → comentar "⚠️ Cliente não respondeu após 5 tentativas" → SAIR

3. Enviar mensagem:
   "Oi, {nome_cliente}! Passando pra lembrar que precisamos
   dos seus dados para o registro da marca {nome_marca}.
   Precisa de ajuda com alguma coisa?"

4. Atualizar card:
   - follow_up_count += 1
   - ultima_mensagem_at = agora
```


---

## 4. @contrato — Squad de geracao de documentos

**Este squad JA EXISTE como protocolo-v2.** Apenas renomear/registrar.

```yaml
slashPrefix: contrato

commands:
  "*gerar":
    # Usa o pipeline existente do protocolo-v2
    requires:
      - squads/protocolo-v2/tasks/protocolo-validar.md
      - squads/protocolo-v2/tasks/protocolo-gerar.md

  "*enviar":
    requires:
      - tasks/contrato-enviar.md    # NOVO: envia PDFs ao cliente via WhatsApp
```

### 4.1 Task nova: contrato-enviar

```markdown
## Objetivo
Enviar Contrato + Procuracao gerados ao cliente via WhatsApp.

## Passos

1. Ler card: conversation_id, telefone
   Ler arquivos gerados: genesis/outputs/protocolo-v2/Contrato_*.pdf, Procuracao_*.pdf

2. Upload dos PDFs para Media Service:
   POST /media/api/v1/files
   (multipart com cada PDF)
   Guardar file_id de cada um

3. Obter URL pre-assinada:
   GET /media/api/v1/files/{file_id}/url

4. Enviar via Vialum Chat com media:
   (quando media send estiver implementado no worker)
   OU enviar link de download:
   "Aqui estão seus documentos:
   📄 Contrato: {url_contrato}
   📄 Procuração: {url_procuracao}

   Por favor, assine ambos e nos envie de volta.
   Aceitamos assinatura digital (GOV.BR, A1, ClickSign) ou física escaneada."

5. Atualizar card:
   - Anexar PDFs no ClickUp via CRM Hub
   - Mover status: "aguardando assinatura"
   - Comentar: "📄 Contrato e Procuração enviados ao cliente"
```


---

## 5. @verificador — Squad de verificacao

### 5.1 Estrutura

```
squads/verificador/
├── squad.yaml
├── agents/
│   └── verificador.md
├── tasks/
│   ├── verificador-assinatura.md     # Verifica se doc esta assinado
│   └── verificador-pagamento.md      # Detecta comprovante de pagamento
```

### 5.2 Task: verificador-assinatura

```markdown
## Objetivo
Verificar se cliente devolveu documentos assinados.

## Abordagem hibrida: IA + botao manual

### Via IA (tentativa automatica):
1. Ler mensagens recentes do cliente (via Vialum Chat API)
2. Filtrar mensagens com contentType == "document" ou "image"
3. Para cada arquivo recebido:
   - Baixar via Media Service
   - Classificar via Classification Hub: classifier = "signature_check"
   - Se resultado == "ASSINADO" com confidence >= 0.8:
     → Comentar no card: "✅ Documento com assinatura detectada (IA, confiança: X%)"
     → Anexar no ClickUp
   - Se resultado == "INCONCLUSIVO":
     → Comentar: "⚠️ Documento recebido mas assinatura inconclusiva. Verificação manual necessária."

### Via botao manual (fallback):
- Operador verifica documento e aplica tag "ASSINADO" manualmente no ClickUp
- Ou adiciona comentario "@assinado" que o squad detecta

### Deteccao:
1. Card tem tag "ASSINADO"? → assinatura confirmada
2. Card tem comentario contendo "@assinado"? → aplicar tag "ASSINADO"
3. Nenhum dos dois? → aguardar
```

### 5.3 Task: verificador-pagamento

```markdown
## Objetivo
Detectar comprovante de pagamento anexado no ClickUp.

## Passos

1. Ler attachments do card via ClickUp API
2. Para cada attachment:
   - Ja foi classificado? (verificar se tem tag no card com o filename) → pular
   - Baixar arquivo via Media Service (POST /files/from-url)
   - Classificar via Classification Hub: classifier = "payment_proof"
   - Resultados possiveis:
     - COMPROVANTE_PIX / COMPROVANTE_TED / BOLETO_PAGO
       → Aplicar tag "PAGO" no card
       → Comentar: "💰 Comprovante de pagamento detectado ({tipo})"
     - GRU_PAGO
       → Comentar: "📋 GRU INPI detectada (não é pagamento do serviço)"
       → NÃO aplicar tag PAGO
     - NAO_COMPROVANTE
       → Ignorar (pode ser contrato, procuracao, etc)

3. Verificar gate:
   Card tem tag ASSINADO + tag PAGO?
   → Sim: estado gate_liberado = true (supersquad decide o que fazer)
   → Nao: aguardar
```


---

## 6. @documentos — Squad de coleta de documentos

### 6.1 Estrutura

```
squads/documentos/
├── squad.yaml
├── agents/
│   └── documentos.md
├── tasks/
│   ├── documentos-solicitar.md       # Envia msg pedindo docs
│   ├── documentos-processar.md       # Classifica docs recebidos
│   └── documentos-follow-up.md       # Lembrete
```

### 6.2 Task: documentos-solicitar

```markdown
## Objetivo
Solicitar documentos ao cliente via WhatsApp.

## Passos

1. Ler card: conversation_id, tipo_pessoa, nome_cliente, nome_marca

2. Montar mensagem:

   PF:
   "Olá, {nome_cliente}! Recebemos seu contrato assinado e a confirmação
   de pagamento. 🎉

   Para darmos entrada no registro da marca *{nome_marca}* no INPI,
   precisamos dos seguintes documentos:

   📄 Documento de identidade — CNH ou RG (frente e verso) + CPF
   📄 Comprovante de residência atualizado (últimos 3 meses)

   Pode enviar as fotos ou PDFs aqui mesmo!"

   PJ (diferenca):
   "📄 Documento de identidade do representante legal — CNH ou RG + CPF
   📄 Comprovante de residência do representante legal"

3. Enviar via Vialum Chat External API

4. Atualizar card:
   - Comentar: "📄 Documentos solicitados ao cliente"
   - Custom field documentos_inseridos = "" (reset)
```

### 6.3 Task: documentos-processar

```markdown
## Objetivo
Processar documentos enviados pelo cliente via WhatsApp.

## Passos

1. Ler mensagens novas com media (contentType: image, document)
   via Vialum Chat API

2. Para cada arquivo recebido:
   a. Persistir no Media Service:
      POST /media/api/v1/files/from-whatsapp
      (usando mediaUrl/mediaId da mensagem)

   b. Classificar via Classification Hub:
      POST /classify/api/v1/classify
      { classifier: "document_type", input: { fileId: "..." } }

   c. Baseado no resultado:
      - RG ou CNH → marcar doc_identidade = true
      - COMPROVANTE_RESIDENCIA → marcar doc_comprovante = true
      - CERTIFICADO_PROFISSIONAL → marcar doc_certificado = true
      - OUTRO → ignorar, perguntar ao cliente o que é

   d. Anexar no ClickUp via CRM Hub:
      POST /clickup/tasks/{task_id}/attachments
      Comentar: "📎 {tipo_documento} recebido"

3. Verificar checklist:
   - doc_identidade recebido? ✅/❌
   - doc_comprovante recebido? ✅/❌

4. Se falta algo:
   "Obrigado pelo envio! Ainda precisamos de:
   ❌ {documento faltante}
   Pode enviar quando puder!"

5. Se TUDO recebido:
   "Perfeito! Recebemos todos os documentos necessários:
   ✅ Documento de identidade
   ✅ Comprovante de residência

   Vamos preparar tudo para o protocolo junto ao INPI!"

   Marcar: documentos_completos = true
   Atualizar card: custom field documentos_inseridos com lista
   Comentar: "✅ Todos os documentos recebidos e verificados"

6. NÃO mover card (supersquad faz isso)
```

### 6.4 Task: documentos-follow-up

Mesma logica do qualificacao-follow-up: D+1, depois a cada 2 dias, skip weekends, max 5.


---

## 7. @protocolo — Supersquad orquestrador

### 7.1 Estrutura

```
squads/protocolo/
├── squad.yaml
├── agents/
│   └── protocolo.md
├── tasks/
│   └── protocolo-processar.md        # Avalia estado de cada card e spawna squads
```

### 7.2 Agent

```yaml
slashPrefix: protocolo
icon: 🧵

commands:
  "*processar":
    requires:
      - tasks/protocolo-processar.md

  "*status":
    description: "Mostra status de todos os cards em andamento"
```

### 7.3 Task: protocolo-processar

```markdown
## Objetivo
Avaliar o estado de cada card na lista Protocolo e spawnar o squad apropriado.

## Passos

1. Listar todos os cards da lista Protocolo (ID 901322069698)
   que NÃO estejam nos status: "protocolo inpi", "acompanhamento", "completo"
   (esses sao gerenciados manualmente)

2. Para CADA card, avaliar estado e agir:

### Status: "preparação contratual"
   Verificar: card tem qualificacao completa na descricao?
   - NÃO e sem conversation_id:
     → spawna: claude -p "@qualificacao *iniciar {task_id}"
   - NÃO e com conversation_id:
     → Verificar se tem msgs novas do cliente
     → Se sim: spawna: claude -p "@qualificacao *processar {task_id}"
     → Se nao e precisa follow-up: spawna: claude -p "@qualificacao *follow-up {task_id}"
   - SIM (qualificacao completa):
     → spawna: claude -p "@contrato *gerar {task_id}"
     → Quando gerar retorna, spawna: claude -p "@contrato *enviar {task_id}"

### Status: "aguardando assinatura"
   → spawna: claude -p "@verificador *verificar-assinatura {task_id}"
   → spawna: claude -p "@verificador *verificar-pagamento {task_id}"
   → Se gate_liberado (ASSINADO + PAGO):
     → Mover card para "aguardando documentos"
     → spawna: claude -p "@documentos *solicitar {task_id}"

### Status: "aguardando documentos"
   → Verificar msgs novas com media
   → Se sim: spawna: claude -p "@documentos *processar {task_id}"
   → Se precisa follow-up: spawna: claude -p "@documentos *follow-up {task_id}"
   → Se documentos_completos:
     → Mover card para "documentos recebidos"
     → Mover card para "preparação protocolo"
     → Atribuir a contato@avelumia.com via CRM Hub
     → Comentar: "✅ Card pronto para preparação do protocolo INPI"

### Status: "documentos recebidos" / "preparação protocolo"
   → Nada (humano assume)

3. Gerar relatorio final:
   "📊 Processamento concluído:
   - {N} cards em preparação contratual
   - {N} cards aguardando assinatura
   - {N} cards aguardando documentos
   - {N} ações executadas"
```

### 7.4 Invocacao

```bash
# Manual
claude -p "@protocolo *processar" --dangerously-skip-permissions

# Cron (a cada 30 minutos, horario comercial)
*/30 8-18 * * 1-5 cd /path/to/genesis && claude -p "@protocolo *processar" --dangerously-skip-permissions

# Status rapido
claude -p "@protocolo *status" --dangerously-skip-permissions
```


---

## 8. Fluxo completo com squads

```
Portal Engine
  └→ cria card (status: "preparação contratual")
  └→ envia msg inicial via Vialum Chat

@protocolo *processar (cron 30min)
  │
  ├─ Encontra card em "preparação contratual"
  │  └→ @qualificacao *processar {id}
  │      └→ Lê msgs → extrai dados → responde
  │      └→ (ciclos até qualificação completa)
  │
  ├─ Qualificação completa
  │  └→ @contrato *gerar {id}
  │      └→ Gera PDFs (protocolo-v2 engine)
  │  └→ @contrato *enviar {id}
  │      └→ Upload Media Service → envia WhatsApp → anexa ClickUp
  │      └→ Move card: "aguardando assinatura"
  │
  ├─ Encontra card em "aguardando assinatura"
  │  └→ @verificador *verificar-assinatura {id}
  │  └→ @verificador *verificar-pagamento {id}
  │  └→ Gate OK? Move: "aguardando documentos"
  │      └→ @documentos *solicitar {id}
  │
  ├─ Encontra card em "aguardando documentos"
  │  └→ @documentos *processar {id}
  │      └→ Baixa media → classifica → anexa ClickUp
  │      └→ (ciclos até todos docs recebidos)
  │
  └─ Docs completos
     └→ Move: "preparação protocolo"
     └→ Atribui contato@avelumia.com
     └→ Humano assume daqui
```


---

## 9. Registro dos squads

Adicionar ao `genesis/AGENTS.md`:

```markdown
* `@qualificacao` -> `squads/qualificacao/agents/qualificacao.md`
* `@contrato` -> `squads/contrato/agents/contrato.md`
* `@verificador` -> `squads/verificador/agents/verificador.md`
* `@documentos` -> `squads/documentos/agents/documentos.md`
* `@protocolo` -> `squads/protocolo/agents/protocolo.md`
```

Criar arquivos de ativacao em `.claude/commands/AIOS/agents/`:
```
qualificacao.md  → "Read squads/qualificacao/agents/qualificacao.md and assume the persona"
contrato.md      → "Read squads/contrato/agents/contrato.md and assume the persona"
verificador.md   → "Read squads/verificador/agents/verificador.md and assume the persona"
documentos.md    → "Read squads/documentos/agents/documentos.md and assume the persona"
protocolo.md     → "Read squads/protocolo/agents/protocolo.md and assume the persona"
```
