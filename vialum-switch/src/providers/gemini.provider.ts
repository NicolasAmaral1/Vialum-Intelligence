// ════════════════════════════════════════════════════════════
// Gemini Provider — Google AI for OCR and classification
// ════════════════════════════════════════════════════════════

import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

async function callGemini(apiKey: string, model: string, prompt: string, buffer: Buffer, mimeType: string) {
  const base64 = buffer.toString('base64');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ]}],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export const geminiOcrProvider: ProviderExecutor = {
  name: 'gemini_flash',

  async execute(
    input: ProcessInput,
    settings: Record<string, unknown>,
    credentials: Record<string, unknown>,
    classifierLabels?: Record<string, { strong: string[]; weak: string[] }>,
  ): Promise<ProcessResult> {
    const start = Date.now();
    const apiKey = credentials.apiKey as string;
    if (!apiKey) throw new Error('Gemini API key not configured');
    const model = (settings.model as string) ?? 'gemini-2.0-flash-lite';

    // If classifier labels present, this is a classify call
    if (classifierLabels) {
      const labels = Object.keys(classifierLabels);
      const prompt = `Classifique esta imagem em UMA das categorias: ${labels.join(', ')}. Responda SOMENTE em JSON: {"label": "CATEGORIA", "confidence": 0.0-1.0}`;
      const text = await callGemini(apiKey, model, prompt, input.buffer, input.mimeType);

      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned) as { label: string; confidence: number };
        return {
          processor: 'classify',
          provider: 'gemini_flash',
          result: { label: parsed.label, alternatives: [] },
          confidence: parsed.confidence,
          processingMs: Date.now() - start,
        };
      } catch {
        return {
          processor: 'classify',
          provider: 'gemini_flash',
          result: { label: 'OUTRO', raw: text },
          confidence: 0.5,
          processingMs: Date.now() - start,
        };
      }
    }

    // OCR mode
    const prompt = 'Extraia todo o texto visível desta imagem. Retorne apenas o texto extraído, sem formatação adicional.';
    const text = await callGemini(apiKey, model, prompt, input.buffer, input.mimeType);

    return {
      processor: 'ocr',
      provider: 'gemini_flash',
      result: { text, wordCount: text.split(/\s+/).filter(Boolean).length },
      confidence: 0.95,
      processingMs: Date.now() - start,
    };
  },
};
