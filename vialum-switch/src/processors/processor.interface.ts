// ════════════════════════════════════════════════════════════
// Processor Interface — Every processor implements this
// ════════════════════════════════════════════════════════════

export interface ProcessInput {
  buffer: Buffer;
  mimeType: string;
  fileUrl?: string;       // pre-signed URL (for providers that need URL)
  params?: Record<string, unknown>;
  accountId?: string;     // tenant ID (for loading config from DB)
}

export interface ProcessResult {
  processor: string;
  provider: string;
  result: Record<string, unknown>;
  confidence?: number;
  processingMs: number;
}

export interface Processor {
  readonly name: string;
  readonly supportedMimeTypes: string[];
  process(input: ProcessInput): Promise<ProcessResult>;
}

// Registry
const registry = new Map<string, Processor>();

export function registerProcessor(p: Processor): void { registry.set(p.name, p); }
export function getProcessor(name: string): Processor | undefined { return registry.get(name); }
export function getAllProcessors(): Processor[] { return Array.from(registry.values()); }
