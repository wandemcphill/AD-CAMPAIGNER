/**
 * Brand Validation Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BrandValidationStage } from './brand-validation.stage.js';
import type { SubmissionContext } from '../types.js';

describe('BrandValidationStage', () => {
  let stage: BrandValidationStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new BrandValidationStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US', denomination: 5000 }, // $50
      mediaAssetId: 'ma_123',
      mediaAssetWidth: 2000,
      mediaAssetHeight: 1600,
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
    it('should pass for valid Apple gift card', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should pass for Google Play card', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'GOOGLE_PLAY', region: 'US', denomination: 2500 },
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should pass for Amazon card', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'AMAZON', region: 'US', denomination: 10000 },
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
    });

    it('should fail if brand is not configured', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'UNKNOWN_BRAND', region: 'US', denomination: 5000 },
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('BRAND_NOT_CONFIGURED');
    });

    it('should fail if brand is empty', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { region: 'US', denomination: 5000 },
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('BRAND_NOT_CONFIGURED');
    });

    it('should fail if denomination below minimum', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US', denomination: 200 }, // $2 < $5 min
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('DENOMINATION_OUT_OF_RANGE');
    });

    it('should fail if denomination above maximum', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US', denomination: 300000 }, // $3000 > $2000 max
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('DENOMINATION_OUT_OF_RANGE');
    });

    it('should fail if denomination not in allowed list', async () => {
      // Apple only allows specific denominations
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US', denomination: 7500 }, // $75 not in allowed list
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('DENOMINATION_OUT_OF_RANGE');
    });

    it('should fail if region does not match', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'UK', denomination: 5000 }, // Apple rule requires US
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('REGION_NOT_SUPPORTED');
    });

    it('should report brand known signal', async () => {
      const outcome = await stage.execute(baseContext);

      const brandSignal = outcome.signals.find(s => s.key === 'brand_known');
      expect(brandSignal).toBeDefined();
      expect(brandSignal!.value).toBe(1);
    });

    it('should report denomination valid signal', async () => {
      const outcome = await stage.execute(baseContext);

      const denomSignal = outcome.signals.find(s => s.key === 'denomination_valid');
      expect(denomSignal).toBeDefined();
      expect(denomSignal!.value).toBe(1);
    });

    it('should report region supported signal', async () => {
      const outcome = await stage.execute(baseContext);

      const regionSignal = outcome.signals.find(s => s.key === 'region_supported');
      expect(regionSignal).toBeDefined();
      expect(regionSignal!.value).toBe(1);
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
  });
});

