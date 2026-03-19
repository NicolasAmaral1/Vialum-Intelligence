// ════════════════════════════════════════════════════════════
// Tesseract Provider — Local OCR for images and PDFs (free)
//
// Images: sharp preprocessing → tesseract
// PDFs:   pdftotext (digital) → pdftoppm + tesseract (scanned)
//
// All behavior configurable via provider settings in DB:
//   language, psm, pdfDpi, pdfMaxPages, pdfStrategy
// ════════════════════════════════════════════════════════════

import { writeFileSync, unlinkSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { ProviderExecutor } from '../lib/strategy-engine.js';
import type { ProcessInput, ProcessResult } from '../processors/processor.interface.js';

function buildResult(text: string, start: number, meta?: Record<string, unknown>): ProcessResult {
  return {
    processor: 'ocr',
    provider: 'tesseract',
    result: { text, wordCount: text.split(/\s+/).filter(Boolean).length, ...meta },
    confidence: text.length > 20 ? 0.85 : 0.4,
    processingMs: Date.now() - start,
  };
}

function cleanup(...paths: string[]) {
  for (const p of paths) {
    try {
      if (existsSync(p)) {
        const stat = require('fs').statSync(p);
        if (stat.isDirectory()) {
          for (const f of readdirSync(p)) unlinkSync(`${p}/${f}`);
          require('fs').rmdirSync(p);
        } else {
          unlinkSync(p);
        }
      }
    } catch {}
  }
}

// ── Image OCR ─────────────────────────────────────────────

async function ocrImage(buffer: Buffer, mimeType: string, language: string, psm: number): Promise<string> {
  const id = randomUUID();
  const inputPath = `/tmp/switch_img_${id}`;
  const outputPath = `/tmp/switch_img_${id}_out`;

  try {
    const processedBuffer = await sharp(buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .sharpen()
      .toBuffer();

    writeFileSync(inputPath, processedBuffer);
    execSync(`tesseract ${inputPath} ${outputPath} -l ${language} --psm ${psm} 2>/dev/null`, { timeout: 30000 });
    return readFileSync(`${outputPath}.txt`, 'utf-8').trim();
  } finally {
    cleanup(inputPath, `${outputPath}.txt`);
  }
}

// ── PDF: extract text (digital PDF) ──────────────────────

function pdfExtractText(buffer: Buffer): string {
  const id = randomUUID();
  const pdfPath = `/tmp/switch_pdf_${id}.pdf`;

  try {
    writeFileSync(pdfPath, buffer);
    const text = execSync(`pdftotext -layout "${pdfPath}" - 2>/dev/null`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString().trim();
    return text;
  } catch {
    return '';
  } finally {
    cleanup(pdfPath);
  }
}

// ── PDF: OCR scanned pages ───────────────────────────────

async function pdfOcrPages(buffer: Buffer, language: string, psm: number, dpi: number, maxPages: number): Promise<string> {
  const id = randomUUID();
  const pdfPath = `/tmp/switch_pdf_${id}.pdf`;
  const imgDir = `/tmp/switch_pdf_${id}_pages`;

  try {
    mkdirSync(imgDir, { recursive: true });
    writeFileSync(pdfPath, buffer);

    // Convert PDF pages to images at specified DPI
    execSync(
      `pdftoppm -r ${dpi} -png -l ${maxPages} "${pdfPath}" "${imgDir}/page"`,
      { timeout: 60000 },
    );

    // OCR each page image
    const pageFiles = readdirSync(imgDir).filter(f => f.endsWith('.png')).sort();
    const pageTexts: string[] = [];

    for (const pageFile of pageFiles.slice(0, maxPages)) {
      const pagePath = `${imgDir}/${pageFile}`;
      const outPath = `/tmp/switch_pdf_${id}_${pageFile}`;

      try {
        // Preprocess with sharp for better OCR quality
        const enhanced = sharp(readFileSync(pagePath))
          .grayscale()
          .sharpen()
          .toBuffer();

        const enhancedPath = `${outPath}_enhanced`;
        writeFileSync(enhancedPath, await enhanced);

        execSync(`tesseract "${enhancedPath}" "${outPath}" -l ${language} --psm ${psm} 2>/dev/null`, {
          timeout: 30000,
        });

        const text = readFileSync(`${outPath}.txt`, 'utf-8').trim();
        if (text) pageTexts.push(text);

        cleanup(enhancedPath, `${outPath}.txt`);
      } catch {
        // Skip failed pages
      }
    }

    return pageTexts.join('\n\n--- página ---\n\n');
  } catch {
    return '';
  } finally {
    cleanup(pdfPath);
    // Clean up image directory
    try {
      if (existsSync(imgDir)) {
        for (const f of readdirSync(imgDir)) unlinkSync(`${imgDir}/${f}`);
        require('fs').rmdirSync(imgDir);
      }
    } catch {}
  }
}

// ── Main provider ────────────────────────────────────────

export const tesseractProvider: ProviderExecutor = {
  name: 'tesseract',

  async execute(input: ProcessInput, settings: Record<string, unknown>): Promise<ProcessResult> {
    const start = Date.now();
    const language = (settings.language as string) ?? 'por';
    const psm = (settings.psm as number) ?? 3;
    const pdfDpi = (settings.pdfDpi as number) ?? 300;
    const pdfMaxPages = (settings.pdfMaxPages as number) ?? 20;
    const pdfStrategy = (settings.pdfStrategy as string) ?? 'auto';

    try {
      // ── Image input ──
      if (input.mimeType.startsWith('image/')) {
        const text = await ocrImage(input.buffer, input.mimeType, language, psm);
        return buildResult(text, start);
      }

      // ── PDF input ──
      if (input.mimeType === 'application/pdf') {
        // Strategy: text_first — only extract digital text
        if (pdfStrategy === 'text_first') {
          const text = pdfExtractText(input.buffer);
          return buildResult(text, start, { method: 'pdftotext' });
        }

        // Strategy: ocr_only — always OCR (for scanned PDFs)
        if (pdfStrategy === 'ocr_only') {
          const text = await pdfOcrPages(input.buffer, language, psm, pdfDpi, pdfMaxPages);
          return buildResult(text, start, { method: 'pdftoppm+tesseract', dpi: pdfDpi });
        }

        // Strategy: auto — try digital first, fallback to OCR
        const digitalText = pdfExtractText(input.buffer);
        const wordCount = digitalText.split(/\s+/).filter(Boolean).length;

        // If pdftotext got substantial text, use it
        if (wordCount > 30) {
          return buildResult(digitalText, start, { method: 'pdftotext', pagesDetected: 'digital' });
        }

        // Otherwise, it's likely a scanned PDF — OCR the pages
        const ocrText = await pdfOcrPages(input.buffer, language, psm, pdfDpi, pdfMaxPages);
        if (ocrText.length > digitalText.length) {
          return buildResult(ocrText, start, { method: 'pdftoppm+tesseract', dpi: pdfDpi, pagesDetected: 'scanned' });
        }

        // Return whichever got more text
        return buildResult(digitalText || ocrText, start, { method: 'auto_fallback' });
      }

      // ── Unsupported ──
      return {
        processor: 'ocr', provider: 'tesseract',
        result: { text: '', error: `Unsupported mime type: ${input.mimeType}` },
        confidence: 0, processingMs: Date.now() - start,
      };
    } catch (err) {
      return {
        processor: 'ocr', provider: 'tesseract',
        result: { text: '', error: String(err) },
        confidence: 0, processingMs: Date.now() - start,
      };
    }
  },
};
