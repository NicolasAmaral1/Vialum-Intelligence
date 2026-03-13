import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { oauthHelper } from '../../lib/oauth.js';
import { getProvider } from '../../providers/provider.registry.js';
import { jwtAuth } from '../../middleware/jwt-auth.js';

// OAuth provider configs (authorize URL, token URL, scopes)
const OAUTH_PROVIDERS: Record<string, {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
}> = {
  rdstation: {
    authorizeUrl: 'https://api.rd.services/auth/dialog',
    tokenUrl: 'https://api.rd.services/auth/token',
    scopes: '',
  },
};

export async function oauthRoutes(fastify: FastifyInstance) {
  // GET /oauth/:provider/authorize — redirect to provider's OAuth authorization page
  // Requires JWT (needs accountId to lookup config and pass as state)
  fastify.get<{ Params: { provider: string }; Querystring: { redirect_uri?: string } }>(
    '/:provider/authorize',
    { onRequest: jwtAuth },
    async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { provider: providerName } = request.params;
    const query = request.query as Record<string, string>;

    const oauthConfig = OAUTH_PROVIDERS[providerName];
    if (!oauthConfig) {
      return reply.status(400).send({ error: `OAuth not supported for provider: ${providerName}`, code: 'OAUTH_NOT_SUPPORTED' });
    }

    const registeredProvider = getProvider(providerName);
    if (!registeredProvider) {
      return reply.status(400).send({ error: `Unknown provider: ${providerName}`, code: 'INVALID_PROVIDER' });
    }

    // Get clientId from ProviderConfig
    const prisma = getPrisma();
    const config = await prisma.providerConfig.findUnique({
      where: { accountId_provider: { accountId, provider: providerName } },
    });

    if (!config || !config.active) {
      return reply.status(400).send({
        error: `Configure ${providerName} credentials first via PUT /providers/${providerName}`,
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }

    const providerConfig = config.config as Record<string, unknown>;
    const clientId = providerConfig.clientId as string;
    if (!clientId) {
      return reply.status(400).send({ error: 'clientId not found in provider config', code: 'MISSING_CLIENT_ID' });
    }

    const redirectUri = query.redirect_uri ?? `https://api.luminai.ia.br/crm/api/v1/oauth/${providerName}/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      ...(oauthConfig.scopes && { scope: oauthConfig.scopes }),
      state: accountId, // pass accountId as state for callback
    });

    const authorizeUrl = `${oauthConfig.authorizeUrl}?${params.toString()}`;
    return reply.redirect(authorizeUrl);
  });

  // GET /oauth/:provider/callback — handle OAuth callback, exchange code for tokens
  // NO AUTH — external redirect from OAuth provider
  fastify.get('/:provider/callback', async (
    request: FastifyRequest<{
      Params: { provider: string };
      Querystring: { code?: string; state?: string; error?: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { provider: providerName } = request.params;
    const query = request.query as Record<string, string>;

    if (query.error) {
      return reply.status(400).send({ error: `OAuth error: ${query.error}`, code: 'OAUTH_ERROR' });
    }

    const code = query.code;
    const accountId = query.state;

    if (!code || !accountId) {
      return reply.status(400).send({ error: 'Missing code or state parameter', code: 'OAUTH_MISSING_PARAMS' });
    }

    const oauthConfig = OAUTH_PROVIDERS[providerName];
    if (!oauthConfig) {
      return reply.status(400).send({ error: `OAuth not supported for provider: ${providerName}`, code: 'OAUTH_NOT_SUPPORTED' });
    }

    // Get client credentials from ProviderConfig
    const prisma = getPrisma();
    const config = await prisma.providerConfig.findUnique({
      where: { accountId_provider: { accountId, provider: providerName } },
    });

    if (!config) {
      return reply.status(400).send({ error: 'Provider not configured', code: 'PROVIDER_NOT_CONFIGURED' });
    }

    const providerConfig = config.config as Record<string, unknown>;
    const clientId = providerConfig.clientId as string;
    const clientSecret = providerConfig.clientSecret as string;

    const redirectUri = `https://api.luminai.ia.br/crm/api/v1/oauth/${providerName}/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      return reply.status(400).send({
        error: `Token exchange failed: ${errorBody}`,
        code: 'OAUTH_TOKEN_FAILED',
      });
    }

    const tokenData = await tokenResponse.json() as Record<string, unknown>;
    await oauthHelper.storeToken(accountId, providerName, tokenData);

    return reply.send({
      status: 'ok',
      message: `${providerName} OAuth configured successfully`,
      provider: providerName,
    });
  });
}
