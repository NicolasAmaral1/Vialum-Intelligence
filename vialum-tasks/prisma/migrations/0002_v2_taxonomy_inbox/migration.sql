-- V2 Migration: Taxonomy (Stage > Task > Step), Inbox, Sessions, Cost Tracking
-- Additive only — no existing tables/columns modified destructively

-- ═══════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES — new nullable columns
-- ═══════════════════════════════════════════════════════════

-- WorkflowDefinition: v2 format support
ALTER TABLE "task_workflow_definitions"
  ADD COLUMN "definition_format" VARCHAR(20) NOT NULL DEFAULT 'legacy',
  ADD COLUMN "definition_yaml" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Workflow: v2 position tracking + cost + observability
ALTER TABLE "task_workflows"
  ADD COLUMN "current_stage_id" UUID,
  ADD COLUMN "current_step_id" UUID,
  ADD COLUMN "definition_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "total_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ═══════════════════════════════════════════════════════════
-- TAXONOMY: Stage > Task > Step
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_workflow_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "definition_stage_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_workflow_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "definition_task_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_workflow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "definition_step_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "executor" VARCHAR(20) NOT NULL,
    "adapter_type" VARCHAR(30) NOT NULL DEFAULT 'squad',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "assignee_role" VARCHAR(50),
    "is_gate" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "prompt_template" TEXT,
    "wait_config" JSONB,
    "transitions" JSONB,
    "allow_checkpoints" BOOLEAN NOT NULL DEFAULT false,
    "on_complete" JSONB,
    "timeout_ms" INTEGER,
    "on_timeout" VARCHAR(100),
    "on_failure" VARCHAR(100),
    "follow_up" JSONB,
    "output" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- EXECUTION & SESSION
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_step_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "adapter_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'running',
    "input_context" JSONB NOT NULL,
    "output_context" JSONB,
    "session_id" UUID,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "model_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "task_step_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "task_id" UUID,
    "adapter_type" VARCHAR(50) NOT NULL,
    "adapter_session_id" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "node_id" VARCHAR(100),
    "pid" INTEGER,
    "heartbeat_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_sessions_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- INBOX — Unified HITL queue
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_inbox_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "source_service" VARCHAR(30) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "workflow_id" UUID,
    "step_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "assignee_role" VARCHAR(50),
    "assignee_id" VARCHAR(255),
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "input_data" JSONB,
    "output_schema" JSONB,
    "output_data" JSONB,
    "attachments" JSONB DEFAULT '[]',
    "context" JSONB DEFAULT '{}',
    "completed_by" VARCHAR(255),
    "completed_at" TIMESTAMPTZ,
    "read_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dismissed_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_inbox_items_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- COST TRACKING
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_cost_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID,
    "step_id" UUID,
    "execution_id" UUID,
    "adapter_type" VARCHAR(50) NOT NULL,
    "model_id" VARCHAR(100),
    "billing_type" VARCHAR(30) NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_cost_events_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- ADAPTER CONFIG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_adapter_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "adapter_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_adapter_configs_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- WORKFLOW TRIGGERS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_workflow_triggers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "trigger_type" VARCHAR(50) NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "client_data_mapping" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- SCHEDULED JOBS — follow-ups, timeouts, reminders
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "task_scheduled_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "executed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

-- Stages
CREATE INDEX "task_workflow_stages_workflow_id_position_idx" ON "task_workflow_stages"("workflow_id", "position");

-- Tasks
CREATE INDEX "task_workflow_tasks_stage_id_position_idx" ON "task_workflow_tasks"("stage_id", "position");
CREATE INDEX "task_workflow_tasks_workflow_id_idx" ON "task_workflow_tasks"("workflow_id");

-- Steps
CREATE INDEX "task_workflow_steps_task_id_position_idx" ON "task_workflow_steps"("task_id", "position");
CREATE INDEX "task_workflow_steps_workflow_id_status_idx" ON "task_workflow_steps"("workflow_id", "status");

-- Executions
CREATE INDEX "task_step_executions_step_id_attempt_number_idx" ON "task_step_executions"("step_id", "attempt_number");
CREATE INDEX "task_step_executions_workflow_id_idx" ON "task_step_executions"("workflow_id");

-- Sessions
CREATE INDEX "task_sessions_workflow_id_status_idx" ON "task_sessions"("workflow_id", "status");
CREATE INDEX "task_sessions_node_id_status_idx" ON "task_sessions"("node_id", "status");

-- Inbox
CREATE INDEX "task_inbox_items_account_id_status_assignee_role_idx" ON "task_inbox_items"("account_id", "status", "assignee_role");
CREATE INDEX "task_inbox_items_account_id_assignee_id_status_idx" ON "task_inbox_items"("account_id", "assignee_id", "status");
CREATE INDEX "task_inbox_items_workflow_id_idx" ON "task_inbox_items"("workflow_id");
CREATE INDEX "task_inbox_items_source_service_source_id_idx" ON "task_inbox_items"("source_service", "source_id");

-- Cost events
CREATE INDEX "task_cost_events_account_id_created_at_idx" ON "task_cost_events"("account_id", "created_at" DESC);
CREATE INDEX "task_cost_events_workflow_id_idx" ON "task_cost_events"("workflow_id");

-- Adapter configs
CREATE UNIQUE INDEX "task_adapter_configs_account_id_slug_key" ON "task_adapter_configs"("account_id", "slug");

-- Triggers
CREATE INDEX "task_workflow_triggers_account_id_trigger_type_idx" ON "task_workflow_triggers"("account_id", "trigger_type");

-- Scheduled jobs
CREATE INDEX "task_scheduled_jobs_scheduled_at_idx" ON "task_scheduled_jobs"("scheduled_at", "executed_at", "cancelled_at");
CREATE INDEX "task_scheduled_jobs_step_id_idx" ON "task_scheduled_jobs"("step_id");
CREATE INDEX "task_scheduled_jobs_account_id_idx" ON "task_scheduled_jobs"("account_id");

-- ═══════════════════════════════════════════════════════════
-- FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "task_workflow_stages" ADD CONSTRAINT "task_workflow_stages_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workflow_tasks" ADD CONSTRAINT "task_workflow_tasks_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "task_workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workflow_tasks" ADD CONSTRAINT "task_workflow_tasks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workflow_steps" ADD CONSTRAINT "task_workflow_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task_workflow_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workflow_steps" ADD CONSTRAINT "task_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_step_executions" ADD CONSTRAINT "task_step_executions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "task_workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workflow_triggers" ADD CONSTRAINT "task_workflow_triggers_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "task_workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
