/**
 * Duplicate Detection Stage â€” checks for duplicate submissions.
 * Phase 6: Perceptual hashing + history lookup (simulated).
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

/**
 * Duplicate Detection Stage: identifies repeated submissions.
 * Uses heuristics to detect exact + near-duplicate cards.
 */
export class DuplicateStage implements ValidationStage {
  readonly key = 'duplicate';
  readonly costTier = 'CHEAP';

  supports(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: SubmissionContext): Promise<StageOutcome> {
    const startTime = performance.now();

    try {
      if (!ctx.mediaAssetId) {
        return {
          status: 'PASS',
          signals: [
            {
              key: 'duplicate_risk',
              value: 0,
              confidence: 50,
              weight: 30,
            },
          ],
          reasons: [],
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      const reasons: ReasonCode[] = [];
      let duplicateRisk = 0; // 0â€“100: higher = more likely duplicate

      // Heuristic 1: Checksum matching (exact duplicate)
      // In production, hash mediaAsset and check against submission history
      if (ctx.checksumSha256) {
        // Simulated: check if this exact hash exists in submission history
        // For now, assume no duplicates (production: query ValidationRun table)
        duplicateRisk += 0;
      }

      // Heuristic 2: Same user + same denomination + similar images = likely duplicate
      // (User resubmitting the same card because first submission failed)
      const denomination = (ctx.submissionProfile?.denomination as number) || 0;
      if (denomination > 50000) {
        // High-value cards are more likely to be resubmitted
        duplicateRisk += 5;
      }

      // Heuristic 3: Rapid resubmission (same user within 5 minutes)
      // (Would require timestamp tracking in full implementation)
      duplicateRisk += 0; // Placeholder

      // Clamp to 0â€“100
      duplicateRisk = Math.max(0, Math.min(100, duplicateRisk));

      // Only fail if exact duplicate detected
      if (duplicateRisk > 80) {
        reasons.push('DUPLICATE_EXACT');
      } else if (duplicateRisk > 60) {
        reasons.push('DUPLICATE_NEAR');
      }

      return {
        status: reasons.length > 0 ? 'FAIL' : 'PASS',
        signals: [
          {
            key: 'duplicate_risk',
            value: duplicateRisk,
            confidence: 70,
            weight: 30,
          },
        ],
        reasons,
        evidenceRef: ctx.mediaAssetId,
        durationMs: performance.now() - startTime,
        retryCount: 0,
      };
    } catch {
      return {
        status: 'PASS',
        signals: [
          {
            key: 'duplicate_risk',
            value: 0,
            confidence: 0,
            weight: 30,
          },
        ],
        reasons: [],
        durationMs: performance.now() - startTime,
        retryCount: 0,
      };
    }
  }
}



