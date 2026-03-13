import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProvider } from '../../providers/provider.registry.js';
import { PipedriveProvider } from '../../providers/pipedrive/pipedrive.provider.js';
import * as integrationsService from '../integrations/integrations.service.js';

export async function pipedriveRoutes(fastify: FastifyInstance) {
  // GET /search?phone=X — search person/deals by phone
  fastify.get('/search', async (
    request: FastifyRequest<{ Querystring: { phone?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const phone = (request.query as Record<string, string>).phone;

    if (!phone) {
      return reply.status(400).send({ error: 'phone query parameter is required', code: 'MISSING_FIELD' });
    }

    try {
      const provider = getProvider('pipedrive') as PipedriveProvider;
      const results = await provider.searchByPhone(accountId, phone);

      // Enrich deals with stage names
      const enrichedDeals = await Promise.all(
        results.deals.map(async (deal) => {
          const stageName = await provider.getStageName(accountId, deal.stage_id);
          return { ...deal, stageName };
        }),
      );

      return reply.send({ data: { persons: results.persons, deals: enrichedDeals } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /link — link a deal/person to a vialum contact
  fastify.post('/link', async (
    request: FastifyRequest<{
      Body: {
        vialumContactId: string;
        dealId?: number;
        personId?: number;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.vialumContactId) {
      return reply.status(400).send({ error: 'vialumContactId is required', code: 'MISSING_FIELD' });
    }

    const provider = getProvider('pipedrive') as PipedriveProvider;
    const results = [];

    if (body.dealId) {
      const deal = await provider.getDeal(accountId, body.dealId as number);
      if (deal) {
        const stageName = await provider.getStageName(accountId, deal.stage_id);
        const integration = await integrationsService.create(accountId, body.vialumContactId as string, {
          provider: 'pipedrive',
          externalId: String(deal.id),
          externalUrl: `https://app.pipedrive.com/deal/${deal.id}`,
          resourceType: 'deal',
          resourceName: deal.title,
          status: deal.status,
          stage: stageName ?? undefined,
          value: deal.value,
          rawData: deal as unknown as Record<string, unknown>,
        });
        results.push(integration);
      }
    }

    if (body.personId) {
      const integration = await integrationsService.create(accountId, body.vialumContactId as string, {
        provider: 'pipedrive',
        externalId: String(body.personId),
        externalUrl: `https://app.pipedrive.com/person/${body.personId}`,
        resourceType: 'person',
        resourceName: undefined,
      });
      results.push(integration);
    }

    return reply.status(201).send({ data: results });
  });
}
