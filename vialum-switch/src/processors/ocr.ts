// ════════════════════════════════════════════════════════════
// OCR Processor — Delegates to strategy engine
// ════════════════════════════════════════════════════════════

import { executeWithStrategy } from '../lib/strategy-engine.js';
import type { Processor, ProcessInput, ProcessResult } from './processor.interface.js';

export const ocrProcessor: Processor = {
  name: 'ocr',
  supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'],

  async process(input: ProcessInput): Promise<ProcessResult> {
    if (!input.accountId) {
      return { processor: 'ocr', provider: 'none', result: { error: 'accountId required' }, confidence: 0, processingMs: 0 };
    }
    return executeWithStrategy(input.accountId, 'ocr', input);
  },
};
