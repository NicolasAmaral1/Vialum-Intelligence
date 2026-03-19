// ════════════════════════════════════════════════════════════
// Files Routes — Media upload, download, metadata, pre-signed URLs
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as filesService from './files.service.js';

export async function fileRoutes(fastify: FastifyInstance) {

  // POST /files — Upload file (multipart/form-data)
  fastify.post('/files', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file provided', code: 'MISSING_FILE' });

    const buffer = await data.toBuffer();
    const fields = data.fields as Record<string, { value?: string }>;

    const file = await filesService.uploadFile({
      accountId,
      filename: data.filename,
      mimeType: data.mimetype,
      buffer,
      contextType: fields.context_type?.value,
      contextId: fields.context_id?.value,
      tags: fields.tags?.value ? (fields.tags.value as string).split(',').map(t => t.trim()) : undefined,
      metadata: fields.metadata?.value ? JSON.parse(fields.metadata.value as string) : undefined,
      uploadedBy: fields.uploaded_by?.value,
    });

    return reply.status(201).send({ data: file });
  });

  // POST /files/from-url — Download from external URL and store
  fastify.post('/files/from-url', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.url) return reply.status(400).send({ error: 'url is required', code: 'MISSING_FIELD' });

    try {
      const file = await filesService.uploadFromUrl({
        accountId,
        url: body.url as string,
        filename: body.filename as string | undefined,
        headers: body.headers as Record<string, string> | undefined,
        contextType: body.context_type as string | undefined,
        contextId: body.context_id as string | undefined,
        tags: body.tags as string[] | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });

      return reply.status(201).send({ data: file });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // POST /files/from-whatsapp — Download WhatsApp media and store
  fastify.post('/files/from-whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.provider) return reply.status(400).send({ error: 'provider is required', code: 'MISSING_FIELD' });

    try {
      const file = await filesService.uploadFromWhatsApp({
        accountId,
        provider: body.provider as 'evolution_api' | 'cloud_api',
        mediaUrl: body.mediaUrl as string | undefined,
        mediaId: body.mediaId as string | undefined,
        accessToken: body.accessToken as string | undefined,
        instanceName: body.instanceName as string | undefined,
        instanceBaseUrl: body.instanceBaseUrl as string | undefined,
        filename: body.filename as string | undefined,
        mimeType: body.mimeType as string | undefined,
        contextType: body.context_type as string | undefined,
        contextId: body.context_id as string | undefined,
        tags: body.tags as string[] | undefined,
      });

      return reply.status(201).send({ data: file });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /files/:fileId — Get file metadata
  fastify.get('/files/:fileId', async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const file = await filesService.getFile(accountId, request.params.fileId);
    if (!file) return reply.status(404).send({ error: 'File not found', code: 'NOT_FOUND' });
    return reply.send({ data: file });
  });

  // GET /files/:fileId/url — Get pre-signed URL
  fastify.get('/files/:fileId/url', async (
    request: FastifyRequest<{ Params: { fileId: string }; Querystring: { expires?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const expiresIn = request.query.expires ? parseInt(request.query.expires, 10) : undefined;

    try {
      const result = await filesService.getPresignedUrl(accountId, request.params.fileId, expiresIn);
      return reply.send({ data: result });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /files — List files with filters
  fastify.get('/files', async (
    request: FastifyRequest<{ Querystring: { context_type?: string; context_id?: string; tags?: string; limit?: string; offset?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const q = request.query;

    const result = await filesService.listFiles(accountId, {
      contextType: q.context_type,
      contextId: q.context_id,
      tags: q.tags ? q.tags.split(',').map(t => t.trim()) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });

    return reply.send({ data: result.files, total: result.total });
  });

  // PATCH /files/:fileId/classification — Update classification (called by Classification Hub)
  fastify.patch('/files/:fileId/classification', async (
    request: FastifyRequest<{ Params: { fileId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    const file = await filesService.updateClassification(accountId, request.params.fileId, body as Record<string, unknown>);
    return reply.send({ data: file });
  });

  // DELETE /files/:fileId — Soft delete file
  fastify.delete('/files/:fileId', async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    await filesService.deleteFile(accountId, request.params.fileId);
    return reply.send({ success: true });
  });
}
