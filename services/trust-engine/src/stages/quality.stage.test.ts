/**
 * Quality Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityStage } from './quality.stage.js';
import type { SubmissionContext } from '../types.js';

describe('QualityStage', () => {
  let stage: QualityStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new QualityStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US' },
      mediaAssetId: 'ma_123',
      mediaAssetWidth: 2000,
      mediaAssetHeight: 1600,
      mediaAssetByteSize: 500 * 1024, // 500 KB (good compression ratio)
      config: {
        version: 1,
        thresholds: { acceptMax: 30, rejectMin: 70 },
        stageLimits: {
          maxDurationPerStageMs: 10000,
          maxTotalDurationMs: 30000,
          maxExternalCalls: 5,
          maxCostPerSubmissionMicro: 50000,
        },
        qualityThresholds: {
          minQualityScore: 50,
          requireFullCard: true,
          minOcrConfidence: 60,
        },
        duplicatePolicy: {
          exactReject: true,
          nearReview: true,
          historyDays: 90,
        },
        inference: {
          provider: 'hybrid',
          qualityAssessmentEngine: 'local',
          ocrEngine: 'google_vision',
        },
        shortCircuit: {
          onIntakeFail: true,
          onDuplicate: false,
          onQualityFail: false,
        },
        enabledAssetClasses: ['GIFT_CARD'],
        enabledBrands: [],
      },
      configVersion: 1,
      pipelineVersion: 1,
    };
  });

  describe('supports', () => {
    it('should support all contexts', () => {
      expect(stage.supports()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should pass for good quality image', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
      expect(outcome.signals.length).toBeGreaterThan(0);

      // Check for quality_score signal
      const qualitySignal = outcome.signals.find(s => s.key === 'quality_score');
      expect(qualitySignal).toBeDefined();
      expect(qualitySignal!.value).toBeGreaterThanOrEqual(50);
    });

    it('should fail if file is heavily compressed (blur risk)', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetByteSize: 50 * 1024, // 50 KB â†’ very high compression ratio
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      // Should have quality-related reasons
      expect(
        outcome.reasons.some(r =>
          ['QUALITY_BLUR_DETECTED', 'QUALITY_TOO_DARK', 'QUALITY_TOO_BRIGHT'].includes(r)
        )
      ).toBe(true);
    });

    it('should fail if image is too dark (low file size)', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetByteSize: 60 * 1024, // Very small file â†’ likely underexposed
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(
        outcome.reasons.some(r =>
          ['QUALITY_TOO_DARK', 'QUALITY_BLUR_DETECTED'].includes(r)
        )
      ).toBe(true);
    });

    it('should detect cropping from extreme aspect ratio', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 3000, // Wide
        mediaAssetHeight: 800, // Short â†’ extreme crop
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('CROPPING_DETECTED');
    });

    it('should detect partial card (low resolution)', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 600, // Very small
        mediaAssetHeight: 500,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('PARTIAL_CARD_VISIBLE');
    });

    it('should pass with good compression ratio', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 3000,
        mediaAssetHeight: 2400,
        mediaAssetByteSize: 800 * 1024, // 800 KB â†’ 0.3 KB/MP (good)
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should fail if mediaAssetId is missing', async () => {
      const { mediaAssetId, ...ctxWithoutId } = baseContext;
      void mediaAssetId;

      const outcome = await stage.execute({
        ...ctxWithoutId,
      });

      expect(outcome.status).toBe('INCONCLUSIVE');
      expect(outcome.reasons).toContain('UPLOAD_MISSING');
    });

    it('should compute quality score as 0â€“100', async () => {
      const outcome = await stage.execute(baseContext);

      const qualitySignal = outcome.signals.find(s => s.key === 'quality_score');
      expect(qualitySignal).toBeDefined();
      expect(qualitySignal!.value).toBeGreaterThanOrEqual(0);
      expect(qualitySignal!.value).toBeLessThanOrEqual(100);
    });
  });
});

