/**
 * Classification Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClassificationStage } from './classification.stage.js';
import type { SubmissionContext } from '../types.js';

describe('ClassificationStage', () => {
  let stage: ClassificationStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new ClassificationStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US' },
      mediaAssetId: 'ma_123',
      mediaAssetWidth: 2000,
      mediaAssetHeight: 1600, // ~1.25 aspect ratio (landscape)
      mediaAssetByteSize: 500 * 1024,
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
    it('should pass for claimed gift card with landscape aspect ratio', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should boost confidence for known brand', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US' },
      };

      const outcome = await stage.execute(ctx);

      const confidenceSignal = outcome.signals.find(s => s.key === 'classification_confidence');
      expect(confidenceSignal).toBeDefined();
      expect(confidenceSignal!.value).toBeGreaterThan(60);
    });

    it('should detect portrait image as airtime pin', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        assetClass: 'GIFT_CARD',
        mediaAssetWidth: 1000, // Tall narrow
        mediaAssetHeight: 2400,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('NOT_A_GIFT_CARD');
    });

    it('should pass for tall narrow image claimed as airtime pin', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        assetClass: 'AIRTIME_PIN',
        mediaAssetWidth: 1200, // Tall narrow (0.5 aspect)
        mediaAssetHeight: 2400,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should fail low resolution images (confidence penalty)', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 800, // ~0.64 MP
        mediaAssetHeight: 640,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      const confidenceSignal = outcome.signals.find(s => s.key === 'classification_confidence');
      expect(confidenceSignal).toBeDefined();
      expect(confidenceSignal!.value).toBeLessThan(60);
    });

    it('should boost confidence for high resolution images', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 4000, // ~24 MP
        mediaAssetHeight: 3200,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      const confidenceSignal = outcome.signals.find(s => s.key === 'classification_confidence');
      expect(confidenceSignal).toBeDefined();
      // High resolution should boost confidence
      expect(confidenceSignal!.value).toBeGreaterThanOrEqual(75);
    });

    it('should pass voucher with square aspect ratio', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        assetClass: 'RECHARGE_VOUCHER',
        mediaAssetWidth: 2000,
        mediaAssetHeight: 2000,
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

    it('should report classification confidence 0â€“100', async () => {
      const outcome = await stage.execute(baseContext);

      const confidenceSignal = outcome.signals.find(s => s.key === 'classification_confidence');
      expect(confidenceSignal).toBeDefined();
      expect(confidenceSignal!.value).toBeGreaterThanOrEqual(0);
      expect(confidenceSignal!.value).toBeLessThanOrEqual(100);
    });

    it('should boost confidence if region is set', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US' },
      };

      const outcome = await stage.execute(ctx);

      const confidenceSignal = outcome.signals.find(s => s.key === 'classification_confidence');
      expect(confidenceSignal).toBeDefined();
      // Region should add confidence
      expect(confidenceSignal!.value).toBeGreaterThanOrEqual(65);
    });
  });
});

