import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProvider } from '../../providers/provider.registry.js';
import { GDriveProvider } from '../../providers/gdrive/gdrive.provider.js';
import * as integrationsService from '../integrations/integrations.service.js';

export async function gdriveRoutes(fastify: FastifyInstance) {
  // GET /search?name=X — search folders
  fastify.get('/search', async (
    request: FastifyRequest<{ Querystring: { name?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;

    if (!query.name) {
      return reply.status(400).send({ error: 'name query parameter is required', code: 'MISSING_FIELD' });
    }

    try {
      const provider = getProvider('gdrive') as GDriveProvider;
      const folders = await provider.searchFolders(accountId, query.name);
      return reply.send({ data: { folders } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /link — link a folder to a vialum contact
  fastify.post('/link', async (
    request: FastifyRequest<{
      Body: { vialumContactId: string; folderId: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.vialumContactId || !body.folderId) {
      return reply.status(400).send({ error: 'vialumContactId and folderId are required', code: 'MISSING_FIELD' });
    }

    const provider = getProvider('gdrive') as GDriveProvider;
    const file = await provider.getFile(accountId, body.folderId as string);

    const integration = await integrationsService.create(accountId, body.vialumContactId as string, {
      provider: 'gdrive',
      externalId: body.folderId as string,
      externalUrl: file?.webViewLink ?? `https://drive.google.com/drive/folders/${body.folderId}`,
      resourceType: 'folder',
      resourceName: file?.name ?? undefined,
    });

    return reply.status(201).send({ data: integration });
  });
}
