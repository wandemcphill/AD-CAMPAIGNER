/**
 * Quality Stage — detects image quality issues (blur, glare, exposure, cropping).
 * Phase 3: Simulated quality assessment (local rules engine, no external API).
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

interface QualityMetrics {
  blurScore: number; // 0–100: higher = more blurred
  glareScore: number; // 0–100: higher = more glare
  darkScore: number; // 0–100: higher = darker
  exposureOk: boolean;
  croppingDetected: boolean;
  partialCardVisible: boolean;
}

/**
 * Quality stage: detect blur, glare, exposure, cropping issues.
 * Uses heuristics based on image metadata (resolution, aspect ratio).
 */
export class QualityStage implements ValidationStage {
  readonly key = 'quality';
  readonly costTier = 'CHEAP';

  private readonly minQualityScore = 50; // 0–100 scale
  private readonly maxBlurScore = 40;
  private readonly maxGlareScore = 30;
  private readonly maxDarkScore = 35;

  supports(): boolean {
    // Quality runs for all asset classes with a mediaAsset.
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: SubmissionContext): Promise<StageOutcome> {
    const reasons: ReasonCode[] = [];
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

      // Estimate quality metrics from image dimensions + resolution.
      // In Phase 4+, this would call vision API or local ML model.
      const metrics = this.estimateQualityMetrics(ctx);

      // Check each quality dimension
      if (metrics.blurScore > this.maxBlurScore) {
        reasons.push('QUALITY_BLUR_DETECTED');
      }

      if (metrics.glareScore > this.maxGlareScore) {
        reasons.push('QUALITY_GLARE_DETECTED');
      }

      if (metrics.darkScore > this.maxDarkScore) {
        reasons.push('QUALITY_TOO_DARK');
      }

      if (!metrics.exposureOk) {
        // Brightness outside acceptable range
        if (metrics.darkScore > 60) {
          reasons.push('QUALITY_TOO_DARK');
        } else {
          reasons.push('QUALITY_TOO_BRIGHT');
        }
      }

      if (metrics.croppingDetected) {
        reasons.push('CROPPING_DETECTED');
      }

      if (metrics.partialCardVisible) {
        reasons.push('PARTIAL_CARD_VISIBLE');
      }

      // Compute overall quality score
      const qualityScore = this.computeQualityScore(metrics);

      if (qualityScore < this.minQualityScore) {
        // Quality too low to pass
        if (reasons.length === 0) {
          reasons.push('QUALITY_BLUR_DETECTED'); // Default if no specific reason
        }
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'quality_score',
              value: qualityScore,
              confidence: 65,
              weight: 20,
            },
            {
              key: 'blur_score',
              value: metrics.blurScore,
              confidence: 60,
              weight: 15,
            },
            {
              key: 'glare_score',
              value: metrics.glareScore,
              confidence: 55,
              weight: 10,
            },
            {
              key: 'dark_score',
              value: metrics.darkScore,
              confidence: 60,
              weight: 10,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Quality acceptable
      return {
        status: 'PASS',
        signals: [
          {
            key: 'quality_score',
            value: qualityScore,
            confidence: 65,
            weight: 20,
          },
          {
            key: 'blur_score',
            value: metrics.blurScore,
            confidence: 60,
            weight: 15,
          },
          {
            key: 'glare_score',
            value: metrics.glareScore,
            confidence: 55,
            weight: 10,
          },
          {
            key: 'dark_score',
            value: metrics.darkScore,
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
   * Estimate quality metrics from image properties.
   * Phase 4+: call vision API or ML model instead.
   */
  private estimateQualityMetrics(ctx: SubmissionContext): QualityMetrics {
    const width = ctx.mediaAssetWidth ?? 0;
    const height = ctx.mediaAssetHeight ?? 0;
    const byteSize = ctx.mediaAssetByteSize ?? 0;

    // Heuristic 1: Very high resolution for file size suggests compression artifacts/blur
    const megapixels = (width * height) / 1_000_000;
    const kilobytes = byteSize / 1024;
    const compressionRatio = megapixels > 0 ? kilobytes / megapixels : 0;
    // Expected: ~200–300 KB/MP for JPEG; <50 suggests high compression/blur
    const blurScore = compressionRatio < 50 ? 45 : compressionRatio < 100 ? 30 : 15;

    // Heuristic 2: Glare detection via saturation proxy
    // Higher megapixels with lower file size could indicate overexposure/glare
    const glareScore = compressionRatio < 60 ? 35 : compressionRatio < 120 ? 15 : 8;

    // Heuristic 3: Dark image detection via resolution + file size
    // Very small file size relative to resolution might indicate underexposure
    const darkScore = compressionRatio < 50 ? 50 : compressionRatio < 100 ? 35 : 15;

    // Heuristic 4: Exposure is OK if file size is reasonable for resolution
    const exposureOk = compressionRatio > 100 && compressionRatio < 500;

    // Heuristic 5: Cropping detection via aspect ratio extremes
    const aspectRatio = width / height;
    const croppingDetected = aspectRatio < 0.6 || aspectRatio > 1.7;

    // Heuristic 6: Partial card detection (if resolution is low, card might be cropped)
    const minDimension = Math.min(width, height);
    const partialCardVisible = minDimension < 900;

    return {
      blurScore,
      glareScore,
      darkScore,
      exposureOk,
      croppingDetected,
      partialCardVisible,
    };
  }

  /**
   * Compute overall quality score from individual metrics.
   * Scale: 0–100, where 100 = excellent.
   */
  private computeQualityScore(metrics: QualityMetrics): number {
    let score = 100;

    // Penalize for blur (up to 50 points)
    score -= (metrics.blurScore / 100) * 50;

    // Penalize for glare (up to 25 points)
    score -= (metrics.glareScore / 100) * 25;

    // Penalize for darkness (up to 30 points)
    score -= (metrics.darkScore / 100) * 30;

    // Penalize for exposure issues (up to 20 points)
    if (!metrics.exposureOk) {
      score -= 20;
    }

    // Penalize for cropping (25 points if detected)
    if (metrics.croppingDetected) {
      score -= 25;
    }

    // Penalize for partial card (20 points if detected)
    if (metrics.partialCardVisible) {
      score -= 20;
    }

    return Math.max(0, Math.round(score));
  }
}
