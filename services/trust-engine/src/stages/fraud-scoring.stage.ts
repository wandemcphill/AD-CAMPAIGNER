/**
 * Fraud Scoring Stage â€” combines signals from all previous stages.
 * Phase 5: Fraud score calculation (0â€“100, higher = more suspicious).
 */

import type { SubmissionContext, StageOutcome } from '../types.js';
import type { ValidationStage } from '../types.js';

/**
 * Fraud Scoring Stage: evaluates risk based on accumulated signals.
 * Reads signals from prior stages, emits fraud score 0â€“100.
 */
export class FraudScoringStage implements ValidationStage {
  readonly key = 'fraud_scoring';
  readonly costTier = 'CHEAP';

  supports(): boolean {
    // Fraud scoring runs for all submissions after prior stages.
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: SubmissionContext): Promise<StageOutcome> {
    const startTime = performance.now();

    try {
      if (!ctx.mediaAssetId) {
        return {
          status: 'PASS', // Fraud stage doesn't fail, just scores
          signals: [
            {
              key: 'fraud_score',
              value: 50, // Neutral if no image
              confidence: 30,
              weight: 100,
            },
          ],
          reasons: [],
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Fraud score combines:
      // - Quality metrics (blur, glare, darkness)
      // - Classification confidence
      // - OCR confidence + code detection
      // - Brand/denomination validity
      let fraudScore = 50; // Base: neutral (0=safe, 100=fraudulent)

      // Adjust based on quality issues
      // Low quality images are suspicious
      fraudScore = this.adjustForQuality(fraudScore, ctx);

      // Adjust based on classification confidence
      // Misclassified images are suspicious
      fraudScore = this.adjustForClassification(fraudScore, ctx);

      // Adjust based on OCR results
      // Missing codes are suspicious
      fraudScore = this.adjustForOcr(fraudScore);

      // Adjust based on brand/region mismatches
      // Out-of-pattern submissions are suspicious
      fraudScore = this.adjustForBrand(fraudScore, ctx);

      // Clamp to 0â€“100
      fraudScore = Math.max(0, Math.min(100, Math.round(fraudScore)));

      return {
        status: 'PASS', // Fraud stage always passes; verdicts are made by arbiter
        signals: [
          {
            key: 'fraud_score',
            value: fraudScore,
            confidence: 75,
            weight: 100,
          },
        ],
        reasons: [],
        evidenceRef: ctx.mediaAssetId,
        durationMs: performance.now() - startTime,
        retryCount: 0,
      };
    } catch (err) {
      return {
        status: 'PASS',
        signals: [
          {
            key: 'fraud_score',
            value: 50, // Default to neutral on error
            confidence: 0,
            weight: 100,
          },
        ],
        reasons: [],
        durationMs: performance.now() - startTime,
        retryCount: 0,
        failureMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Adjust fraud score based on quality metrics.
   * Low quality â†’ higher fraud risk.
   */
  private adjustForQuality(baseScore: number, ctx: SubmissionContext): number {
    let score = baseScore;

    // Heuristic: Low quality images suggest user negligence or deliberate obscuring
    // If resolution is suspiciously low for a gift card, flag it
    const megapixels = ((ctx.mediaAssetWidth ?? 0) * (ctx.mediaAssetHeight ?? 0)) / 1_000_000;
    if (megapixels < 0.5) {
      score += 15; // Very suspicious
    } else if (megapixels < 1.0) {
      score += 8;
    }

    // Aspect ratio extremes (cropped images) suggest fraud
    const aspectRatio = (ctx.mediaAssetWidth ?? 1) / (ctx.mediaAssetHeight ?? 1);
    if (aspectRatio < 0.6 || aspectRatio > 1.7) {
      score += 10;
    }

    return score;
  }

  /**
   * Adjust fraud score based on classification confidence.
   * Misclassified assets are suspicious.
   */
  private adjustForClassification(baseScore: number, ctx: SubmissionContext): number {
    // Heuristic: If claimed asset type doesn't match image properties,
    // this is a red flag (user trying to pass off wrong asset type)
    let score = baseScore;

    // Portrait images claimed as gift cards are suspicious
    const aspectRatio = (ctx.mediaAssetWidth ?? 1) / (ctx.mediaAssetHeight ?? 1);
    if (ctx.assetClass === 'GIFT_CARD' && aspectRatio < 0.7) {
      score += 12; // Likely an airtime pin, not a gift card
    }

    return score;
  }

  /**
   * Adjust fraud score based on OCR results.
   * Missing codes are highly suspicious.
   */
  private adjustForOcr(baseScore: number): number {
    // Heuristic: OCR failures suggest the card is fake, damaged, or obscured
    const score = baseScore;

    // If OCR text confidence is too low, that's very suspicious
    // (This would come from actual OCR stage in full pipeline)
    // For now, base score is neutral since we don't have OCR results in context

    return score;
  }

  /**
   * Adjust fraud score based on brand/denomination mismatch.
   * Out-of-pattern submissions are suspicious.
   */
  private adjustForBrand(baseScore: number, ctx: SubmissionContext): number {
    let score = baseScore;

    // Heuristic: Common fraud patterns
    // - Very high denominations (user trying to cash out massive amounts)
    const denomination = (ctx.submissionProfile?.denomination as number) || 0;
    if (denomination > 200000) {
      // > $2000
      score += 5;
    }

    // - Currencies/regions that don't match brand (e.g., Apple card claiming Nigerian Naira)
    const region = (ctx.submissionProfile?.region as string) || '';
    const brand = (ctx.submissionProfile?.brand as string) || '';
    if (brand === 'APPLE' && region && region !== 'US') {
      score += 8; // Apple primarily US
    }

    return score;
  }
}



