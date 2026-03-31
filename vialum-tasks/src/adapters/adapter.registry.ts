import type { ExecutionAdapter } from './adapter.interface.js';

const adapters = new Map<string, ExecutionAdapter>();

export function registerAdapter(adapter: ExecutionAdapter): void {
  if (adapters.has(adapter.type)) {
    throw new Error(`Adapter '${adapter.type}' already registered`);
  }
  adapters.set(adapter.type, adapter);
  console.log(`[adapters] Registered: ${adapter.type} (${adapter.displayName})`);
}

export function getAdapter(type: string): ExecutionAdapter {
  const adapter = adapters.get(type);
  if (!adapter) {
    throw new Error(`Unknown adapter type: '${type}'. Available: ${listAdapterTypes().join(', ')}`);
  }
  return adapter;
}

export function listAdapterTypes(): string[] {
  return Array.from(adapters.keys());
}
