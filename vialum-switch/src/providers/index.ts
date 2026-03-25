import { registerProviderExecutor } from '../lib/strategy-engine.js';
import { tesseractProvider } from './tesseract.provider.js';
import { geminiOcrProvider } from './gemini.provider.js';
import { keywordsProvider } from './keywords.provider.js';
import { transcriberProvider } from './transcriber.provider.js';
import { openaiVisionProvider } from './openai-vision.provider.js';

export function initProviderExecutors(): void {
  registerProviderExecutor(tesseractProvider);
  registerProviderExecutor(geminiOcrProvider);
  registerProviderExecutor(keywordsProvider);
  registerProviderExecutor(transcriberProvider);
  registerProviderExecutor(openaiVisionProvider);
}
