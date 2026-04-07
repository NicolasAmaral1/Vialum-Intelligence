# API Backend — Diagnostic Report

## 1. Security

### 1.1 CRITICAL: Hardcoded Credentials in Script
- **File:** `api/src/scripts/ingest-evolution-history.ts:14-16`
- **Category:** Security
- **Problem:** Evolution API key, base URL, instance name, inbox ID, and account ID are hardcoded in plaintext. Anyone with repo access can compromise the Evolution API.
- **Fix:** Replace with `process.env.*` variables. Add to `.env.example`.

### 1.2 HIGH: Auth Plugin Missing Return Statements
- **File:** `api/src/plugins/auth.ts:34, 44`
- **Category:** Security
- **Problem:** No `return` after sending 401/403 error responses in `authenticate` and `tenantGuard` hooks. Execution continues past the error response, potentially bypassing authentication.
- **Fix:** Add `return reply` before each error response.

### 1.3 HIGH: Cloud API Webhook Signature Verification Optional
- **File:** `api/src/webhooks/webhook.routes.ts:186-195`
- **Category:** Security
- **Problem:** Signature verification only happens if `app_secret` is configured AND the header is present. Webhooks accepted without any validation if either is missing.
- **Fix:** Require `app_secret` in inbox config validation. Reject unsigned webhooks in production.

### 1.4 MEDIUM: No Signature Verification for Evolution API Webhooks
- **File:** `api/src/webhooks/webhook.routes.ts:42-106`
- **Category:** Security
- **Problem:** Evolution API webhooks have zero signature validation. Any request to the endpoint is accepted if the inbox exists.
- **Fix:** Add API key verification from Evolution webhook headers.

---

## 2. Workers — Reliability

### 2.1 HIGH: Hub Ensure Worker Missing Timeout
- **File:** `api/src/workers/hub-ensure.worker.ts:64-77`
- **Category:** Reliability
- **Problem:** `fetch()` to Hub has no AbortController timeout. If Hub is slow or down, worker hangs indefinitely, exhausting concurrency slots.
- **Fix:** Add `AbortController` with 5-10s timeout.

### 2.2 HIGH: Media Persist Worker Missing Timeout
- **File:** `api/src/workers/media-persist.worker.ts:130-138, 229`
- **Category:** Reliability
- **Problem:** Both upload paths (direct base64 and fallback URL) have no timeout. Large files + slow Media Service = blocked worker.
- **Fix:** Add `AbortController` with 30s timeout.

### 2.3 HIGH: MEDIA_JWT_SECRET Optional But Required at Runtime
- **File:** `api/src/config/env.ts:16` / `api/src/workers/media-persist.worker.ts:44`
- **Category:** Reliability
- **Problem:** `MEDIA_JWT_SECRET` is `z.string().optional()` in env schema, but `generateServiceToken()` throws if it's missing. App starts fine but workers crash on first media job.
- **Fix:** Change to `z.string().min(32)` so it fails at startup, not runtime.

### 2.4 MEDIUM: Automation Worker Counts Failed Runs as Success
- **File:** `api/src/workers/automation.worker.ts:74`
- **Category:** Bug
- **Problem:** `runCount` increments even when action execution fails. Misleading stats.
- **Fix:** Only increment on successful execution, or track `failCount` separately.

### 2.5 MEDIUM: Talk Inactivity Worker — No Retry on Individual Failures
- **File:** `api/src/workers/talk-inactivity.worker.ts:140`
- **Category:** Reliability
- **Problem:** If closing one talk fails, error is logged but no retry. Talk remains in limbo.
- **Fix:** Add per-talk retry or dead-letter mechanism.

### 2.6 MEDIUM: Fire-and-Forget Background Tasks Use console.error
- **Files:** `api/src/workers/webhook-process.worker.ts:330-333, 649-658`
- **Category:** Observability
- **Problem:** Background functions (avatar fetch, Tasks notification, group sync) log errors to `console.error` instead of structured pino logger. Not captured by log aggregation.
- **Fix:** Use `fastify.log.error()` or pass logger instance to workers.

---

## 3. Services — Performance & Logic

### 3.1 HIGH: N+1 Query in Conversation List
- **File:** `api/src/modules/conversations/conversations.service.ts:94-116`
- **Category:** Performance
- **Problem:** Loads last message with `take: 1` for EVERY conversation. 25 conversations = 26 queries.
- **Fix:** Use `_count` or batch load with `IN` query on conversation IDs.

### 3.2 MEDIUM: Context Service Fetches CRM Data Without Cache Check
- **File:** `api/src/modules/conversations/context.service.ts:85-94`
- **Category:** Performance
- **Problem:** `fetchCrmData()` makes HTTP call on every context request. Cache check logic may not be working correctly.
- **Fix:** Verify Redis cache key generation is deterministic. Add cache-first pattern.

### 3.3 MEDIUM: External Service Inconsistent Error Handling
- **File:** `api/src/modules/external/external.service.ts:106-109, 188`
- **Category:** Bug / Code Quality
- **Problem:** HITL mode doesn't throw on failure while direct mode does. Also uses `(conversation as any).status` unsafe cast.
- **Fix:** Standardize error handling. Use proper types.

### 3.4 MEDIUM: Message Chunking — No Empty Array Guard
- **File:** `api/src/modules/messages/messages.service.ts:81-150`
- **Category:** Reliability
- **Problem:** If `splitMessageChunks()` returns empty array, the loop does nothing and no message is sent. No error raised.
- **Fix:** Assert chunks.length > 0 before loop.

### 3.5 MEDIUM: Fire-and-Forget Conversation Update
- **File:** `api/src/modules/messages/messages.service.ts:204`
- **Category:** Reliability
- **Problem:** Conversation `unreadCount` update is fire-and-forget. If it fails, count becomes permanently inconsistent.
- **Fix:** Include in main transaction or use worker queue.

---

## 4. Routes & Validation

### 4.1 MEDIUM: Idempotency Key Fallback to Random UUID
- **File:** `api/src/webhooks/webhook.routes.ts:64`
- **Category:** Reliability
- **Problem:** When Evolution API doesn't send an event ID, `crypto.randomUUID()` is used. This means the same event reprocessed will get a different key, defeating idempotency.
- **Fix:** Reject events without proper IDs or derive key from payload hash.

### 4.2 MEDIUM: Inbox Config Accepts Empty Strings
- **File:** `api/src/modules/inboxes/inboxes.service.ts:21-42`
- **Category:** Reliability
- **Problem:** `validateProviderConfig` doesn't check for empty strings. `""` passes validation.
- **Fix:** Add `.min(1)` to all string validations.

### 4.3 LOW: Snooze Datetime Not Validated as Future
- **File:** `api/src/modules/conversations/conversations.routes.ts:95`
- **Category:** Validation
- **Problem:** `snoozedUntil` accepts any datetime, including past dates.
- **Fix:** Add `.refine((d) => new Date(d) > new Date())`.

### 4.4 LOW: 'unassigned' String as Magic Value
- **File:** `api/src/modules/conversations/conversations.service.ts:74`
- **Category:** Code Quality
- **Problem:** `assigneeId === 'unassigned'` is a magic string. Should be `null`.
- **Fix:** Require API to send `null`, not `"unassigned"`.

---

## 5. Prisma Schema — Data Integrity & Performance

### 5.1 HIGH: Missing Compound Index for Message Dedup
- **File:** `api/prisma/schema.prisma:347`
- **Category:** Performance / Data Integrity
- **Problem:** Dedup query uses `WHERE externalMessageId = X AND conversationId = Y` but only `@@index([externalMessageId])` exists. Full table scan on large datasets.
- **Fix:** Add `@@unique([conversationId, externalMessageId])`.

### 5.2 MEDIUM: WebhookEvent Table Grows Unbounded
- **File:** `api/prisma/schema.prisma:473-492`
- **Category:** Performance
- **Problem:** No cleanup mechanism. Processed events accumulate forever.
- **Fix:** Add cron job to delete processed events older than 30 days.

### 5.3 MEDIUM: Missing Index on Message.senderContactId
- **File:** `api/prisma/schema.prisma:326`
- **Category:** Performance
- **Problem:** Queries filtering by sender contact have no index.
- **Fix:** Add `@@index([senderContactId])`.

### 5.4 MEDIUM: Missing Optimized Index for Conversation Queries
- **File:** `api/prisma/schema.prisma:273-290`
- **Category:** Performance
- **Problem:** Common query pattern `WHERE accountId = X AND status IN (...) ORDER BY lastActivityAt DESC` doesn't have matching compound index.
- **Fix:** Add `@@index([accountId, status, lastActivityAt])`.

---

## 6. Providers

### 6.1 MEDIUM: Empty String as externalMessageId Fallback
- **Files:** `api/src/providers/evolution/evolution.adapter.ts:90-100`, `api/src/providers/cloud-api/cloud.adapter.ts:62`
- **Category:** Bug
- **Problem:** Both providers return empty string when message ID is missing. Downstream code expects valid ID for dedup.
- **Fix:** Throw error instead of returning empty string.

---

## 7. Type Safety

### 7.1 MEDIUM: Unsafe `as any` Casts
- **Files:** `api/src/modules/external/external.service.ts:188`, `api/src/app.ts:77-79`
- **Category:** Code Quality
- **Problem:** Multiple unsafe casts bypass TypeScript protection.
- **Fix:** Create proper type declarations and module augmentation.

### 7.2 LOW: Missing Strict Type for providerConfig
- **File:** `api/src/workers/webhook-process.worker.ts:114`
- **Category:** Type Safety
- **Problem:** `providerConfig: Record<string, any>` — no validation of required fields.
- **Fix:** Use typed discriminated union per provider.

---

## 8. Config

### 8.1 MEDIUM: Redis maxRetriesPerRequest Set to null
- **File:** `api/src/config/redis.ts:8-11`
- **Category:** Reliability
- **Problem:** `maxRetriesPerRequest: null` means infinite retries. If Redis is down, requests hang forever.
- **Fix:** Set explicit limit (e.g., 10) with timeout.

### 8.2 LOW: DATABASE_URL Not Validated for Protocol
- **File:** `api/src/config/env.ts:6`
- **Category:** Validation
- **Problem:** `.url()` validator doesn't check for `postgresql://` prefix.
- **Fix:** Add `.startsWith('postgresql://')` or `.refine()`.
