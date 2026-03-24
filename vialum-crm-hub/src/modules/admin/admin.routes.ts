import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../../config/database.js';

export async function adminRoutes(fastify: FastifyInstance) {

  // GET /admin/sync-status — Sync status per tenant
  fastify.get('/sync-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId, role } = request.jwtPayload!;

    // Only admin/owner can see sync status
    if (role !== 'admin' && role !== 'owner' && role !== 'service') {
      return reply.status(403).send({ error: 'Admin required', code: 'ADMIN_REQUIRED' });
    }

    const prisma = getPrisma();

    const [providers, contactCount, aliasCount] = await Promise.all([
      prisma.providerConfig.findMany({
        where: { accountId },
        select: {
          provider: true,
          category: true,
          active: true,
          lastSyncAt: true,
          syncIntervalMinutes: true,
        },
        orderBy: { provider: 'asc' },
      }),
      prisma.crmContact.count({ where: { accountId } }),
      prisma.contactAlias.count({ where: { accountId } }),
    ]);

    // Count integrations per provider
    const integrationCounts = await prisma.crmIntegration.groupBy({
      by: ['provider'],
      where: {
        contact: { accountId },
        active: true,
      },
      _count: true,
    });

    const integrationMap = new Map(integrationCounts.map((i) => [i.provider, i._count]));

    return reply.send({
      data: {
        accountId,
        contactCount,
        aliasCount,
        providers: providers.map((p) => ({
          provider: p.provider,
          category: p.category,
          active: p.active,
          lastSyncAt: p.lastSyncAt,
          syncIntervalMinutes: p.syncIntervalMinutes,
          integrationCount: integrationMap.get(p.provider) ?? 0,
          status: !p.active
            ? 'disabled'
            : !p.lastSyncAt
              ? 'never_synced'
              : Date.now() - new Date(p.lastSyncAt).getTime() > (p.syncIntervalMinutes ?? 240) * 60 * 1000
                ? 'stale'
                : 'fresh',
        })),
      },
    });
  });
}
