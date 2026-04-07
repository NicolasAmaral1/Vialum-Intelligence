import type { IntegrationProvider } from './provider.interface.js';

const registry = new Map<string, IntegrationProvider>();

export function registerProvider(provider: IntegrationProvider): void {
  registry.set(provider.name, provider);
}

export function getProvider(name: string): IntegrationProvider | undefined {
  return registry.get(name);
}

export function getAllProviders(): IntegrationProvider[] {
  return Array.from(registry.values());
}

export function getProviderNames(): string[] {
  return Array.from(registry.keys());
}
