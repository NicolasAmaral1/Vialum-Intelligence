# Workers — Deep Diagnostic

## HIGH

### 1. Message-Send: No Transaction Wrapping DB Writes After Provider Call
- **File:** `api/src/workers/message-send.worker.ts:207-286`
- **Category:** Data Consistency
- **Problem:** Provider `sendText()` (external call) succeeds, then DB writes (message create, talkMessage, aiSuggestion update, conversation update) happen sequentially WITHOUT a transaction. If any DB write fails, WhatsApp message is sent but DB state is inconsistent. Retry sends duplicate WhatsApp message.
- **Fix:** Wrap all DB writes in `$transaction`. Accept that provider call can't be rolled back — mark message as "sent_pending_db" and reconcile.

### 2. Message-Send: Conversation Lock Race Condition
- **File:** `api/src/workers/message-send.worker.ts:35-46, 84-102`
- **Category:** Concurrency
- **Problem:** Redis SETNX lock has 120s TTL, but job could take longer. Lock auto-expires while job runs, allowing concurrent job. Re-enqueue creates unbounded copies (1.5s delay each).
- **Fix:** Use lock token pattern (SETNX with unique value, release only if value matches). Extend TTL during processing.

### 3. Media-Persist: Full File Buffering in Memory
- **File:** `api/src/workers/media-persist.worker.ts:107-128`
- **Category:** Memory
- **Problem:** Entire media file loaded as base64 → Buffer → multipart body in memory. Concurrency 5 × 100MB video = 500MB+ memory spike. No streaming support.
- **Fix:** Stream from downloadMedia directly to Media Service. Or reduce concurrency for large files.

### 4. Webhook-Process: Duplicate Conversations on Concurrent Webhooks
- **File:** `api/src/workers/webhook-process.worker.ts:207-229`
- **Category:** Concurrency
- **Problem:** Conversation find/create is OUTSIDE the message dedup transaction. Two concurrent webhooks for same contact can both create separate conversations, then both insert messages. No duplicate detection across conversations.
- **Fix:** Wrap conversation find/create + message insert in single transaction. Add unique constraint on `(accountId, contactId, inboxId, status)`.

### 5. Webhook-Process: ContactInbox Created Outside Transaction
- **File:** `api/src/workers/webhook-process.worker.ts:179-186`
- **Category:** Atomicity
- **Problem:** Contact created in transaction (lines 149-163), but ContactInbox created outside (line 179). If ContactInbox create fails (unique constraint), message is never inserted and webhook is NOT retried.
- **Fix:** Move ContactInbox creation inside the transaction.

---

## MEDIUM

### 6. Most Workers Have No Retry Config
- **Category:** Reliability
- **Problem:** Only webhook-process (5 attempts) and media-persist (3 attempts) have retry config. All others (talk-route, talk-analyze, automation, hub-ensure, snooze, inactivity) use BullMQ default of 1 attempt. Failed jobs disappear silently.
- **Fix:** Add `attempts: 3, backoff: { type: 'exponential', delay: 2000 }` to all workers.

### 7. Automation Worker: Queue Connection Leak
- **File:** `api/src/workers/automation.worker.ts:196-203`
- **Problem:** Each `send_message` action creates a new Queue instance. No try-finally, so `queue.close()` skipped on error. Leaks Redis connections.
- **Fix:** Use singleton queue or wrap in try-finally.

### 8. Webhook Dedup Not Atomic at Job Level
- **File:** `api/src/workers/webhook-process.worker.ts:89-102`
- **Problem:** Two jobs can process same webhookEvent simultaneously. Both read `processed: false`, both process, both mark `processed: true`. Duplicate messages.
- **Fix:** Use `UPDATE ... WHERE processed = false RETURNING *` pattern for atomic check-and-mark.

### 9. Fire-and-Forget Operations Never Retry
- **File:** `api/src/workers/webhook-process.worker.ts:167, 331, 649-733`
- **Problem:** Avatar fetch, group name fetch, Tasks notification — all `.catch(console.error)`. No retry, no persistence, no monitoring. If Tasks is down, workflow resume is lost forever.
- **Fix:** Queue these as separate BullMQ jobs with retry config.

### 10. Missing Payload Size Validation
- **File:** `api/src/workers/webhook-process.worker.ts:85-114`
- **Problem:** Webhook payload passed as `Record<string, any>` with no size limit. A 100MB payload would be stored in Redis job data.
- **Fix:** Validate payload size before enqueuing. Reject payloads > 1MB.

### 11. No Timeouts on External Service Calls
- **Files:** `hub-ensure.worker.ts:64`, `media-persist.worker.ts:130,229`, `automation.worker.ts:255`
- **Problem:** All `fetch()` calls have no AbortController timeout. Hanging external service blocks worker indefinitely.
- **Fix:** Add AbortController with timeouts (Hub: 5s, Media: 30s, Webhook: 5s).

### 12. Singleton Queues Never Closed on Shutdown
- **File:** `api/src/workers/index.ts:100-107`
- **Problem:** `shutdownWorkers()` closes Worker instances but not Queue instances (_automationQueue, _talkRouteQueue, _hubEnsureQueue, _mediaPersistQueue). Redis connections leak.
- **Fix:** Track and close all Queue instances in shutdown.

### 13. Talk-Inactivity: Loads All Active Talks Into Memory
- **File:** `api/src/workers/talk-inactivity.worker.ts:27-46`
- **Problem:** `findMany({ where: { status: 'active' } })` loads ALL active talks. At scale, 10K+ records in memory to process 100 expired ones.
- **Fix:** Use cursor-based pagination. Or filter by `lastActivityAt < threshold` in the query.

### 14. Redis Memory Alert: Log Only, No Action
- **File:** `api/src/workers/index.ts:52-70`
- **Problem:** Memory alert logged to `console.warn` only. No actual remediation, no external alert, no pause of job processing.
- **Fix:** Send to monitoring system. Pause non-critical queues at 90%.

---

## LOW

### 15. 1:1 Conversation Lookup Missing deletedAt Check
- **File:** `api/src/workers/webhook-process.worker.ts:207-214`
- **Problem:** Group conversations check `deletedAt: null` but 1:1 conversations don't. Messages could be inserted into soft-deleted conversations.
- **Fix:** Add `deletedAt: null` to 1:1 conversation query.

### 16. No Backpressure on Queue Growth
- **Problem:** Workers have concurrency limits but no queue depth limits. Under sustained load, Redis memory grows unbounded.
- **Fix:** Implement queue depth monitoring. Return 429 upstream when depth exceeds threshold.
