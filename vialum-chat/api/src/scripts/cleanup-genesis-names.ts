/**
 * Cleanup script: resets contacts named "Genesis" or "Equipe Genesis"
 * back to their phone number.
 *
 * The next incoming message with a real pushName will update the name
 * automatically via webhook-process.worker.ts.
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-genesis-names.ts
 *   npx tsx src/scripts/cleanup-genesis-names.ts --dry-run
 */

import { getPrisma, disconnectPrisma } from '../config/database.js';

const INSTANCE_PATTERNS = ['genesis', 'equipe genesis'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = getPrisma();

  console.log(dryRun ? '[DRY RUN] Scanning contacts...' : 'Cleaning up contacts...');

  // Find all contacts whose name matches the instance name pattern
  const contacts = await prisma.contact.findMany({
    where: {
      name: { in: INSTANCE_PATTERNS, mode: 'insensitive' },
      deletedAt: null,
    },
    select: { id: true, name: true, phone: true, customName: true, crmName: true },
  });

  console.log(`Found ${contacts.length} contacts with instance name.`);

  if (contacts.length === 0) {
    console.log('Nothing to clean up.');
    await disconnectPrisma();
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const contact of contacts) {
    // Skip if already has a customName or crmName (display hierarchy will handle it)
    if (contact.customName || contact.crmName) {
      console.log(`  SKIP ${contact.id} — already has ${contact.customName ? 'customName' : 'crmName'}: "${contact.customName || contact.crmName}"`);
      skipped++;
      continue;
    }

    const newName = contact.phone || 'Sem nome';
    console.log(`  ${dryRun ? 'WOULD UPDATE' : 'UPDATE'} ${contact.id}: "${contact.name}" → "${newName}"`);

    if (!dryRun) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: newName },
      });
      updated++;
    }
  }

  console.log(`\nDone. ${dryRun ? 'Would update' : 'Updated'}: ${dryRun ? contacts.length - skipped : updated}, Skipped: ${skipped}`);
  await disconnectPrisma();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
