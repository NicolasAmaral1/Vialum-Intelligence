import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as aiSuggestionsService from './ai-suggestions.service.js';

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'sent', 'edited']).optional(),
  conversationId: z.string().uuid().optional(),
  talkId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const updateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'edited']),
  editedContent: z.string().min(1).optional(),
}).refine(
  (data) => data.status !== 'edited' || !!data.editedContent,
  { message: 'editedContent is required when status is "edited"', path: ['editedContent'] },
);

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(['approved', 'rejected']),
});

type AccountParams = { accountId: string };
type SuggestionParams = { accountId: string; suggestionId: string };

export async function aiSuggestionRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: AccountParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const filters = listQuerySchema.parse(request.query);
    const result = await aiSuggestionsService.findAll(accountId, filters);
    return reply.status(200).send(result);
  });

  // PATCH /:suggestionId
  fastify.patch('/:suggestionId', async (request: FastifyRequest<{ Params: SuggestionParams }>, reply: FastifyReply) => {
    const { accountId, suggestionId } = request.params;
    const body = updateSchema.parse(request.body);
    const userId = request.jwtPayload.userId;

    try {
      const data = await aiSuggestionsService.updateSuggestion(accountId, suggestionId, userId, body);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /bulk
  fastify.post('/bulk', async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = bulkUpdateSchema.parse(request.body);
    const userId = request.jwtPayload.userId;

    const results = await aiSuggestionsService.bulkUpdate(accountId, userId, body);
    return reply.status(200).send({ data: results });
  });
}
