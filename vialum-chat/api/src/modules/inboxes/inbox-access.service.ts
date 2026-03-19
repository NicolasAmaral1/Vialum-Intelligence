import { getPrisma } from '../../config/database.js';

/**
 * Resolves which inbox IDs a user can access based on their role:
 * - owner/admin: ALL inboxes in the account
 * - supervisor: own inboxes + inboxes of supervised agents
 * - agent: only their assigned inboxes
 *
 * Returns null if user can see ALL inboxes (admin/owner).
 * Returns string[] of inbox IDs if access is restricted.
 */
export async function getAccessibleInboxIds(
  accountId: string,
  userId: string,
): Promise<string[] | null> {
  const prisma = getPrisma();

  const accountUser = await prisma.accountUser.findFirst({
    where: { accountId, userId },
    select: {
      id: true,
      role: true,
      inboxAccess: { select: { inboxId: true } },
    },
  });

  if (!accountUser) return [];

  // Admin/owner see everything
  if (accountUser.role === 'admin' || accountUser.role === 'owner') {
    return null; // null = no restriction
  }

  // Collect own inbox IDs
  const ownInboxIds = accountUser.inboxAccess.map((ia) => ia.inboxId);

  if (accountUser.role === 'supervisor') {
    // Get all supervisees' inbox IDs
    const supervisees = await prisma.accountUser.findMany({
      where: { accountId, supervisorId: accountUser.id },
      select: {
        inboxAccess: { select: { inboxId: true } },
      },
    });

    const superviseeInboxIds = supervisees.flatMap((s) =>
      s.inboxAccess.map((ia) => ia.inboxId),
    );

    // Deduplicate
    return [...new Set([...ownInboxIds, ...superviseeInboxIds])];
  }

  // Agent: only own inboxes
  // If no inbox members assigned, return empty (sees nothing)
  return ownInboxIds;
}
