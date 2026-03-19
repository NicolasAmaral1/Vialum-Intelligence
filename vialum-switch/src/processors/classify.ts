// ════════════════════════════════════════════════════════════
// Classify Processor — Delegates to strategy engine
// Labels and keywords loaded from DB per tenant
// ════════════════════════════════════════════════════════════

import { executeWithStrategy } from '../lib/strategy-engine.js';
import type { Processor, ProcessInput, ProcessResult } from './processor.interface.js';

export const classifyProcessor: Processor = {
  name: 'classify',
  supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],

  async process(input: ProcessInput): Promise<ProcessResult> {
    if (!input.accountId) {
      return { processor: 'classify', provider: 'none', result: { error: 'accountId required' }, confidence: 0, processingMs: 0 };
    }
    if (!input.params?.classifier) {
      return { processor: 'classify', provider: 'none', result: { error: 'params.classifier required' }, confidence: 0, processingMs: 0 };
    }
    return executeWithStrategy(input.accountId, 'classify', input);
  },
};
