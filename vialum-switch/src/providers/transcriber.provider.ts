// ════════════════════════════════════════════════════════════
// Transcriber Provider — Uses existing transcriber-api
// Sends audio file as FormData (multipart upload)
// Polls for result (async transcription, ~60-90s for typical audio)
// ════════════════════════════════════════════════════════════

import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

export const transcriberProvider: ProviderExecutor = {
  name: 'vialum_transcriber',

  async execute(input: ProcessInput, settings: Record<string, unknown>): Promise<ProcessResult> {
    const start = Date.now();
    const baseUrl = (settings.url as string) ?? 'http://transcriber-api:8000';

    if (!input.buffer || input.buffer.length === 0) {
      return {
        processor: 'transcribe',
        provider: 'vialum_transcriber',
        result: { text: '', error: 'buffer required for transcription' },
        confidence: 0,
        processingMs: Date.now() - start,
      };
    }

    try {
      // Step 1: Submit audio file via FormData
      const uint8 = new Uint8Array(input.buffer);
      const blob = new Blob([uint8], { type: input.mimeType ?? 'audio/ogg' });
      const formData = new FormData();
      formData.append('file', blob, 'audio.ogg');

      console.log(`[transcriber] Submitting ${input.buffer.length} bytes (${input.mimeType})`);

      const submitRes = await fetch(`${baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!submitRes.ok) {
        const errBody = await submitRes.text().catch(() => '');
        throw new Error(`Transcriber submit error: ${submitRes.status} ${errBody}`);
      }

      const submitData = await submitRes.json() as Record<string, unknown>;
      console.log(`[transcriber] Submit response:`, JSON.stringify(submitData));

      // If transcriber returns text directly (synchronous mode)
      const directText = (submitData.text as string) ?? (submitData.transcription as string);
      if (directText) {
        return {
          processor: 'transcribe',
          provider: 'vialum_transcriber',
          result: { text: directText },
          confidence: directText.length > 0 ? 0.85 : 0,
          processingMs: Date.now() - start,
        };
      }

      // If transcriber returns job_id (async mode) — poll for result
      const jobId = submitData.job_id as string;
      if (!jobId) {
        return {
          processor: 'transcribe',
          provider: 'vialum_transcriber',
          result: { text: '', error: 'No job_id or text in response' },
          confidence: 0,
          processingMs: Date.now() - start,
        };
      }

      console.log(`[transcriber] Polling job ${jobId}...`);

      let text = '';
      const maxWaitMs = 120_000; // 2 minutes max
      const pollStart = Date.now();

      while (Date.now() - pollStart < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 2000)); // poll every 2s

        const pollRes = await fetch(`${baseUrl}/status/${jobId}`);
        if (!pollRes.ok) continue;

        const pollData = await pollRes.json() as Record<string, unknown>;
        const status = pollData.status as string;

        if (status === 'completed') {
          const result = pollData.result as Record<string, unknown> | undefined;
          text = (result?.full_text as string) ?? (pollData.text as string) ?? (pollData.transcription as string) ?? '';
          console.log(`[transcriber] Completed in ${Math.round((Date.now() - pollStart) / 1000)}s, ${text.length} chars`);
          break;
        }
        if (status === 'failed') {
          throw new Error('Transcription job failed');
        }
      }

      if (!text) {
        console.log(`[transcriber] Timed out after ${Math.round(maxWaitMs / 1000)}s`);
      }

      return {
        processor: 'transcribe',
        provider: 'vialum_transcriber',
        result: { text },
        confidence: text.length > 0 ? 0.85 : 0,
        processingMs: Date.now() - start,
      };
    } catch (err) {
      console.error(`[transcriber] Error:`, (err as Error).message);
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
