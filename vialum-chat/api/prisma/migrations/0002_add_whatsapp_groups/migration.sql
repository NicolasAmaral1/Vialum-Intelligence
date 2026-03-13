-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "inbox_id" UUID NOT NULL,
    "jid" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "profile_pic_url" TEXT,
    "group_type" VARCHAR(30) NOT NULL DEFAULT 'client',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add group_id to conversations
ALTER TABLE "conversations" ADD COLUMN "group_id" UUID;

-- AlterTable: Add sender_contact_id to messages
ALTER TABLE "messages" ADD COLUMN "sender_contact_id" UUID;

-- CreateIndex
CREATE INDEX "groups_account_id_idx" ON "groups"("account_id");
CREATE INDEX "groups_jid_idx" ON "groups"("jid");
CREATE UNIQUE INDEX "groups_inbox_id_jid_key" ON "groups"("inbox_id", "jid");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");
CREATE INDEX "group_members_contact_id_idx" ON "group_members"("contact_id");
CREATE UNIQUE INDEX "group_members_group_id_contact_id_key" ON "group_members"("group_id", "contact_id");

-- CreateIndex
CREATE INDEX "conversations_group_id_idx" ON "conversations"("group_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_contact_id_fkey" FOREIGN KEY ("sender_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
