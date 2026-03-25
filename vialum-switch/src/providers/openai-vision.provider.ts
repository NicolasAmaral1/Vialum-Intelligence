// ════════════════════════════════════════════════════════════
// OpenAI Vision Provider — GPT-4o mini for OCR + Classification
// Used as fallback when Tesseract returns low confidence
// ════════════════════════════════════════════════════════════

import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

export const openaiVisionProvider: ProviderExecutor = {
  name: 'openai_vision',

  async execute(
    input: ProcessInput,
    settings: Record<string, unknown>,
    credentials: Record<string, unknown>,
    classifierLabels?: Record<string, { strong: string[]; weak: string[] }>,
  ): Promise<ProcessResult> {
    const start = Date.now();
    const apiKey = (credentials.apiKey as string) ?? '';
    const model = (settings.model as string) ?? 'gpt-4o-mini';

    if (!apiKey) {
      return {
        processor: 'ocr',
        provider: 'openai_vision',
        result: { error: 'OpenAI API key not configured' },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }

    if (!input.buffer || input.buffer.length === 0) {
      return {
        processor: 'ocr',
        provider: 'openai_vision',
        result: { error: 'buffer required' },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }

    try {
      // Convert buffer to base64
      const base64 = Buffer.from(input.buffer).toString('base64');
      const mimeType = input.mimeType ?? 'image/jpeg';

      // Build prompt based on whether we're doing OCR or classification
      let prompt: string;
      let processor: string;

      if (classifierLabels && Object.keys(classifierLabels).length > 0) {
        // Classification mode
        processor = 'classify';
        const labels = Object.keys(classifierLabels);
        prompt = `Classifique esta imagem em UMA das seguintes categorias: ${labels.join(', ')}.
Responda APENAS com o nome da categoria, sem explicação.
Se a imagem não se encaixar em nenhuma categoria, responda "outro".`;
      } else {
        // OCR mode
        processor = 'ocr';
        prompt = `Extraia TODO o texto visível desta imagem.
Se não houver texto, descreva brevemente o que aparece na imagem em português.
Retorne apenas o texto extraído ou a descrição, sem explicações adicionais.`;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${errBody.substring(0, 200)}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const text = data.choices?.[0]?.message?.content?.trim() ?? '';

      if (processor === 'classify' && classifierLabels) {
        const label = text.toLowerCase();
        const matchedLabel = Object.keys(classifierLabels).find(
          (l) => label.includes(l.toLowerCase()),
        );
        return {
          processor: 'classify',
          provider: 'openai_vision',
          result: { label: matchedLabel ?? text, ocrText: '' },
          confidence: matchedLabel ? 0.90 : 0.5,
          processingMs: Date.now() - start,
        };
      }

      return {
        processor: 'ocr',
        provider: 'openai_vision',
        result: { text },
        confidence: text.length > 10 ? 0.92 : (text.length > 0 ? 0.6 : 0),
        processingMs: Date.now() - start,
      };
    } catch (err) {
      console.error('[openai-vision] Error:', (err as Error).message);
      return {
        processor: 'ocr',
        provider: 'openai_vision',
        result: { text: '', error: String(err) },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }
  },
};
