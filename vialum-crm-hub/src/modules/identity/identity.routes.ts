import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as identityService from './identity.service.js';

export async function identityRoutes(fastify: FastifyInstance) {
  // POST /identity/resolve — resolve any identifier to a unified contact map
  fastify.post('/resolve', async (
    request: FastifyRequest<{
      Body: {
        phone?: string;
        email?: string;
        name?: string;
        cpf?: string;
        externalId?: string;
        provider?: string;
        groupJid?: string;
        forceSync?: boolean;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    // At least one identifier is required
    if (!body.phone && !body.email && !body.name && !body.cpf && !body.externalId && !body.groupJid) {
      return reply.status(400).send({
        error: 'At least one identifier is required (phone, email, name, cpf, externalId, or groupJid)',
        code: 'MISSING_IDENTIFIER',
      });
    }

    try {
      const result = await identityService.resolve(accountId, {
        phone: body.phone as string | undefined,
        email: body.email as string | undefined,
        name: body.name as string | undefined,
        cpf: body.cpf as string | undefined,
        externalId: body.externalId as string | undefined,
        provider: body.provider as string | undefined,
        groupJid: body.groupJid as string | undefined,
        forceSync: body.forceSync as boolean | undefined,
      });

      return reply.send({ data: result });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
