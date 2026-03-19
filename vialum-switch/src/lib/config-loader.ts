// ════════════════════════════════════════════════════════════
// Config Loader — Loads tenant-specific config from database
// ════════════════════════════════════════════════════════════

import { getPrisma } from '../config/database.js';

export interface StrategyStep {
  provider: string;
  minConfidence: number;
  fallbackOnLow: boolean;
}

export interface ClassifierLabels {
  [label: string]: { strong: string[]; weak: string[] };
}

export interface ProviderSettings {
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export async function loadStrategy(accountId: string, processor: string): Promise<StrategyStep[]> {
  const prisma = getPrisma();
  const row = await prisma.switchStrategy.findUnique({
    where: { accountId_processor: { accountId, processor } },
  });
  return (row?.strategy as unknown as StrategyStep[]) ?? [];
}

export async function loadClassifier(accountId: string, classifierName: string): Promise<ClassifierLabels | null> {
  const prisma = getPrisma();
  const row = await prisma.switchClassifier.findUnique({
    where: { accountId_name: { accountId, name: classifierName } },
  });
  return (row?.labels as unknown as ClassifierLabels) ?? null;
}

export async function loadProviderConfig(accountId: string, provider: string): Promise<ProviderSettings | null> {
  const prisma = getPrisma();
  const row = await prisma.switchProviderConfig.findUnique({
    where: { accountId_provider: { accountId, provider } },
  });
  if (!row || !row.active) return null;
  return {
    credentials: row.credentials as Record<string, unknown>,
    settings: row.settings as Record<string, unknown>,
  };
}

export async function loadAutoRules(accountId: string, source: string, event: string, mimeType: string) {
  const prisma = getPrisma();
  const rules = await prisma.switchAutoRule.findMany({
    where: { accountId, active: true, event },
    orderBy: { priority: 'desc' },
  });

  return rules.filter((r) => {
    // Source match
    if (r.source !== '*' && r.source !== source) return false;
    // Mime pattern match
    if (r.mimePattern === '*/*') return true;
    if (r.mimePattern.endsWith('/*')) {
      return mimeType.startsWith(r.mimePattern.replace('/*', '/'));
    }
    return r.mimePattern === mimeType;
  });
}

export async function loadWebhookConfigs(accountId: string, event: string) {
  const prisma = getPrisma();
  return prisma.switchWebhookConfig.findMany({
    where: { accountId, active: true, events: { has: event } },
  });
}
