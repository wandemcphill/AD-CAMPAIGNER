/**
 * OCR Stage â€” extracts text, codes, and metadata from images.
 * Phase 4: Simulated OCR (pattern matching on image properties).
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

interface OcrExtraction {
  visibleCodes: string[]; // E-codes, denomination codes, etc.
  detectedBrand?: string; // Apple, Google Play, Amazon, etc.
  detectedRegion?: string; // US, UK, etc.
  detectedDenomination?: string; // $25, $50, etc.
  textConfidence: number; // 0â€“100: how legible is the text?
  codeDetectionCount: number; // How many codes found?
}

/**
 * OCR stage: extract text, codes, and metadata from card images.
 * Uses heuristics + pattern matching (Phase 5+: real ML model).
 */
export class OcrStage implements ValidationStage {
  readonly key = 'ocr';
  readonly costTier = 'EXPENSIVE'; // Real OCR APIs are costly

  private readonly minOcrConfidence = 60; // Text must be â‰¥60% legible
  private readonly minCodeDetection = 1; // At least one code must be found

  // Common gift card brand patterns
  private readonly brandPatterns: Record<string, RegExp> = {
    APPLE: /apple|itunes|app.*store/i,
    GOOGLE_PLAY: /google.*play|playstore/i,
    AMAZON: /amazon|amz/i,
    XBOX: /xbox|microsoft.*store/i,
    STEAM: /steam/i,
    VISA: /visa|prepaid/i,
    MASTERCARD: /mastercard|mc/i,
  };

  // Common denomination patterns (e.g., $25, Â£20, â‚¬50)
  private readonly denominationPatterns = [
    /\$\d+/i, // $25, $100
    /Â£\d+/i, // Â£20
    /â‚¬\d+/i, // â‚¬50
    /â‚¦\d+/i, // â‚¦5000 (Nigerian Naira)
  ];

  supports(): boolean {
    // OCR runs for all asset classes with mediaAsset.
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: SubmissionContext): Promise<StageOutcome> {
    const startTime = performance.now();

    try {
      if (!ctx.mediaAssetId) {
        return {
          status: 'INCONCLUSIVE',
          signals: [],
          reasons: ['UPLOAD_MISSING'],
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Simulate OCR extraction
      const extraction = this.extractText(ctx);

      const reasons: ReasonCode[] = [];

      // Check OCR confidence
      if (extraction.textConfidence < this.minOcrConfidence) {
        reasons.push('OCR_LOW_CONFIDENCE');
      }

      // Check code detection
      if (extraction.codeDetectionCount < this.minCodeDetection) {
        reasons.push('OCR_CODE_NOT_DETECTED');
      }

      // If no codes found and low confidence, this is a failing condition
      if (reasons.length > 0) {
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'ocr_text_confidence',
              value: extraction.textConfidence,
              confidence: 70,
              weight: 25,
            },
            {
              key: 'code_detection_count',
              value: extraction.codeDetectionCount,
              confidence: 75,
              weight: 20,
            },
            {
              key: 'brand_detected',
              value: extraction.detectedBrand ? 1 : 0,
              confidence: 65,
              weight: 15,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // OCR passed â€” codes found and text legible
      return {
        status: 'PASS',
        signals: [
          {
            key: 'ocr_text_confidence',
            value: extraction.textConfidence,
            confidence: 70,
            weight: 25,
          },
          {
            key: 'code_detection_count',
            value: extraction.codeDetectionCount,
            confidence: 75,
            weight: 20,
          },
          {
            key: 'brand_detected',
            value: extraction.detectedBrand ? 1 : 0,
            confidence: 65,
            weight: 15,
          },
          {
            key: 'denomination_detected',
            value: extraction.detectedDenomination ? 1 : 0,
            confidence: 60,
            weight: 10,
          },
        ],
        reasons: [],
        evidenceRef: ctx.mediaAssetId,
        durationMs: performance.now() - startTime,
        retryCount: 0,
      };
    } catch (err) {
      return {
        status: 'INCONCLUSIVE',
        signals: [],
        reasons: ['SYSTEM_FAILURE'],
        durationMs: performance.now() - startTime,
        retryCount: 0,
        failureMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate OCR extraction from image properties.
   * Phase 5+: call real OCR API (Google Vision, Anthropic, Tesseract).
   */
  private extractText(ctx: SubmissionContext): OcrExtraction {
    const width = ctx.mediaAssetWidth ?? 0;
    const height = ctx.mediaAssetHeight ?? 0;
    const byteSize = ctx.mediaAssetByteSize ?? 0;

    // Heuristic 1: Text legibility from resolution + compression
    // High-res, well-compressed images have legible text
    const megapixels = (width * height) / 1_000_000;
    const kilobytes = byteSize / 1024;
    const compressionRatio = megapixels > 0 ? kilobytes / megapixels : 0;

    let textConfidence = 50; // Base confidence
    if (megapixels > 5 && compressionRatio > 150) {
      textConfidence = 90; // High-res, good compression = sharp text
    } else if (megapixels > 3 && compressionRatio > 120) {
      textConfidence = 80; // Mid-res, decent compression
    } else if (megapixels > 2 && compressionRatio > 100) {
      textConfidence = 70;
    } else if (megapixels > 1 && compressionRatio > 80) {
      textConfidence = 65;
    } else if (megapixels > 0.5 && compressionRatio > 50) {
      textConfidence = 55;
    } else {
      textConfidence = 40; // Low resolution = illegible text
    }

    // Heuristic 2: Code detection based on aspect ratio
    // Wider images (landscape) often have codes visible
    // Taller images (portrait) often have codes at specific positions
    const aspectRatio = width / height;
    let codeDetectionCount = 0;

    // Gift cards (landscape) often show full code
    if (aspectRatio > 1.0 && megapixels > 1.5) {
      codeDetectionCount = 2; // Multiple code representations
    } else if (aspectRatio > 0.9 && megapixels > 1.0) {
      codeDetectionCount = 1; // At least one code visible
    } else if (megapixels > 3) {
      codeDetectionCount = 1; // High-res might catch partial codes
    }

    // If text confidence is low, reduce code detection confidence
    if (textConfidence < 50) {
      codeDetectionCount = Math.max(0, codeDetectionCount - 1);
    }

    // Heuristic 3: Brand detection from submission profile
    const brand = (ctx.submissionProfile?.brand as string) || '';
    const region = (ctx.submissionProfile?.region as string) || '';
    const denomination = (ctx.submissionProfile?.denomination as string) || '';

    return {
      visibleCodes: this.generatePlaceholderCodes(codeDetectionCount),
      ...(brand && { detectedBrand: brand }),
      ...(region && { detectedRegion: region }),
      ...(denomination && { detectedDenomination: denomination }),
      textConfidence: Math.round(textConfidence),
      codeDetectionCount,
    };
  }

  /**
   * Generate placeholder codes for simulation.
   * Phase 5+: real codes from OCR results.
   */
  private generatePlaceholderCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate fake but realistic-looking codes
      const code = `${Math.random().toString(36).substring(2, 10).toUpperCase()}${i}`;
      codes.push(code);
    }
    return codes;
  }
}



