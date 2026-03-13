import { BaseProvider } from '../provider.base.js';
import { apiGet } from '../../lib/http.js';
import type { ProviderCapabilities, ProviderSearchParams, ProviderResource } from '../provider.interface.js';
import type { GDriveConfig, GDriveFile } from './gdrive.types.js';

const BASE_URL = 'https://www.googleapis.com/drive/v3';

export class GDriveProvider extends BaseProvider<GDriveConfig> {
  readonly name = 'gdrive';
  readonly capabilities: ProviderCapabilities = {
    searchByPhone: false,
    searchByEmail: false,
    searchByName: true,
    hasOAuth: false,
    resourceTypes: ['folder'],
    category: 'documents',
  };

  private async getAccessToken(config: GDriveConfig): Promise<string> {
    if (config.accessToken) return config.accessToken;

    if (config.refreshToken && config.clientId && config.clientSecret) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw { statusCode: 401, message: 'Failed to refresh Google Drive token', code: 'GDRIVE_AUTH_FAILED' };
      }

      const data = await response.json() as { access_token: string };
      return data.access_token;
    }

    throw { statusCode: 401, message: 'No valid Google Drive credentials', code: 'GDRIVE_AUTH_FAILED' };
  }

  private headers(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  async testConnection(accountId: string): Promise<boolean> {
    const config = await this.getConfig(accountId);
    try {
      const token = await this.getAccessToken(config);
      const result = await apiGet<{ user: { displayName: string } }>(
        'https://www.googleapis.com/drive/v3/about?fields=user',
        this.headers(token),
      );
      return !!result.user?.displayName;
    } catch {
      return false;
    }
  }

  async search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]> {
    if (!params.name) return [];

    const config = await this.getConfig(accountId);
    const folders = await this.searchFolders(config, params.name);

    return folders.slice(0, 5).map((folder) => ({
      externalId: folder.id,
      externalUrl: folder.webViewLink,
      resourceType: 'folder',
      resourceName: folder.name,
      rawData: folder as unknown as Record<string, unknown>,
    }));
  }

  // ── Helpers (exposed for backward-compat routes) ──

  async searchFolders(configOrAccountId: GDriveConfig | string, query: string): Promise<GDriveFile[]> {
    let config: GDriveConfig;
    if (typeof configOrAccountId === 'string') {
      config = await this.getConfig(configOrAccountId);
    } else {
      config = configOrAccountId;
    }

    const token = await this.getAccessToken(config);
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name contains '${query.replace(/'/g, "\\'")}'`);
    const url = `${BASE_URL}/files?q=${q}&fields=files(id,name,mimeType,webViewLink,parents,createdTime)&pageSize=10`;

    const result = await apiGet<{ files: GDriveFile[] }>(url, this.headers(token));
    return result.files ?? [];
  }

  async getFile(accountId: string, fileId: string): Promise<GDriveFile | null> {
    const config = await this.getConfig(accountId);
    const token = await this.getAccessToken(config);
    const url = `${BASE_URL}/files/${fileId}?fields=id,name,mimeType,webViewLink,parents,createdTime,modifiedTime`;

    try {
      return await apiGet<GDriveFile>(url, this.headers(token));
    } catch {
      return null;
    }
  }
}
