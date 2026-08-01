/**
 * Brand Validation Stage â€” verifies brand rules and constraints.
 * Phase 4: Rule-based brand validation (checks against configured rules).
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

interface BrandRule {
  brand: string;
  enabled: boolean;
  minDenomination?: number; // In minor units (kobo/cents)
  maxDenomination?: number;
  allowedDenominations?: number[];
  region?: string;
  requiresOcr: boolean;
}

/**
 * Brand Validation Stage: check that brand + denomination match rules.
 * Uses configured brand rules + submission metadata.
 */
export class BrandValidationStage implements ValidationStage {
  readonly key = 'brand_validation';
  readonly costTier = 'CHEAP';

  // Simulated brand rules â€” in production, these come from BrandRuleSet table
  private readonly brandRules: Map<string, BrandRule> = new Map([
    [
      'APPLE',
      {
        brand: 'APPLE',
        enabled: true,
        minDenomination: 500, // $5 in cents
        maxDenomination: 200000, // $2000 in cents
        allowedDenominations: [500, 1000, 2500, 5000, 10000, 25000],
        region: 'US',
        requiresOcr: true,
      },
    ],
    [
      'GOOGLE_PLAY',
      {
        brand: 'GOOGLE_PLAY',
        enabled: true,
        minDenomination: 100, // $1 in cents
        maxDenomination: 100000, // $1000 in cents
        region: 'US',
        requiresOcr: true,
      },
    ],
    [
      'AMAZON',
      {
        brand: 'AMAZON',
        enabled: true,
        minDenomination: 100, // $1
        maxDenomination: 500000, // $5000
        region: 'US',
        requiresOcr: true,
      },
    ],
  ]);

  supports(): boolean {
    // Brand validation runs for all asset classes.
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

      const brand = (ctx.submissionProfile?.brand as string) || '';
      const denomination = (ctx.submissionProfile?.denomination as number) || 0;
      const region = (ctx.submissionProfile?.region as string) || '';

      const reasons: ReasonCode[] = [];

      // Check brand is configured
      if (!brand || brand.length === 0) {
        reasons.push('BRAND_NOT_CONFIGURED');
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'brand_known',
              value: 0,
              confidence: 80,
              weight: 25,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      const rule = this.brandRules.get(brand);

      // Check brand is enabled
      if (!rule) {
        reasons.push('BRAND_NOT_CONFIGURED');
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'brand_known',
              value: 0,
              confidence: 80,
              weight: 25,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      if (!rule.enabled) {
        reasons.push('BRAND_DISABLED');
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'brand_known',
              value: 1,
              confidence: 80,
              weight: 25,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Check region matches (if rule specifies one)
      if (rule.region && region && region !== rule.region) {
        reasons.push('REGION_NOT_SUPPORTED');
      }

      // Check denomination is within range
      if (rule.minDenomination && denomination < rule.minDenomination) {
        reasons.push('DENOMINATION_OUT_OF_RANGE');
      }

      if (rule.maxDenomination && denomination > rule.maxDenomination) {
        reasons.push('DENOMINATION_OUT_OF_RANGE');
      }

      // Check denomination is in allowed list (if specified)
      if (
        rule.allowedDenominations &&
        rule.allowedDenominations.length > 0 &&
        !rule.allowedDenominations.includes(denomination)
      ) {
        reasons.push('DENOMINATION_OUT_OF_RANGE');
      }

      // If any validation failed
      if (reasons.length > 0) {
        return {
          status: 'FAIL',
          signals: [
            {
              key: 'brand_known',
              value: 1,
              confidence: 85,
              weight: 25,
            },
            {
              key: 'denomination_valid',
              value: reasons.some(r => r === 'DENOMINATION_OUT_OF_RANGE') ? 0 : 1,
              confidence: 80,
              weight: 20,
            },
            {
              key: 'region_supported',
              value: reasons.some(r => r === 'REGION_NOT_SUPPORTED') ? 0 : 1,
              confidence: 75,
              weight: 15,
            },
          ],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // All brand validations passed
      return {
        status: 'PASS',
        signals: [
          {
            key: 'brand_known',
            value: 1,
            confidence: 85,
            weight: 25,
          },
          {
            key: 'denomination_valid',
            value: 1,
            confidence: 80,
            weight: 20,
          },
          {
            key: 'region_supported',
            value: 1,
            confidence: 75,
            weight: 15,
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
}


