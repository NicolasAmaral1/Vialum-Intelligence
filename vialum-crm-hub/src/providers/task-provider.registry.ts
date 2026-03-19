// ════════════════════════════════════════════════════════════
// Task Provider Registry — Maps provider names to TaskProvider instances
// ════════════════════════════════════════════════════════════

import type { TaskProvider } from './task-provider.interface.js';

const registry = new Map<string, TaskProvider>();

export function registerTaskProvider(provider: TaskProvider): void {
  registry.set(provider.name, provider);
}

export function getTaskProvider(name: string): TaskProvider | undefined {
  return registry.get(name);
}

export function getTaskProviderNames(): string[] {
  return Array.from(registry.keys());
}
