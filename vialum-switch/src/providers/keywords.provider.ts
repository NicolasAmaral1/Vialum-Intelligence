// ════════════════════════════════════════════════════════════
// Keywords Provider — OCR + keyword matching (free)
// Uses Tesseract for OCR, then matches against classifier labels from DB
// ════════════════════════════════════════════════════════════

import { tesseractProvider } from './tesseract.provider.js';
import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

function matchKeywords(
  text: string,
  labels: Record<string, { strong: string[]; weak: string[] }>,
): { label: string; score: number }[] {
  const upper = text.toUpperCase();
  const results: { label: string; score: number }[] = [];

  for (const [label, rule] of Object.entries(labels)) {
    let score = 0;
    for (const kw of rule.strong) {
      if (upper.includes(kw)) score += 3;
    }
    for (const kw of rule.weak) {
      if (upper.includes(kw)) score += 1;
    }
    results.push({ label, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

export const keywordsProvider: ProviderExecutor = {
  name: 'keywords',

  async execute(
    input: ProcessInput,
    settings: Record<string, unknown>,
    credentials: Record<string, unknown>,
    classifierLabels?: Record<string, { strong: string[]; weak: string[] }>,
  ): Promise<ProcessResult> {
    const start = Date.now();

    if (!classifierLabels || Object.keys(classifierLabels).length === 0) {
      return {
        processor: 'classify',
        provider: 'keywords',
        result: { error: 'No classifier labels provided' },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }

    // Step 1: OCR via Tesseract
    const ocrResult = await tesseractProvider.execute(input, settings, credentials);
    const text = (ocrResult.result as { text?: string }).text ?? '';

    if (text.length < 10) {
      return {
        processor: 'classify',
        provider: 'keywords',
        result: { label: 'OUTRO', ocrText: text, reason: 'OCR extracted too little text' },
        confidence: 0.1,
        processingMs: Date.now() - start,
      };
    }

    // Step 2: Match keywords
    const matches = matchKeywords(text, classifierLabels);
    const best = matches[0];

    if (best.score >= 3) {
      const alternatives = matches.slice(1, 4).filter(m => m.score > 0).map(m => ({
        label: m.label,
        confidence: Math.min(0.9, m.score / (best.score + m.score)),
      }));

      return {
        processor: 'classify',
        provider: 'keywords',
        result: { label: best.label, alternatives, ocrText: text.substring(0, 200) },
        confidence: Math.min(0.95, 0.7 + best.score * 0.05),
        processingMs: Date.now() - start,
      };
    }

    // Low confidence — return for fallback
    return {
      processor: 'classify',
      provider: 'keywords',
      result: { label: best.label, ocrText: text.substring(0, 200), reason: 'Low keyword score' },
      confidence: Math.min(0.5, best.score * 0.15),
      processingMs: Date.now() - start,
    };
  },
};
