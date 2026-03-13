-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'agent',
    "availability" VARCHAR(50) NOT NULL DEFAULT 'online',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inboxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "channel_type" VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    "provider" VARCHAR(50) NOT NULL,
    "provider_config" JSONB NOT NULL DEFAULT '{}',
    "working_hours" JSONB NOT NULL DEFAULT '{}',
    "greeting_message" TEXT,
    "out_of_office_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "avatar_url" TEXT,
    "custom_attributes" JSONB NOT NULL DEFAULT '{}',
    "funnel_stage" VARCHAR(100),
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_inboxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "inbox_id" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "inbox_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "contact_inbox_id" UUID,
    "assignee_id" UUID,
    "active_talk_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snoozed_until" TIMESTAMPTZ,
    "custom_attributes" JSONB NOT NULL DEFAULT '{}',
    "additional_attributes" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "inbox_id" UUID NOT NULL,
    "sender_type" VARCHAR(50) NOT NULL,
    "sender_id" UUID,
    "content" TEXT,
    "message_type" VARCHAR(50) NOT NULL DEFAULT 'incoming',
    "content_type" VARCHAR(50) NOT NULL DEFAULT 'text',
    "content_attributes" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(50) NOT NULL DEFAULT 'sent',
    "private" BOOLEAN NOT NULL DEFAULT false,
    "external_message_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6366F1',
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_labels" (
    "conversation_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_labels_pkey" PRIMARY KEY ("conversation_id","label_id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "short_code" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "event_name" VARCHAR(100) NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "talk_id" UUID,
    "talk_step_id" VARCHAR(100),
    "triggered_by" VARCHAR(100),
    "trigger_id" UUID,
    "content" TEXT NOT NULL,
    "edited_content" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "confidence" DECIMAL(3,2),
    "auto_mode" BOOLEAN NOT NULL DEFAULT false,
    "funnel_stage" VARCHAR(100),
    "context" JSONB NOT NULL DEFAULT '{}',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "inbox_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_flows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "active_version_id" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_flow_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tree_flow_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "definition" JSONB NOT NULL,
    "ab_weight" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "description" TEXT,
    "detection_hints" JSONB NOT NULL DEFAULT '[]',
    "rebuttal_strategy" TEXT,
    "rebuttal_examples" JSONB NOT NULL DEFAULT '[]',
    "severity" VARCHAR(50) NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_flow_objections" (
    "tree_flow_id" UUID NOT NULL,
    "objection_id" UUID NOT NULL,
    "step_ids" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_flow_objections_pkey" PRIMARY KEY ("tree_flow_id","objection_id")
);

-- CreateTable
CREATE TABLE "talks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "tree_flow_id" UUID NOT NULL,
    "tree_flow_version_id" UUID NOT NULL,
    "parent_talk_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMPTZ,
    "resumed_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inactivity_timeout_minutes" INTEGER NOT NULL DEFAULT 1440,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talk_flows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "talk_id" UUID NOT NULL,
    "current_step_id" VARCHAR(100) NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "objections_encountered" JSONB NOT NULL DEFAULT '[]',
    "escape_attempts" INTEGER NOT NULL DEFAULT 0,
    "confidence_history" JSONB NOT NULL DEFAULT '[]',
    "snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talk_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talk_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "talk_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "actor_type" VARCHAR(50) NOT NULL DEFAULT 'system',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talk_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "talk_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "routing_confidence" DECIMAL(3,2),
    "routed_by" VARCHAR(50) NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talk_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_slug_key" ON "accounts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "account_users_account_id_idx" ON "account_users"("account_id");

-- CreateIndex
CREATE INDEX "account_users_user_id_idx" ON "account_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_users_account_id_user_id_key" ON "account_users"("account_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "inboxes_account_id_idx" ON "inboxes"("account_id");

-- CreateIndex
CREATE INDEX "contacts_account_id_idx" ON "contacts"("account_id");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contact_inboxes_contact_id_idx" ON "contact_inboxes"("contact_id");

-- CreateIndex
CREATE INDEX "contact_inboxes_inbox_id_idx" ON "contact_inboxes"("inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_inboxes_inbox_id_source_id_key" ON "contact_inboxes"("inbox_id", "source_id");

-- CreateIndex
CREATE INDEX "conversations_account_id_idx" ON "conversations"("account_id");

-- CreateIndex
CREATE INDEX "conversations_inbox_id_idx" ON "conversations"("inbox_id");

-- CreateIndex
CREATE INDEX "conversations_contact_id_idx" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "conversations_assignee_id_idx" ON "conversations"("assignee_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_last_activity_at_idx" ON "conversations"("last_activity_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_active_talk_id_idx" ON "conversations"("active_talk_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_account_id_idx" ON "messages"("account_id");

-- CreateIndex
CREATE INDEX "messages_inbox_id_idx" ON "messages"("inbox_id");

-- CreateIndex
CREATE INDEX "messages_external_message_id_idx" ON "messages"("external_message_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at" DESC);

-- CreateIndex
CREATE INDEX "labels_account_id_idx" ON "labels"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_account_id_name_key" ON "labels"("account_id", "name");

-- CreateIndex
CREATE INDEX "conversation_labels_conversation_id_idx" ON "conversation_labels"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_labels_label_id_idx" ON "conversation_labels"("label_id");

-- CreateIndex
CREATE INDEX "canned_responses_account_id_idx" ON "canned_responses"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_account_id_short_code_key" ON "canned_responses"("account_id", "short_code");

-- CreateIndex
CREATE INDEX "automation_rules_account_id_idx" ON "automation_rules"("account_id");

-- CreateIndex
CREATE INDEX "automation_rules_event_name_idx" ON "automation_rules"("event_name");

-- CreateIndex
CREATE INDEX "automation_rules_active_idx" ON "automation_rules"("active");

-- CreateIndex
CREATE INDEX "ai_suggestions_account_id_idx" ON "ai_suggestions"("account_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_conversation_id_idx" ON "ai_suggestions"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_status_idx" ON "ai_suggestions"("status");

-- CreateIndex
CREATE INDEX "ai_suggestions_talk_id_idx" ON "ai_suggestions"("talk_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_idempotency_key_key" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_inbox_id_idx" ON "webhook_events"("inbox_id");

-- CreateIndex
CREATE INDEX "webhook_events_idempotency_key_idx" ON "webhook_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events"("processed");

-- CreateIndex
CREATE INDEX "tree_flows_account_id_idx" ON "tree_flows"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "tree_flows_account_id_slug_key" ON "tree_flows"("account_id", "slug");

-- CreateIndex
CREATE INDEX "tree_flow_versions_tree_flow_id_idx" ON "tree_flow_versions"("tree_flow_id");

-- CreateIndex
CREATE INDEX "tree_flow_versions_status_idx" ON "tree_flow_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tree_flow_versions_tree_flow_id_version_number_key" ON "tree_flow_versions"("tree_flow_id", "version_number");

-- CreateIndex
CREATE INDEX "objections_account_id_idx" ON "objections"("account_id");

-- CreateIndex
CREATE INDEX "objections_category_idx" ON "objections"("category");

-- CreateIndex
CREATE UNIQUE INDEX "objections_account_id_name_key" ON "objections"("account_id", "name");

-- CreateIndex
CREATE INDEX "tree_flow_objections_tree_flow_id_idx" ON "tree_flow_objections"("tree_flow_id");

-- CreateIndex
CREATE INDEX "tree_flow_objections_objection_id_idx" ON "tree_flow_objections"("objection_id");

-- CreateIndex
CREATE INDEX "talks_account_id_idx" ON "talks"("account_id");

-- CreateIndex
CREATE INDEX "talks_conversation_id_idx" ON "talks"("conversation_id");

-- CreateIndex
CREATE INDEX "talks_contact_id_idx" ON "talks"("contact_id");

-- CreateIndex
CREATE INDEX "talks_tree_flow_id_idx" ON "talks"("tree_flow_id");

-- CreateIndex
CREATE INDEX "talks_status_idx" ON "talks"("status");

-- CreateIndex
CREATE INDEX "talks_parent_talk_id_idx" ON "talks"("parent_talk_id");

-- CreateIndex
CREATE INDEX "talks_last_activity_at_idx" ON "talks"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "talk_flows_talk_id_key" ON "talk_flows"("talk_id");

-- CreateIndex
CREATE INDEX "talk_flows_talk_id_idx" ON "talk_flows"("talk_id");

-- CreateIndex
CREATE INDEX "talk_events_talk_id_idx" ON "talk_events"("talk_id");

-- CreateIndex
CREATE INDEX "talk_events_event_type_idx" ON "talk_events"("event_type");

-- CreateIndex
CREATE INDEX "talk_events_created_at_idx" ON "talk_events"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "talk_messages_message_id_key" ON "talk_messages"("message_id");

-- CreateIndex
CREATE INDEX "talk_messages_talk_id_idx" ON "talk_messages"("talk_id");

-- CreateIndex
CREATE INDEX "talk_messages_message_id_idx" ON "talk_messages"("message_id");

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_inboxes" ADD CONSTRAINT "contact_inboxes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_inboxes" ADD CONSTRAINT "contact_inboxes_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_inbox_id_fkey" FOREIGN KEY ("contact_inbox_id") REFERENCES "contact_inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_active_talk_id_fkey" FOREIGN KEY ("active_talk_id") REFERENCES "talks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_labels" ADD CONSTRAINT "conversation_labels_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_labels" ADD CONSTRAINT "conversation_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_talk_id_fkey" FOREIGN KEY ("talk_id") REFERENCES "talks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_flows" ADD CONSTRAINT "tree_flows_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_flows" ADD CONSTRAINT "tree_flows_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "tree_flow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_flow_versions" ADD CONSTRAINT "tree_flow_versions_tree_flow_id_fkey" FOREIGN KEY ("tree_flow_id") REFERENCES "tree_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objections" ADD CONSTRAINT "objections_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_flow_objections" ADD CONSTRAINT "tree_flow_objections_tree_flow_id_fkey" FOREIGN KEY ("tree_flow_id") REFERENCES "tree_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_flow_objections" ADD CONSTRAINT "tree_flow_objections_objection_id_fkey" FOREIGN KEY ("objection_id") REFERENCES "objections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_tree_flow_id_fkey" FOREIGN KEY ("tree_flow_id") REFERENCES "tree_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_tree_flow_version_id_fkey" FOREIGN KEY ("tree_flow_version_id") REFERENCES "tree_flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talks" ADD CONSTRAINT "talks_parent_talk_id_fkey" FOREIGN KEY ("parent_talk_id") REFERENCES "talks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talk_flows" ADD CONSTRAINT "talk_flows_talk_id_fkey" FOREIGN KEY ("talk_id") REFERENCES "talks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talk_events" ADD CONSTRAINT "talk_events_talk_id_fkey" FOREIGN KEY ("talk_id") REFERENCES "talks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talk_events" ADD CONSTRAINT "talk_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talk_messages" ADD CONSTRAINT "talk_messages_talk_id_fkey" FOREIGN KEY ("talk_id") REFERENCES "talks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talk_messages" ADD CONSTRAINT "talk_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

