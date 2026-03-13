-- Add category column to provider_configs (safe: skip if already exists)
ALTER TABLE "provider_configs" ADD COLUMN IF NOT EXISTS "category" VARCHAR(30) NOT NULL DEFAULT 'crm';

-- Set correct categories for existing providers
UPDATE "provider_configs" SET "category" = 'crm' WHERE "provider" = 'pipedrive';
UPDATE "provider_configs" SET "category" = 'tasks' WHERE "provider" = 'clickup';
UPDATE "provider_configs" SET "category" = 'documents' WHERE "provider" = 'gdrive';

-- Add index for category lookups
CREATE INDEX IF NOT EXISTS "provider_configs_account_id_category_active_idx" ON "provider_configs"("account_id", "category", "active");
