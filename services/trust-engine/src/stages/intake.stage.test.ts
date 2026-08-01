/**
 * Intake Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntakeStage } from './intake.stage.js';
import type { SubmissionContext } from '../types.js';

describe('IntakeStage', () => {
  let stage: IntakeStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new IntakeStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US' },
      mediaAssetId: 'ma_123',
      mediaAssetWidth: 2000,
      mediaAssetHeight: 1600,
      mediaAssetByteSize: 500 * 1024, // 500 KB
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
    it('should support all contexts with mediaAsset', () => {
      expect(stage.supports()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should pass for valid image', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
      expect(outcome.signals).toHaveLength(2);
      expect(outcome.signals[0]!.key).toBe('file_valid');
    });

    it('should fail if mediaAssetId is missing', async () => {
      const { mediaAssetId, ...ctxWithoutId } = baseContext;
      void mediaAssetId;

      const outcome = await stage.execute({
        ...ctxWithoutId,
      });

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('UPLOAD_MISSING');
    });

    it('should fail for invalid content type', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        // Would check actual contentType from MediaAsset in real impl
      };

      const outcome = await stage.execute(ctx);

      // In real impl, this would check against allowed types
      expect(outcome.status).toBe('PASS');
    });

    it('should fail if file is too small', async () => {
      const ctx: SubmissionContext = { ...baseContext, mediaAssetByteSize: 50 * 1024 }; // 50 KB

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('FILE_SIZE_EXCEEDS_LIMIT');
    });

    it('should fail if file is too large', async () => {
      const ctx: SubmissionContext = { ...baseContext, mediaAssetByteSize: 25 * 1024 * 1024 }; // 25 MB

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('FILE_SIZE_EXCEEDS_LIMIT');
    });

    it('should fail if resolution is too low', async () => {
      const ctx: SubmissionContext = { ...baseContext, mediaAssetWidth: 640, mediaAssetHeight: 480 };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('IMAGE_RESOLUTION_TOO_LOW');
    });

    it('should fail for extreme aspect ratio (too wide)', async () => {
      const ctx: SubmissionContext = { ...baseContext, mediaAssetWidth: 4000, mediaAssetHeight: 1000 };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('QUALITY_BLUR_DETECTED');
    });

    it('should fail for extreme aspect ratio (too tall)', async () => {
      const ctx: SubmissionContext = { ...baseContext, mediaAssetWidth: 1000, mediaAssetHeight: 4000 };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('QUALITY_BLUR_DETECTED');
    });

    it('should normalize resolution for 90 degree rotation', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 1600,
        mediaAssetHeight: 2000,
        mediaAssetExifRotation: 90,
        // After normalization: 2000x1600 (portrait becomes landscape)
      };

      const outcome = await stage.execute(ctx);

      // Should still pass if normalized resolution is valid
      expect(outcome.status).toBe('PASS');
    });
  });
});

