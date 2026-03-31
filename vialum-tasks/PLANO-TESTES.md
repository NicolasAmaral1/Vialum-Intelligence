# Plano de Testes — Vialum Tasks v2

> **Objetivo:** Testar cada módulo isoladamente e depois o fluxo integrado.
> **Framework:** Vitest (rápido, TypeScript nativo, compatível com ESM).
> **Princípio:** Cada teste deve rodar sem banco de dados e sem processos externos (mock de Prisma e Claude CLI).

---

## 1. Setup

### Instalar dependências
```bash
npm install -D vitest @vitest/coverage-v8
```

### Configurar `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'src/adapters/**'],
    },
  },
});
```

### Script no `package.json`
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 2. Módulos a testar

### 2.1 Schema Validator (`src/engine/schema-validator.ts`)

**Arquivo:** `src/engine/__tests__/schema-validator.test.ts`

| Teste | O que valida |
|-------|-------------|
| valida objeto correto contra schema | `{ tipo: "PF" }` contra `{ type: object, properties: { tipo: { type: string } } }` → valid |
| rejeita campo faltante required | `{}` contra `{ required: ["tipo"] }` → throws |
| rejeita tipo errado | `{ tipo: 123 }` contra `{ tipo: { type: string } }` → throws |
| tryValidateSchema retorna errors sem throw | mesmos cenários mas retorna `{ valid, errors }` |
| schema vazio aceita tudo | `{}` contra `{ type: object }` → valid |
| coerção de tipos | `{ count: "5" }` contra `{ count: { type: number } }` → valid (coerce) |

---

### 2.2 Context Bus (`src/engine/__tests__/context-bus.test.ts`)

**Já existe com 14 testes.** Migrar de script manual pra Vitest e adicionar:

| Teste | O que valida |
|-------|-------------|
| (existentes) | create, writeOutput, resolveInput, renderPrompt, persist/hydrate, get |
| resolveInput com $ref aninhado | `$.stepOutputs.step1.dados.endereco.rua` → resolve 3 níveis |
| writeOutput sem schema não valida | `writeOutput('x', { any: 'data' })` → aceita |
| renderPrompt com stepOutputs shorthand | `{{stepOutputs.step1.tipo}}` → resolve |
| renderPrompt com refs | `{{refs.contactPhone}}` → resolve |
| setVariable e getVariable | set 'x' = 1, get 'x' → 1 |
| setRef | setRef('externalTaskId', '123'), snapshot.refs.externalTaskId → '123' |
| hydrate com dados parciais | `{ workflowId, accountId }` sem stepOutputs → inicializa vazio |
| persist é deep clone | modificar output depois de persist não altera o persistido |

---

### 2.3 Condition Evaluator (`src/engine/__tests__/condition-evaluator.test.ts`)

**Arquivo:** `src/engine/__tests__/condition-evaluator.test.ts`

| Teste | O que valida |
|-------|-------------|
| null/undefined/empty retorna true | Sem condição = sempre executa |
| comparação string | `$.clientData.tipo == 'PF'` → true se tipo é PF |
| comparação numérica | `$.variables.tentativa < 3` → true se tentativa é 2 |
| acesso a stepOutputs | `$.stepOutputs.step1.completo == true` → resolve |
| acesso a array length | `$.stepOutputs.step1.faltantes.length > 0` → resolve |
| path inexistente → false | `$.stepOutputs.inexistente.campo == 'x'` → false (não crasha) |
| expressão inválida → false + warning | `!!!` → false, console.warn |
| evaluateTransitions: primeira match ganha | 3 transitions, segunda match → retorna target da segunda |
| evaluateTransitions: default como fallback | nenhuma condition match → retorna default |
| evaluateTransitions: sem match sem default → null | nenhuma match → null |
| evaluateTransitions: transition sem condition → sempre match | `{ target: 'x' }` sem condition → retorna 'x' |
| evaluateTransitions: acessa $.output | `$.output.tipo == 'PF'` → resolve do stepOutput passado |

---

### 2.4 Definition Parser (`src/engine/__tests__/definition-parser.test.ts`)

**Arquivo:** `src/engine/__tests__/definition-parser.test.ts`

| Teste | O que valida |
|-------|-------------|
| parseia YAML mínimo válido | slug, name, 1 stage, 1 task, 1 step → ok |
| parseia YAML completo com todos os campos | transitions, waitConfig, followUp, onComplete, etc. |
| rejeita YAML sem slug | throws "slug is required" |
| rejeita YAML sem stages | throws "at least one stage" |
| rejeita stage sem tasks | throws "at least one task" |
| rejeita task sem steps | throws "at least one step" |
| rejeita step sem executor | throws "executor is required" |
| rejeita executor inválido | executor: "robot" → throws |
| default adapterType por executor | ai→squad, human→human, system→script, client→wait |
| adapterType explícito override | executor: ai, adapterType: sdk → sdk |
| transition target inexistente rejeita | target: "nao_existe" → throws |
| transition target em outro stage aceita | target aponta pra step em stage diferente → ok |
| position default do index | sem position → usa index+1 |
| parseia waitConfig | channel, treeFlowSlug, followUp.intervals |
| parseia onComplete | [{ set: "x", value: "$.variables.x + 1" }] |
| parseia transitions | [{ condition: "...", target: "..." }, { default: true, target: "..." }] |

---

### 2.5 Transcript Parser (`src/adapters/squad/__tests__/transcript-parser.test.ts`)

**Arquivo:** `src/adapters/squad/__tests__/transcript-parser.test.ts`

| Teste | O que valida |
|-------|-------------|
| parseia system init | `{ type: "system", session_id: "abc" }` → kind: init, capturedSessionId |
| parseia assistant message | `{ type: "assistant", message: { content: [{ type: "text", text: "Olá" }] } }` → kind: message |
| parseia thinking block | `{ type: "assistant", message: { content: [{ type: "thinking", text: "..." }] } }` → kind: thinking |
| parseia tool_use | `{ type: "tool_use", tool_name: "Bash", tool_input: "ls" }` → kind: tool_call |
| parseia tool_result | `{ type: "tool_result", tool_name: "Bash", tool_result: "file.txt" }` → kind: tool_result |
| parseia result com cost | `{ type: "result", usage: { input_tokens: 100 }, cost_usd: 0.01 }` → kind: cost |
| parseia error | `{ type: "error", error: "something broke" }` → kind: error |
| filtra Read/Glob/Grep como não significante | tool_use com name "Read" → isSignificant: false |
| MCP tools são significantes | tool_use com name "mcp__xxx" → isSignificant: true |
| trunca tool_result longo | result com 5000 chars → truncado a 2000 |
| JSON inválido retorna null | "not json" → null |
| linha vazia retorna null | "" → null |
| **TranscriptParser (buffered):** | |
| feed com linha completa | feed("{ ... }\n") → 1 resultado |
| feed com linha incompleta | feed('{ "type":') → 0 resultados (bufferizado) |
| feed com continuação | feed('"}') + feed('\n') → 1 resultado reconstruído |
| feed com múltiplas linhas | feed("line1\nline2\n") → 2 resultados |
| flush retorna buffer restante | feed('{ ... }') sem \n → flush() → 1 resultado |

---

### 2.6 Adapter Registry (`src/adapters/__tests__/adapter-registry.test.ts`)

**Arquivo:** `src/adapters/__tests__/adapter-registry.test.ts`

| Teste | O que valida |
|-------|-------------|
| registerAdapter + getAdapter | registra mock → get retorna mesmo adapter |
| getAdapter com type inexistente throws | getAdapter('xxx') → throws |
| registerAdapter duplicado throws | registrar mesmo type 2x → throws |
| listAdapterTypes retorna registrados | registra 2 → listAdapterTypes retorna ['a', 'b'] |

---

### 2.7 Execution Engine (`src/engine/__tests__/execution-engine.test.ts`)

**Este é o mais complexo.** Precisa de mocks para:
- **Prisma** (mock de todas as queries)
- **Adapter** (mock do SquadAdapter)
- **WebSocket** (mock de broadcastToWorkflow/broadcastToAccount)

**Arquivo:** `src/engine/__tests__/execution-engine.test.ts`

#### Grupo: createWorkflow

| Teste | O que valida |
|-------|-------------|
| cria workflow com stages/tasks/steps | definition v2 → verifica que cria N stages, N tasks, N steps no DB |
| valida clientData contra dataSchema | clientData inválido → throws |
| rejeita definition não-v2 | definition_format: 'legacy' → throws |
| rejeita tenant diferente | accountId da definition ≠ accountId do request → throws |
| idempotencyKey funciona | cria com mesma key 2x → segundo falha (unique constraint) |
| FIX #8: rejeita workflow duplicado pro mesmo contato | contactPhone com workflow ativo → throws |

#### Grupo: startWorkflow

| Teste | O que valida |
|-------|-------------|
| marca workflow como running | status idle → running, startedAt setado |
| ativa primeiro stage e task | primeiro stage e task → status 'active' |
| workflow sem steps → completa direto | 0 steps → status 'completed' |

#### Grupo: runStep — executor: ai

| Teste | O que valida |
|-------|-------------|
| chama adapter.executeStep com prompt renderizado | verifica que adapter recebe prompt com {{key}} resolvidos |
| escreve output no context bus | adapter retorna { tipo: 'PF' } → bus.stepOutputs.step1.tipo === 'PF' |
| cria StepExecution com métricas | execution row com inputTokens, costUsd, durationMs |
| cria CostEvent | cost_events row com dados do usage |
| atualiza totalCostUsd no workflow | workflow.totalCostUsd incrementa |
| FIX #7: squad com schema mismatch → warning, não falha | output não bate schema → step completa com warning |
| FIX #7: sdk com schema mismatch → falha | output não bate schema → step falha |
| FIX #4: allowCheckpoints + _checkpoint → pausa | output com _checkpoint → cria InboxItem type checkpoint |

#### Grupo: runStep — executor: human

| Teste | O que valida |
|-------|-------------|
| cria InboxItem com inputData e outputSchema | verifica campos do inbox item |
| step fica awaiting_human | step.status === 'awaiting_human' |
| pausa sessão squad se ativa | adapter.pauseSession chamado |
| FIX #6: não cria inbox duplicado | segundo call não cria outro item |
| agenda follow-ups | followUp.intervals → N scheduledJob rows |
| agenda timeout | timeoutMs → 1 scheduledJob row type timeout |

#### Grupo: runStep — executor: client

| Teste | O que valida |
|-------|-------------|
| step fica awaiting_client | step.status === 'awaiting_client' |
| pausa sessão squad se ativa | adapter.pauseSession chamado |
| agenda follow-ups e timeout | scheduledJob rows criadas |

#### Grupo: runStep — executor: system

| Teste | O que valida |
|-------|-------------|
| completa com output vazio (TODO) | step.status === 'completed' |

#### Grupo: runStep — conditions

| Teste | O que valida |
|-------|-------------|
| condition false → skip | step com condition que avalia false → status 'skipped' |
| condition true → executa | step com condition true → executa normalmente |

#### Grupo: advanceToNext — linear

| Teste | O que valida |
|-------|-------------|
| avança pro próximo step por position | step 1 completa → step 2 roda |
| task completa quando todos steps completam | último step completa → task.status 'completed' |
| stage completa quando todas tasks completam | última task completa → stage.status 'completed' |
| workflow completa quando todos stages completam | último stage completa → workflow.status 'completed' |
| end session quando task completa | adapter.endSession chamado |

#### Grupo: advanceToNext — transitions (grafo)

| Teste | O que valida |
|-------|-------------|
| transition com condition match → pula pra target | step1 → condition true → step3 (pula step2) |
| transition default → fallback | nenhuma condition match → vai pro default |
| transition sem match → linear fallback | transitions definidas mas nenhuma match → próximo por position |
| FIX #2: cross-task transition | step em task1 → transition pra step em task2 → task1 completa, task2 ativa |
| FIX #2: cross-stage transition | step em stage1 → transition pra step em stage2 → stage1 completa, stage2 ativa |
| FIX #2: steps pulados → skipped | transition pula steps → ficam 'skipped' |
| FIX #3: loop back reseta step | transition pra step já completed → reseta pra pending |

#### Grupo: onInboxCompleted

| Teste | O que valida |
|-------|-------------|
| escreve outputData no context bus | humano submete → bus.stepOutputs.step1 === outputData |
| avança pro próximo step | step humano completa → próximo step roda |
| cancela scheduled jobs | follow-ups e timeout cancelados |
| rejeita item já completado | item.status !== 'pending' → throws |

#### Grupo: onClientResponded

| Teste | O que valida |
|-------|-------------|
| escreve dados do cliente no context bus | Talk completa → bus atualiza |
| avança pro próximo step | step client completa → próximo roda |
| cancela scheduled jobs | follow-ups cancelados |

#### Grupo: onCheckpointCompleted (FIX #4)

| Teste | O que valida |
|-------|-------------|
| resume squad com prompt contendo resposta humana | adapter.resumeSession + executeStep chamados com prompt correto |
| checkpoint encadeado | segundo _checkpoint → outro inbox item |
| checkpoint resolve → step completa | output sem _checkpoint → completeStep |

#### Grupo: handleStepFailure

| Teste | O que valida |
|-------|-------------|
| retry se retryCount < maxRetries | step falha → retryCount incrementa → runStep de novo |
| onFailure: jump pro target | retry esgotado + onFailure → advanceToStepByDefId |
| fail workflow se sem onFailure | retry esgotado + sem onFailure → workflow.status 'failed' |

#### Grupo: onStepTimeout

| Teste | O que valida |
|-------|-------------|
| onTimeout: jump pro target | timeout com onTimeout → avança pro step target |
| fail workflow se sem onTimeout | timeout sem onTimeout → workflow falha |
| cancela jobs e dismisses inbox | scheduledJobs cancelados, inbox items dismissed |

#### Grupo: recoverStaleSteps (FIX #5)

| Teste | O que valida |
|-------|-------------|
| marca sessões active como orphaned | sessions active neste node → orphaned |
| reseta steps running pra pending | steps running → pending com retryCount++ |
| retoma workflows parados | workflow running sem step ativo → resume |

#### Grupo: applyOnComplete

| Teste | O que valida |
|-------|-------------|
| set variável com math | `{ set: "x", value: "$.variables.x + 1" }` → x incrementa |
| set variável com now() | `{ set: "ts", value: "now()" }` → ISO string |
| set variável com string literal | `{ set: "s", value: "hello" }` → "hello" |
| expressão insegura não executa | `{ set: "x", value: "process.exit(1)" }` → guarda como string, não executa |

#### Grupo: buildResumePrompt

| Teste | O que valida |
|-------|-------------|
| sem steps intermediários → prompt original | nenhum stepOutput novo → prompt intacto |
| com steps intermediários → adiciona catch-up | stepOutputs novos → prompt inclui summary |

#### Grupo: session management (FIX #1)

| Teste | O que valida |
|-------|-------------|
| sessionKey usa taskId:adapterType | sessionKey('t1', 'squad') === 't1:squad' |
| steps de adapters diferentes não compartilham sessão | step sdk → step squad → sessões separadas |
| pauseSessionIfActive pausa todos os adapters da task | 2 sessões na task → ambas pausadas |
| endSessionsForTask encerra e limpa map | sessões removidas do map |

---

## 3. Mocks necessários

### Mock de Prisma (`src/__mocks__/prisma.ts`)

```typescript
// Factory que cria um mock de PrismaClient com:
// - Todas as tabelas como objetos com findUnique, findFirst, findMany, create, update, updateMany, count
// - Cada método é vi.fn() que pode ser configurado por teste
// - $transaction executa a callback com o próprio mock
```

### Mock de WebSocket (`src/__mocks__/websocket.ts`)

```typescript
// Mock de broadcastToAccount e broadcastToWorkflow
// Captura todas as chamadas pra verificar que os eventos corretos foram emitidos
```

### Mock de Adapter (`src/__mocks__/adapter.ts`)

```typescript
// MockAdapter que implementa SessionAwareAdapter
// Cada método é vi.fn() configurável por teste
// executeStep retorna StepResult configurável
// startSession retorna SessionHandle configurável
```

---

## 4. Ordem de implementação

| # | Arquivo de teste | Depende de | Complexidade |
|---|-----------------|------------|-------------|
| 1 | schema-validator.test.ts | Nada (pure function) | Baixa |
| 2 | context-bus.test.ts | Nada (pure class) | Baixa (migrar existente + adicionar) |
| 3 | condition-evaluator.test.ts | Nada (pure function) | Baixa |
| 4 | definition-parser.test.ts | Nada (pure function + js-yaml) | Média |
| 5 | transcript-parser.test.ts | Nada (pure function) | Baixa |
| 6 | adapter-registry.test.ts | Nada (pure class) | Baixa |
| 7 | execution-engine.test.ts | Mocks de Prisma, Adapter, WS | Alta |

**Testes 1-6 são pure functions/classes — sem mocks, rápidos.**
**Teste 7 é o integrado — precisa de setup de mocks mas cobre o fluxo completo.**

---

## 5. Comandos

```bash
# Rodar todos
npm test

# Rodar um módulo específico
npx vitest run src/engine/__tests__/context-bus.test.ts

# Watch mode (desenvolvimento)
npx vitest src/engine/__tests__/

# Coverage
npm run test:coverage
```

---

## 6. Critério de aceitação

- [ ] Todos os testes passam (`npm test` → 0 failures)
- [ ] Coverage mínimo:
  - `schema-validator.ts` → 100%
  - `context-bus.ts` → 100%
  - `condition-evaluator.ts` → 100%
  - `definition-parser.ts` → 90%+
  - `transcript-parser.ts` → 90%+
  - `adapter-registry.ts` → 100%
  - `execution-engine.ts` → 80%+ (mocks limitam cobertura de edge cases)
- [ ] Nenhum teste depende de banco real ou processo externo
- [ ] Testes rodam em < 10 segundos total
