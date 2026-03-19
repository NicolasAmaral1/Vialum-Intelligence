-- Provider Operations: Audit trail for all write operations
CREATE TABLE IF NOT EXISTS "provider_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(255),
    "params" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "status" VARCHAR(20) NOT NULL,
    "error" TEXT,
    "caller" VARCHAR(100),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "provider_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_po_account_created" ON "provider_operations"("account_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_po_account_provider_entity" ON "provider_operations"("account_id", "provider", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_po_account_caller_created" ON "provider_operations"("account_id", "caller", "created_at" DESC);
