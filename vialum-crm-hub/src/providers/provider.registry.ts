import type { CrmProvider } from './provider.interface.js';

const registry = new Map<string, CrmProvider>();

export function registerProvider(provider: CrmProvider): void {
  registry.set(provider.name, provider);
}

export function getProvider(name: string): CrmProvider | undefined {
  return registry.get(name);
}

export function getAllProviders(): CrmProvider[] {
  return Array.from(registry.values());
}

export function getProviderNames(): string[] {
  return Array.from(registry.keys());
}
