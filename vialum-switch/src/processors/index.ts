import { registerProcessor } from './processor.interface.js';
import { ocrProcessor } from './ocr.js';
import { classifyProcessor } from './classify.js';
import { transcribeProcessor } from './transcribe.js';

export function initProcessors(): void {
  registerProcessor(ocrProcessor);
  registerProcessor(classifyProcessor);
  registerProcessor(transcribeProcessor);
}
