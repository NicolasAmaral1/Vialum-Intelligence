// ════════════════════════════════════════════════════════════
// Transcribe Processor — Delegates to strategy engine
// ════════════════════════════════════════════════════════════

import { executeWithStrategy } from '../lib/strategy-engine.js';
import type { Processor, ProcessInput, ProcessResult } from './processor.interface.js';

export const transcribeProcessor: Processor = {
  name: 'transcribe',
  supportedMimeTypes: ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm'],

  async process(input: ProcessInput): Promise<ProcessResult> {
    if (!input.accountId) {
      return { processor: 'transcribe', provider: 'none', result: { error: 'accountId required' }, confidence: 0, processingMs: 0 };
    }
    return executeWithStrategy(input.accountId, 'transcribe', input);
  },
};
