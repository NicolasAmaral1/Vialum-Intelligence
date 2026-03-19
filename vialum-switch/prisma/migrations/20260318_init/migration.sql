CREATE TABLE IF NOT EXISTS "switch_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "processor" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "input_type" VARCHAR(20) NOT NULL,
    "input_ref" TEXT,
    "input_mime" VARCHAR(100),
    "params" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "confidence" DOUBLE PRECISION,
    "processing_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_sj_account_created" ON "switch_jobs"("account_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_sj_cache" ON "switch_jobs"("account_id", "processor", "input_ref");
