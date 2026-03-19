// ════════════════════════════════════════════════════════════
// Strategy Engine — Executes provider chain from DB config
// Replaces hardcoded fallback logic in each processor
// ════════════════════════════════════════════════════════════

import { loadStrategy, loadProviderConfig, loadClassifier, type StrategyStep } from './config-loader.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

export interface ProviderExecutor {
  readonly name: string;
  execute(
    input: ProcessInput,
    providerSettings: Record<string, unknown>,
    providerCredentials: Record<string, unknown>,
    classifierLabels?: Record<string, { strong: string[]; weak: string[] }>,
  ): Promise<ProcessResult>;
}

const providerRegistry = new Map<string, ProviderExecutor>();

export function registerProviderExecutor(executor: ProviderExecutor): void {
  providerRegistry.set(executor.name, executor);
}

export function getProviderExecutor(name: string): ProviderExecutor | undefined {
  return providerRegistry.get(name);
}

export async function executeWithStrategy(
  accountId: string,
  processorName: string,
  input: ProcessInput,
): Promise<ProcessResult> {
  const strategy = await loadStrategy(accountId, processorName);

  if (strategy.length === 0) {
    return {
      processor: processorName,
      provider: 'none',
      result: { error: `No strategy configured for processor: ${processorName}` },
      confidence: 0,
      processingMs: 0,
    };
  }

  // Load classifier data if classify processor
  let classifierLabels: Record<string, { strong: string[]; weak: string[] }> | undefined;
  if (processorName === 'classify' && input.params?.classifier) {
    const labels = await loadClassifier(accountId, input.params.classifier as string);
    if (labels) classifierLabels = labels;
  }

  let bestResult: ProcessResult | null = null;

  for (const step of strategy) {
    const executor = providerRegistry.get(step.provider);
    if (!executor) continue;

    const config = await loadProviderConfig(accountId, step.provider);

    try {
      const result = await executor.execute(
        input,
        config?.settings ?? {},
        config?.credentials ?? {},
        classifierLabels,
      );

      // If confidence meets threshold, accept
      if ((result.confidence ?? 0) >= step.minConfidence) {
        return result;
      }

      // Track best result so far
      if (!bestResult || (result.confidence ?? 0) > (bestResult.confidence ?? 0)) {
        bestResult = result;
      }

      // If low confidence and fallback enabled, try next
      if (step.fallbackOnLow) continue;

      // If fallback not enabled, return what we have
      return result;
    } catch (err) {
      // Provider failed — try next if fallback enabled
      if (step.fallbackOnLow) continue;

      return {
        processor: processorName,
        provider: step.provider,
        result: { error: String(err) },
        confidence: 0,
        processingMs: 0,
      };
    }
  }

  // All providers tried, return best result
  return bestResult ?? {
    processor: processorName,
    provider: 'none',
    result: { error: 'All providers failed or returned low confidence' },
    confidence: 0,
    processingMs: 0,
  };
}
