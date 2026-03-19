CREATE TABLE IF NOT EXISTS "media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "filename" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bucket" VARCHAR(100) NOT NULL DEFAULT 'vialum-media',
    "context_type" VARCHAR(50),
    "context_id" VARCHAR(255),
    "tags" TEXT[] DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "classification" JSONB,
    "uploaded_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_media_account" ON "media_files"("account_id");
CREATE INDEX IF NOT EXISTS "idx_media_context" ON "media_files"("account_id", "context_type", "context_id");
CREATE INDEX IF NOT EXISTS "idx_media_created" ON "media_files"("account_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "media_webhook_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "events" TEXT[] NOT NULL,
    "url" TEXT NOT NULL,
    "secret" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "media_webhook_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_webhook_configs_account_id_url_key" UNIQUE ("account_id", "url")
);
