import { getPrisma } from '../config/database.js';

export interface OAuthRefreshOpts {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  extraParams?: Record<string, string>;
}

export class OAuthHelper {
  /**
   * Get a valid access token for the given provider.
   * Auto-refreshes if the token is expired or about to expire (5-min buffer).
   */
  async getValidToken(accountId: string, provider: string, refreshOpts: OAuthRefreshOpts): Promise<string> {
    const prisma = getPrisma();
    const stored = await prisma.oAuthToken.findUnique({
      where: { accountId_provider: { accountId, provider } },
    });

    if (!stored) {
      throw { statusCode: 401, message: `No OAuth token for ${provider}. Run the OAuth flow first.`, code: 'OAUTH_NOT_CONFIGURED' };
    }

    // Check if expired (with 5-minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (stored.expiresAt && stored.expiresAt.getTime() < Date.now() + bufferMs) {
      if (!stored.refreshToken) {
        throw { statusCode: 401, message: `OAuth token for ${provider} expired and no refresh token available`, code: 'OAUTH_EXPIRED' };
      }
      return this.refresh(accountId, provider, stored.refreshToken, refreshOpts);
    }

    return stored.accessToken;
  }

  /**
   * Refresh an OAuth token and update storage.
   */
  private async refresh(accountId: string, provider: string, refreshToken: string, opts: OAuthRefreshOpts): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      ...opts.extraParams,
    });

    const response = await fetch(opts.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw { statusCode: 401, message: `Failed to refresh ${provider} token: ${errorBody}`, code: 'OAUTH_REFRESH_FAILED' };
    }

    const data = await response.json() as Record<string, unknown>;
    const accessToken = data.access_token as string;
    const expiresIn = data.expires_in as number | undefined;
    const newRefreshToken = (data.refresh_token as string) ?? refreshToken;

    const prisma = getPrisma();
    await prisma.oAuthToken.update({
      where: { accountId_provider: { accountId, provider } },
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        rawResponse: data as any,
      },
    });

    return accessToken;
  }

  /**
   * Store an OAuth token (from initial authorization flow).
   */
  async storeToken(accountId: string, provider: string, tokenResponse: Record<string, unknown>): Promise<void> {
    const prisma = getPrisma();
    const accessToken = tokenResponse.access_token as string;
    const refreshToken = tokenResponse.refresh_token as string | undefined;
    const expiresIn = tokenResponse.expires_in as number | undefined;

    await prisma.oAuthToken.upsert({
      where: { accountId_provider: { accountId, provider } },
      create: {
        accountId,
        provider,
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        rawResponse: tokenResponse as any,
      },
      update: {
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        rawResponse: tokenResponse as any,
      },
    });
  }
}

export const oauthHelper = new OAuthHelper();
