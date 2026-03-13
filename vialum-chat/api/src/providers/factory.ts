import type { IWhatsAppProvider, IGroupProvider } from './whatsapp.interface.js';
import { EvolutionAdapter } from './evolution/evolution.adapter.js';
import { CloudApiAdapter } from './cloud-api/cloud.adapter.js';

const evolutionAdapter = new EvolutionAdapter();

const adapters: Record<string, IWhatsAppProvider> = {
  evolution_api: evolutionAdapter,
  cloud_api: new CloudApiAdapter(),
};

/**
 * Returns the appropriate WhatsApp provider adapter based on the inbox's `provider` field.
 */
export function getWhatsAppProvider(provider: string): IWhatsAppProvider {
  const adapter = adapters[provider];

  if (!adapter) {
    throw new Error(`Unsupported WhatsApp provider: "${provider}". Supported: ${Object.keys(adapters).join(', ')}`);
  }

  return adapter;
}

/**
 * Returns the group provider adapter if the provider supports group management.
 * Currently only Evolution API supports groups.
 */
export function getGroupProvider(provider: string): IGroupProvider | null {
  if (provider === 'evolution_api') return evolutionAdapter;
  return null;
}
