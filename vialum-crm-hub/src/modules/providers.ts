import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../config/database.js';
import { getProvider, getProviderNames } from '../providers/provider.registry.js';

export async function providerRoutes(fastify: FastifyInstance) {
  // GET / — list configured providers
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();

    const configs = await prisma.providerConfig.findMany({
      where: { accountId },
      select: { provider: true, active: true, createdAt: true, updatedAt: true },
    });

    return reply.send({ data: configs });
  });

  // PUT /:provider — configure provider credentials
  fastify.put('/:provider', async (
    request: FastifyRequest<{ Params: { provider: string }; Body: Record<string, unknown> }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const { provider } = request.params;
    const validProviders = getProviderNames();

    if (!validProviders.includes(provider)) {
      return reply.status(400).send({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`, code: 'INVALID_PROVIDER' });
    }

    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();

    const providerObj = getProvider(provider);
    const category = providerObj?.capabilities.category ?? 'crm';

    const config = await prisma.providerConfig.upsert({
      where: { accountId_provider: { accountId, provider } },
      create: {
        accountId,
        provider,
        category,
        config: body as any,
        active: true,
      },
      update: {
        category,
        config: body as any,
        active: true,
      },
    });

    return reply.send({ data: { provider: config.provider, active: config.active, updatedAt: config.updatedAt } });
  });

  // POST /:provider/test — test provider connection
  fastify.post('/:provider/test', async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const { provider: providerName } = request.params;

    const provider = getProvider(providerName);
    if (!provider) {
      return reply.status(400).send({ error: 'Invalid provider', code: 'INVALID_PROVIDER' });
    }

    let ok = false;
    try {
      ok = await provider.testConnection(accountId);
    } catch {
      ok = false;
    }

    return reply.send({ data: { provider: providerName, connected: ok } });
  });

  // DELETE /:provider — deactivate provider
  fastify.delete('/:provider', async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const { provider } = request.params;
    const prisma = getPrisma();

    await prisma.providerConfig.updateMany({
      where: { accountId, provider },
      data: { active: false },
    });

    return reply.status(204).send();
  });
}
