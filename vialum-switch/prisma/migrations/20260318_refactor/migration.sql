-- Etapa 1: Auto-rules, classifiers, strategies, provider configs, webhook configs

CREATE TABLE IF NOT EXISTS "switch_auto_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT '*',
    "event" VARCHAR(50) NOT NULL DEFAULT 'file.created',
    "mime_pattern" VARCHAR(50) NOT NULL,
    "processors" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_auto_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_sar_account" ON "switch_auto_rules"("account_id", "active");

CREATE TABLE IF NOT EXISTS "switch_classifiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "labels" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_classifiers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "switch_classifiers_account_name_key" UNIQUE ("account_id", "name")
);

CREATE TABLE IF NOT EXISTS "switch_strategies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "processor" VARCHAR(50) NOT NULL,
    "strategy" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_strategies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "switch_strategies_account_processor_key" UNIQUE ("account_id", "processor")
);

CREATE TABLE IF NOT EXISTS "switch_provider_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_provider_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "switch_provider_configs_account_provider_key" UNIQUE ("account_id", "provider")
);

CREATE TABLE IF NOT EXISTS "switch_webhook_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "events" TEXT[] NOT NULL,
    "url" TEXT NOT NULL,
    "secret" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "switch_webhook_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "switch_webhook_configs_account_url_key" UNIQUE ("account_id", "url")
);
