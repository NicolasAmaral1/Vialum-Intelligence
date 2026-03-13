import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as integrationsService from './integrations.service.js';

export async function integrationRoutes(fastify: FastifyInstance) {
  // GET /contacts/:vialumContactId/integrations
  fastify.get('/contacts/:vialumContactId/integrations', async (
    request: FastifyRequest<{ Params: { vialumContactId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const integrations = await integrationsService.listByContact(accountId, request.params.vialumContactId);
    return reply.send({ data: integrations });
  });

  // POST /contacts/:vialumContactId/integrations
  fastify.post('/contacts/:vialumContactId/integrations', async (
    request: FastifyRequest<{
      Params: { vialumContactId: string };
      Body: {
        provider: string;
        externalId: string;
        externalUrl?: string;
        resourceType: string;
        resourceName?: string;
        status?: string;
        stage?: string;
        value?: number;
        rawData?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.provider || !body.externalId || !body.resourceType) {
      return reply.status(400).send({ error: 'provider, externalId, and resourceType are required', code: 'MISSING_FIELD' });
    }

    const integration = await integrationsService.create(accountId, request.params.vialumContactId, {
      provider: body.provider as string,
      externalId: body.externalId as string,
      externalUrl: body.externalUrl as string | undefined,
      resourceType: body.resourceType as string,
      resourceName: body.resourceName as string | undefined,
      status: body.status as string | undefined,
      stage: body.stage as string | undefined,
      value: body.value as number | undefined,
      rawData: body.rawData as Record<string, unknown> | undefined,
    });

    return reply.status(201).send({ data: integration });
  });

  // DELETE /integrations/:id
  fastify.delete('/integrations/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    try {
      await integrationsService.remove(accountId, request.params.id);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
