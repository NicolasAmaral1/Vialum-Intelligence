-- Organizations: Companies / PJ entities
CREATE TABLE IF NOT EXISTS "crm_organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "legal_name" VARCHAR(500),
    "trade_name" VARCHAR(500),
    "cnpj" VARCHAR(20),
    "lifecycle_stage" VARCHAR(50) NOT NULL DEFAULT 'lead',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crm_organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_organizations_account_id_cnpj_key" UNIQUE ("account_id", "cnpj")
);
CREATE INDEX IF NOT EXISTS "idx_crm_org_account" ON "crm_organizations"("account_id");

-- Organization Aliases: multi-identifier lookup
CREATE TABLE IF NOT EXISTS "organization_aliases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "organization_aliases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_aliases_account_id_type_value_key" UNIQUE ("account_id", "type", "value"),
    CONSTRAINT "organization_aliases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "crm_organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_org_alias_value" ON "organization_aliases"("account_id", "value");

-- Contact-Organization: N:N with role
CREATE TABLE IF NOT EXISTS "contact_organizations" (
    "contact_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" VARCHAR(100) NOT NULL DEFAULT 'representante',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "contact_organizations_pkey" PRIMARY KEY ("contact_id", "organization_id"),
    CONSTRAINT "contact_organizations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE,
    CONSTRAINT "contact_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "crm_organizations"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_contact_org_org" ON "contact_organizations"("organization_id");
