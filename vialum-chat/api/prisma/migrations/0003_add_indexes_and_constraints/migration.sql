-- 0003_add_indexes_and_constraints
-- Adds missing compound indexes and unique constraints for performance and data integrity.
--
-- IMPORTANT: Before applying, check for existing duplicates:
--   SELECT account_id, phone, COUNT(*) FROM contacts WHERE phone IS NOT NULL GROUP BY account_id, phone HAVING COUNT(*) > 1;
--   SELECT conversation_id, external_message_id, COUNT(*) FROM messages WHERE external_message_id IS NOT NULL GROUP BY conversation_id, external_message_id HAVING COUNT(*) > 1;

-- ── Contacts: unique constraint on (account_id, phone) ──
-- Replaces the existing non-unique index
DROP INDEX IF EXISTS "contacts_account_id_phone_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_account_id_phone_key" ON "contacts" ("account_id", "phone");

-- ── Messages: unique constraint for dedup ──
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_id_external_message_id_key" ON "messages" ("conversation_id", "external_message_id");

-- ── Messages: index on sender_contact_id ──
CREATE INDEX IF NOT EXISTS "messages_sender_contact_id_idx" ON "messages" ("sender_contact_id");

-- ── Conversations: compound indexes (declared in schema but missing in migrations) ──
CREATE INDEX IF NOT EXISTS "conversations_account_id_inbox_id_status_idx" ON "conversations" ("account_id", "inbox_id", "status");
CREATE INDEX IF NOT EXISTS "conversations_account_id_status_last_activity_at_idx" ON "conversations" ("account_id", "status", "last_activity_at" DESC);
