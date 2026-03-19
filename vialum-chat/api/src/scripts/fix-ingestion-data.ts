/**
 * Fix data issues from the Evolution API history ingestion.
 *
 * Problems addressed:
 * 1. Group contacts created with JID as phone (e.g. 120363...@g.us) — these are not real contacts
 * 2. Conversations created for groups with contactInboxId = NULL
 * 3. Contacts without pushName (appear as "?" in chat)
 *
 * Usage:
 *   npx tsx src/scripts/fix-ingestion-data.ts
 *
 * Idempotent: safe to run multiple times.
 */

import { getPrisma, disconnectPrisma } from '../config/database.js';

const ACCOUNT_ID = 'ee28092e-bd02-4d50-a920-b419e01adc8a';

async function main() {
  const prisma = getPrisma();

  console.log('=== Fix Ingestion Data ===\n');

  // ── 1. Find and delete fake "group contacts" ──
  // These are contacts created with a group JID as their phone number
  console.log('1. Finding fake group contacts (phone ending with @g.us)...');

  const fakeGroupContacts = await prisma.contact.findMany({
    where: {
      accountId: ACCOUNT_ID,
      phone: { endsWith: '@g.us' },
    },
    include: {
      conversations: { select: { id: true, groupId: true } },
      contactInboxes: { select: { id: true } },
    },
  });

  console.log(`   Found ${fakeGroupContacts.length} fake group contacts`);

  let deletedContacts = 0;
  let updatedConversations = 0;

  for (const fakeContact of fakeGroupContacts) {
    let canDelete = true;

    // For each conversation that references this fake contact,
    // try to reassign to a real participant from the group
    for (const conv of fakeContact.conversations) {
      if (conv.groupId) {
        // Find a real group member to use as the conversation contact
        const firstMember = await prisma.groupMember.findFirst({
          where: { groupId: conv.groupId },
          include: { contact: { select: { id: true, phone: true } } },
          orderBy: { joinedAt: 'asc' },
        });

        if (firstMember) {
          const conversation = await prisma.conversation.findUnique({
            where: { id: conv.id },
            select: { inboxId: true },
          });

          if (conversation) {
            const existingCI = await prisma.contactInbox.findFirst({
              where: {
                contactId: firstMember.contactId,
                inboxId: conversation.inboxId,
              },
            });

            await prisma.conversation.update({
              where: { id: conv.id },
              data: {
                contactId: firstMember.contactId,
                contactInboxId: existingCI?.id ?? null,
              },
            });
            updatedConversations++;
          }
        } else {
          // No real members — soft-delete the conversation (it's a group with no participants)
          await prisma.conversation.update({
            where: { id: conv.id },
            data: { deletedAt: new Date() },
          });
          updatedConversations++;
        }
      } else {
        // Non-group conversation referencing a fake group contact — soft-delete
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { deletedAt: new Date() },
        });
        updatedConversations++;
      }
    }

    // Check if any conversations still reference this contact (not yet handled)
    const remainingConvs = await prisma.conversation.count({
      where: { contactId: fakeContact.id, deletedAt: null },
    });
    if (remainingConvs > 0) {
      console.log(`   Skipping delete of ${fakeContact.phone} — still has ${remainingConvs} active conversations`);
      canDelete = false;
    }

    // Update messages that reference this fake contact as sender
    await prisma.message.updateMany({
      where: { senderContactId: fakeContact.id },
      data: { senderContactId: null },
    });

    if (canDelete) {
      // Reassign soft-deleted conversations to any real contact before deleting
      await prisma.$executeRawUnsafe(
        `UPDATE conversations SET contact_id = (SELECT id FROM contacts WHERE account_id = $1::uuid AND phone IS NOT NULL AND phone NOT LIKE '%@g.us' LIMIT 1) WHERE contact_id = $2::uuid`,
        ACCOUNT_ID, fakeContact.id
      );

      // Delete the fake contact's ContactInbox entries
      await prisma.contactInbox.deleteMany({
        where: { contactId: fakeContact.id },
      });

      // Delete the fake contact
      await prisma.contact.delete({
        where: { id: fakeContact.id },
      });
      deletedContacts++;
    }
  }

  console.log(`   Deleted ${deletedContacts} fake group contacts`);
  console.log(`   Updated ${updatedConversations} group conversations to real contacts`);

  // ── 2. Fix conversations with NULL contactInboxId ──
  console.log('\n2. Fixing conversations with NULL contactInboxId...');

  const convsWithoutCI = await prisma.conversation.findMany({
    where: {
      accountId: ACCOUNT_ID,
      contactInboxId: null,
      groupId: null, // Only fix non-group conversations
    },
    include: {
      contact: { select: { id: true, phone: true } },
    },
  });

  console.log(`   Found ${convsWithoutCI.length} non-group conversations without contactInboxId`);

  let fixedCI = 0;
  for (const conv of convsWithoutCI) {
    if (!conv.contact?.phone) continue;

    const contactInbox = await prisma.contactInbox.findFirst({
      where: {
        contactId: conv.contactId,
        inboxId: conv.inboxId,
      },
    });

    if (contactInbox) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { contactInboxId: contactInbox.id },
      });
      fixedCI++;
    }
  }

  console.log(`   Fixed ${fixedCI} conversations`);

  // ── 3. Find contacts without a proper name ──
  console.log('\n3. Finding contacts with phone-as-name...');

  const contactsWithPhoneName = await prisma.$queryRaw<{ id: string; name: string; phone: string | null }[]>`
    SELECT id, name, phone FROM contacts
    WHERE account_id = ${ACCOUNT_ID}::uuid
      AND (name LIKE '%@s.whatsapp.net' OR name ~ '^[0-9]+$')
  `;

  console.log(`   Found ${contactsWithPhoneName.length} contacts with phone-as-name`);
  console.log('   (These should be updated with pushName via Evolution API or manually)');

  // ── 4. Check for orphaned data ──
  console.log('\n4. Checking for orphaned data...');

  // Messages with invalid senderContactId
  const orphanedMessages = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM messages m
    WHERE m.account_id = ${ACCOUNT_ID}::uuid
      AND m.sender_contact_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM contacts c WHERE c.id = m.sender_contact_id
      )
  `;
  console.log(`   Orphaned messages (invalid senderContactId): ${orphanedMessages[0]?.count ?? 0}`);

  // Conversations with invalid contactId
  const orphanedConvs = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM conversations cv
    WHERE cv.account_id = ${ACCOUNT_ID}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM contacts c WHERE c.id = cv.contact_id
      )
  `;
  console.log(`   Orphaned conversations (invalid contactId): ${orphanedConvs[0]?.count ?? 0}`);

  // ── 5. Summary stats ──
  console.log('\n=== Current Data Summary ===');

  const [totalContacts, totalConversations, totalMessages, totalGroups] = await Promise.all([
    prisma.contact.count({ where: { accountId: ACCOUNT_ID } }),
    prisma.conversation.count({ where: { accountId: ACCOUNT_ID } }),
    prisma.message.count({ where: { accountId: ACCOUNT_ID } }),
    prisma.group.count({ where: { accountId: ACCOUNT_ID } }),
  ]);

  const conversationsByInbox = await prisma.conversation.groupBy({
    by: ['inboxId'],
    where: { accountId: ACCOUNT_ID },
    _count: true,
  });

  console.log(`   Total contacts: ${totalContacts}`);
  console.log(`   Total conversations: ${totalConversations}`);
  console.log(`   Total messages: ${totalMessages}`);
  console.log(`   Total groups: ${totalGroups}`);
  console.log(`   Conversations by inbox:`);
  for (const row of conversationsByInbox) {
    const inbox = await prisma.inbox.findUnique({ where: { id: row.inboxId }, select: { name: true } });
    console.log(`     - ${inbox?.name ?? row.inboxId}: ${row._count}`);
  }

  await disconnectPrisma();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
