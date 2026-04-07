# Database & Queries — Deep Diagnostic

## CRITICAL (Performance)

### 1. Missing Compound Index: conversations (account_id, inbox_id, status)
- **File:** `api/prisma/schema.prisma:314`
- **Problem:** Schema declares `@@index([accountId, inboxId, status])` but migration 0001 only creates single-column indexes. Dashboard inbox filtering does full table scan.
- **Fix:** Create migration with compound index.

### 2. Missing Compound Index: conversations (account_id, status, last_activity_at DESC)
- **File:** `api/prisma/schema.prisma:315`
- **Problem:** Activity feed queries sort by `lastActivityAt` with account + status filter. No compound index.
- **Fix:** Create migration with compound index.

### 3. Missing Compound Index: contacts (account_id, phone)
- **File:** `api/prisma/schema.prisma:199`
- **Problem:** Every incoming webhook does `findFirst({ where: { accountId, phone } })`. No compound index → sequential scan. Critical path for every message.
- **Fix:** Create migration: `CREATE UNIQUE INDEX ON contacts(account_id, phone)`.

### 4. Missing Unique Compound Index: messages (conversation_id, external_message_id)
- **File:** `api/prisma/schema.prisma:347`
- **Problem:** Dedup query uses both fields but no compound index. Also no UNIQUE constraint — duplicate messages possible if webhook processes concurrently.
- **Fix:** Add `@@unique([conversationId, externalMessageId])`.

---

## HIGH

### 5. Missing FK Constraint on supervisor_id
- **File:** `api/prisma/schema.prisma:98`
- **Problem:** `supervisorId` references another AccountUser but no FK constraint in migration. Deleting an AccountUser leaves dangling supervisor references.
- **Fix:** Add migration with FK constraint `ON DELETE SET NULL`.

### 6. updatedAt Not Refreshed in updateMany Calls
- **Files:** `api/src/modules/talks/talks.service.ts:178, 276`, `talk-inactivity.worker.ts:84`
- **Problem:** Prisma `@updatedAt` only auto-updates on `.update()`, not `.updateMany()`. Several critical paths use `updateMany` without manual timestamp update.
- **Fix:** Add `updatedAt: new Date()` to all `updateMany` data objects.

### 7. Contact Find-or-Create Race Condition
- **File:** `api/src/workers/webhook-process.worker.ts:149-163`
- **Problem:** `phone` is NOT unique at DB level. Two concurrent webhooks for same phone both see no existing contact, both create new contacts. Duplicate contacts.
- **Fix:** Add `@@unique([accountId, phone])` constraint. Use `upsert` instead of find+create.

---

## MEDIUM

### 8. WebhookEvent Table Unbounded Growth
- **File:** `api/prisma/schema.prisma:473-492`
- **Problem:** No cleanup mechanism. Processed events with full JSON payloads accumulate forever. ~100 msgs/day = 36K+ records/year.
- **Fix:** Add cron job: `DELETE FROM webhook_events WHERE processed = true AND created_at < NOW() - INTERVAL '30 days'`.

### 9. Missing Index on Message.senderContactId
- **File:** `api/prisma/schema.prisma:326`
- **Problem:** FK exists but no index. Queries filtering by sender contact do sequential scan.
- **Fix:** Add `@@index([senderContactId])`.

### 10. Soft Delete Pattern Inconsistent
- **Problem:** Contact and Conversation have `deletedAt`. Message, TalkMessage, AccountApiKey do not. Orphaned messages exist after conversation soft-delete.
- **Fix:** Decide on consistent strategy. Either add soft delete to Message or cascade hard delete.

### 11. ContactInbox Created Outside Transaction
- **File:** `api/src/workers/webhook-process.worker.ts:179-186`
- **Problem:** Contact created in transaction, but ContactInbox outside. Failure leaves contact without inbox association.
- **Fix:** Move into transaction.

### 12. N+1 Query: Supervisor Inbox Access
- **File:** `api/src/modules/inboxes/inbox-access.service.ts:37-51`
- **Problem:** Separate query for each supervisor's supervisees. Could be eager-loaded in initial query.
- **Fix:** Use Prisma `include` to load supervisees in one query.

---

## LOW

### 13. JSON Columns Not Schema-Validated
- **Fields:** `TreeFlow.settings`, `Message.contentAttributes`, `AISuggestion.context`, `Conversation.customAttributes`
- **Problem:** No CHECK constraint or app-level validation before insert. Invalid JSON stored silently.
- **Fix:** Add Zod validation at service layer.

### 14. Raw SQL in Migration Scripts
- **File:** `api/src/scripts/fix-ingestion-data.ts:116-118, 178-182`
- **Problem:** Uses `$executeRawUnsafe`. Parameters are typed, so risk is low, but bypasses Prisma safety.
- **Fix:** Acceptable for data migration scripts. Document as internal-only.

### 15. hubContactId Field Unused
- **File:** `api/prisma/schema.prisma:175`
- **Problem:** Field exists but only used in one place. Not indexed, not queried elsewhere.
- **Fix:** Verify if Hub integration needs it. Remove if truly unused.
