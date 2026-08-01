/**
 * Classification Stage — identifies asset type from visual features.
 * Phase 3: Simulated classification (pattern matching rules).
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

type AssetTypeClassification = 'GIFT_CARD' | 'AIRTIME_PIN' | 'RECHARGE_VOUCHER' | 'DIGITAL_COUPON' | 'UNKNOWN';

interface ClassificationResult {
  detectedType: AssetTypeClassification;
  confidence: number; // 0–100
  reasonCodes: ReasonCode[];
}

/**
 * Classification stage: identify what type of asset the image shows.
 * Uses heuristics based on metadata + submitted asset class.
 */
export class ClassificationStage implements ValidationStage {
  readonly key = 'classification';
  readonly costTier = 'CHEAP';

  private readonly minConfidence = 60; // Must be ≥60% to pass

  supports(): boolean {
    // Classification runs for all asset classes.
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

      // Get the claimed asset class
      const claimedType = ctx.assetClass;

      // Classify based on image properties
      const result = this.classifyAsset(ctx, claimedType);

      // Check if classification matches submission
      const reasons: ReasonCode[] = result.reasonCodes;

      if (result.confidence < this.minConfidence) {
        // Classification failed (low confidence)
        if (result.detectedType === 'UNKNOWN') {
          reasons.push('UNKNOWN_ASSET_TYPE');
        } else if (result.detectedType !== claimedType) {
          // Mismatch between detected and claimed
          switch (claimedType) {
            case 'GIFT_CARD':
              reasons.push('NOT_A_GIFT_CARD');
              break;
            case 'AIRTIME_PIN':
              reasons.push('NOT_AN_AIRTIME_PIN');
              break;
            default:
              reasons.push('UNKNOWN_ASSET_TYPE');
          }
        }

        return {
          status: 'FAIL',
          signals: [
            {
              key: 'classification_confidence',
              value: result.confidence,
              confidence: 70,
              weight: 25,
            },
            {
              key: 'detected_type_matches_claimed',
              value: result.detectedType === claimedType ? 1 : 0,
              confidence: 70,
              weight: 20,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Classification passed
      return {
        status: 'PASS',
        signals: [
          {
            key: 'classification_confidence',
            value: result.confidence,
            confidence: 70,
            weight: 25,
          },
          {
            key: 'detected_type_matches_claimed',
            value: result.detectedType === claimedType ? 1 : 0,
            confidence: 70,
            weight: 20,
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
   * Classify asset type based on image properties and submission metadata.
   * Phase 4+: call computer vision API or ML model instead.
   */
  private classifyAsset(
    ctx: SubmissionContext,
    claimedType: string
  ): ClassificationResult {
    const width = ctx.mediaAssetWidth ?? 0;
    const height = ctx.mediaAssetHeight ?? 0;
    const aspectRatio = width / height;

    // Start with claimed type and boost confidence if metadata matches
    let detectedType: AssetTypeClassification = claimedType as AssetTypeClassification;
    let confidence = 60; // Base confidence for matching claim

    // Heuristic 1: Check aspect ratio patterns
    // Gift cards: typically landscape or square (0.7–1.3)
    // Airtime pins: often portrait or tall narrow (0.4–0.65)
    // Vouchers: typically square or landscape (0.8–1.2)
    if (claimedType === 'GIFT_CARD') {
      if (aspectRatio >= 0.75 && aspectRatio <= 1.3) {
        confidence = 85; // High confidence for typical gift card proportions
      } else if (aspectRatio < 0.6) {
        // Very tall → looks like airtime pin, misclassified
        detectedType = 'AIRTIME_PIN';
        confidence = 55; // Low confidence due to mismatch
      } else {
        confidence = 50; // Unusual aspect ratio
      }
    } else if (claimedType === 'AIRTIME_PIN') {
      if (aspectRatio < 0.65) {
        confidence = 85; // High confidence for tall narrow proportions
      } else if (aspectRatio > 1.0) {
        // Wide aspect → looks like gift card
        detectedType = 'GIFT_CARD';
        confidence = 55; // Low confidence due to mismatch
      } else {
        confidence = 65;
      }
    } else if (claimedType === 'RECHARGE_VOUCHER') {
      if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
        confidence = 80;
      } else {
        confidence = 55;
      }
    } else if (claimedType === 'DIGITAL_COUPON') {
      // Coupons can have variable aspect ratios
      confidence = 65;
    } else {
      // Unknown type
      detectedType = 'UNKNOWN';
      confidence = 30;
    }

    // Heuristic 2: Adjust confidence based on resolution
    // Better resolution = higher confidence
    const megapixels = (width * height) / 1_000_000;
    let isLowResolution = false;
    if (megapixels > 5) {
      confidence = Math.min(95, confidence + 10); // Sharp image
    } else if (megapixels < 0.7) {
      confidence = Math.max(40, confidence - 30); // Very low resolution
      isLowResolution = true;
    } else if (megapixels < 1.5) {
      confidence = Math.max(45, confidence - 20); // Low resolution
      isLowResolution = true;
    }

    // Heuristic 3: Check submission profile for hints
    const brand = (ctx.submissionProfile?.brand as string) || '';
    const region = (ctx.submissionProfile?.region as string) || '';

    // If brand is known (Apple, Google Play, etc.), boost gift card confidence
    // Only if the detected type matches the claimed type and resolution is acceptable
    if (
      detectedType === claimedType &&
      claimedType === 'GIFT_CARD' &&
      brand &&
      brand.length > 0 &&
      !isLowResolution
    ) {
      confidence = Math.min(95, confidence + 15);
    }

    // If region is set, boost confidence (suggests known product)
    // Only if the detected type matches the claimed type
    if (detectedType === claimedType && region && region.length > 0 && !isLowResolution) {
      confidence = Math.min(95, confidence + 5);
    }

    const reasonCodes: ReasonCode[] = [];
    if (detectedType !== claimedType) {
      switch (claimedType) {
        case 'GIFT_CARD':
          reasonCodes.push('NOT_A_GIFT_CARD');
          break;
        case 'AIRTIME_PIN':
          reasonCodes.push('NOT_AN_AIRTIME_PIN');
          break;
        default:
          reasonCodes.push('UNKNOWN_ASSET_TYPE');
      }
    }

    return {
      detectedType,
      confidence: Math.max(0, Math.min(100, Math.round(confidence))),
      reasonCodes,
    };
  }
}
