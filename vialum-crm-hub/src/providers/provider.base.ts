import { getPrisma } from '../config/database.js';
import type {
  CrmProvider,
  ProviderCapabilities,
  ProviderSearchParams,
  ProviderResource,
  ProviderSyncResult,
} from './provider.interface.js';

export abstract class BaseProvider<TConfig> implements CrmProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected async getConfig(accountId: string): Promise<TConfig> {
    const prisma = getPrisma();
    const config = await prisma.providerConfig.findUnique({
      where: { accountId_provider: { accountId, provider: this.name } },
    });

    if (!config || !config.active) {
      throw { statusCode: 404, message: `${this.name} not configured`, code: 'PROVIDER_NOT_CONFIGURED' };
    }

    return config.config as unknown as TConfig;
  }

  abstract testConnection(accountId: string): Promise<boolean>;
  abstract search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]>;

  async sync(accountId: string, params: ProviderSearchParams): Promise<ProviderSyncResult> {
    try {
      const resources = await this.search(accountId, params);
      return { provider: this.name, resources };
    } catch (err: any) {
      const msg = err?.message ?? `${this.name} sync failed`;
      return { provider: this.name, resources: [], errors: [msg] };
    }
  }
}
