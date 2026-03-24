-- CreateTable
CREATE TABLE "task_workflow_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "squad" VARCHAR(100),
    "stages" JSONB NOT NULL,
    "commands" JSONB NOT NULL DEFAULT '[]',
    "data_schema" JSONB NOT NULL DEFAULT '{}',
    "hitl_steps" JSONB NOT NULL DEFAULT '[]',
    "prompt_template" TEXT,
    "cwd" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "session_id" VARCHAR(255),
    "idempotency_key" VARCHAR(255),
    "stage" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'idle',
    "client_data" JSONB NOT NULL DEFAULT '{}',
    "context" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "contact_phone" VARCHAR(30),
    "conversation_id" VARCHAR(255),
    "external_task_id" VARCHAR(255),
    "external_task_url" TEXT,
    "hub_contact_id" UUID,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_workflow_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "tool_name" VARCHAR(100),
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "step" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "form_schema" JSONB,
    "form_data" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "decided_by" VARCHAR(255),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ,

    CONSTRAINT "task_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_commands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "command" TEXT NOT NULL,
    "sent_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_workflow_definitions_account_id_slug_key" ON "task_workflow_definitions"("account_id", "slug");
CREATE INDEX "task_workflow_definitions_account_id_idx" ON "task_workflow_definitions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_workflows_idempotency_key_key" ON "task_workflows"("idempotency_key");
CREATE INDEX "task_workflows_account_id_status_idx" ON "task_workflows"("account_id", "status");
CREATE INDEX "task_workflows_account_id_created_at_idx" ON "task_workflows"("account_id", "created_at" DESC);
CREATE INDEX "task_workflows_definition_id_idx" ON "task_workflows"("definition_id");
CREATE INDEX "task_workflows_session_id_idx" ON "task_workflows"("session_id");
CREATE INDEX "task_workflows_conversation_id_idx" ON "task_workflows"("conversation_id");
CREATE INDEX "task_workflows_contact_phone_idx" ON "task_workflows"("contact_phone");
CREATE INDEX "task_workflows_external_task_id_idx" ON "task_workflows"("external_task_id");

-- CreateIndex
CREATE INDEX "task_workflow_events_workflow_id_created_at_idx" ON "task_workflow_events"("workflow_id", "created_at" DESC);
CREATE INDEX "task_workflow_events_account_id_created_at_idx" ON "task_workflow_events"("account_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_approval_pending" ON "task_approvals"("workflow_id", "step", "status");
CREATE INDEX "task_approvals_account_id_status_idx" ON "task_approvals"("account_id", "status");
CREATE INDEX "task_approvals_workflow_id_idx" ON "task_approvals"("workflow_id");

-- CreateIndex
CREATE INDEX "task_commands_workflow_id_created_at_idx" ON "task_commands"("workflow_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "task_workflows" ADD CONSTRAINT "task_workflows_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "task_workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workflow_events" ADD CONSTRAINT "task_workflow_events_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_commands" ADD CONSTRAINT "task_commands_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "task_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
