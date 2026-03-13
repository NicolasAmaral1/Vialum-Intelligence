-- CreateTable: contact_aliases (multi-identifier lookup)
CREATE TABLE "contact_aliases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "crm_contact_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: oauth_tokens (generic OAuth token storage)
CREATE TABLE "oauth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMPTZ,
    "token_type" VARCHAR(30) NOT NULL DEFAULT 'Bearer',
    "scope" TEXT,
    "raw_response" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "contact_aliases_account_id_type_value_key" ON "contact_aliases"("account_id", "type", "value");
CREATE UNIQUE INDEX "oauth_tokens_account_id_provider_key" ON "oauth_tokens"("account_id", "provider");

-- Performance indexes
CREATE INDEX "contact_aliases_account_id_value_idx" ON "contact_aliases"("account_id", "value");
CREATE INDEX "contact_aliases_crm_contact_id_idx" ON "contact_aliases"("crm_contact_id");

-- Foreign key
ALTER TABLE "contact_aliases" ADD CONSTRAINT "contact_aliases_crm_contact_id_fkey"
    FOREIGN KEY ("crm_contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: populate contact_aliases from existing crm_contacts
INSERT INTO "contact_aliases" ("crm_contact_id", "account_id", "type", "value", "is_primary")
SELECT "id", "account_id", 'phone', "phone", true
FROM "crm_contacts"
WHERE "phone" IS NOT NULL AND "phone" != ''
ON CONFLICT DO NOTHING;

INSERT INTO "contact_aliases" ("crm_contact_id", "account_id", "type", "value", "is_primary")
SELECT "id", "account_id", 'email', lower("email"), true
FROM "crm_contacts"
WHERE "email" IS NOT NULL AND "email" != ''
ON CONFLICT DO NOTHING;
