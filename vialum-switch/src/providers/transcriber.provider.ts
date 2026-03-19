// ════════════════════════════════════════════════════════════
// Transcriber Provider — Uses existing transcriber-api
// ════════════════════════════════════════════════════════════

import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

export const transcriberProvider: ProviderExecutor = {
  name: 'vialum_transcriber',

  async execute(input: ProcessInput, settings: Record<string, unknown>): Promise<ProcessResult> {
    const start = Date.now();
    const url = (settings.url as string) ?? 'http://transcriber-api:8000/transcribe';

    if (!input.fileUrl) {
      return {
        processor: 'transcribe',
        provider: 'vialum_transcriber',
        result: { text: '', error: 'fileUrl required for transcription' },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: input.fileUrl }),
      });

      if (!res.ok) throw new Error(`Transcriber error: ${res.status}`);
      const data = await res.json() as { text?: string; transcription?: string; duration?: number };
      const text = data.text ?? data.transcription ?? '';

      return {
        processor: 'transcribe',
        provider: 'vialum_transcriber',
        result: { text, duration: data.duration },
        confidence: text.length > 0 ? 0.85 : 0,
        processingMs: Date.now() - start,
      };
    } catch (err) {
      return {
        processor: 'transcribe',
        provider: 'vialum_transcriber',
        result: { text: '', error: String(err) },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }
  },
};
