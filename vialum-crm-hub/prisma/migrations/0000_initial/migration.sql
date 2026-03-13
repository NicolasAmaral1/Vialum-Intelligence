-- CreateTable: crm_contacts
CREATE TABLE IF NOT EXISTS "crm_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vialum_contact_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "name" VARCHAR(255),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: crm_integrations
CREATE TABLE IF NOT EXISTS "crm_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "crm_contact_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "external_url" TEXT,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_name" VARCHAR(255),
    "status" VARCHAR(100),
    "stage" VARCHAR(100),
    "value" DECIMAL(12,2),
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: provider_configs
CREATE TABLE IF NOT EXISTS "provider_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "crm_contacts_account_id_vialum_contact_id_key" ON "crm_contacts"("account_id", "vialum_contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_integrations_crm_contact_id_provider_external_id_key" ON "crm_integrations"("crm_contact_id", "provider", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "provider_configs_account_id_provider_key" ON "provider_configs"("account_id", "provider");

-- Performance indexes
CREATE INDEX IF NOT EXISTS "crm_contacts_phone_idx" ON "crm_contacts"("phone");
CREATE INDEX IF NOT EXISTS "crm_contacts_email_idx" ON "crm_contacts"("email");
CREATE INDEX IF NOT EXISTS "crm_integrations_provider_idx" ON "crm_integrations"("provider");
CREATE INDEX IF NOT EXISTS "crm_integrations_external_id_idx" ON "crm_integrations"("external_id");

-- Foreign keys
ALTER TABLE "crm_integrations" DROP CONSTRAINT IF EXISTS "crm_integrations_crm_contact_id_fkey";
ALTER TABLE "crm_integrations" ADD CONSTRAINT "crm_integrations_crm_contact_id_fkey"
    FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
