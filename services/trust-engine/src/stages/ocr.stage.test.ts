/**
 * OCR Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OcrStage } from './ocr.stage.js';
import type { SubmissionContext } from '../types.js';

describe('OcrStage', () => {
  let stage: OcrStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new OcrStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US', denomination: 2500 },
      mediaAssetId: 'ma_123',
      mediaAssetWidth: 3000, // High-res landscape
      mediaAssetHeight: 2000,
      mediaAssetByteSize: 800 * 1024, // 800 KB â†’ good compression
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
    it('should pass for high-res, well-compressed image', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
      // Should detect codes
      const codeSignal = outcome.signals.find(s => s.key === 'code_detection_count');
      expect(codeSignal).toBeDefined();
      expect(codeSignal!.value).toBeGreaterThan(0);
    });

    it('should fail if OCR confidence too low', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 400, // Low resolution
        mediaAssetHeight: 300,
        mediaAssetByteSize: 30 * 1024, // Small file
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('OCR_LOW_CONFIDENCE');
    });

    it('should fail if no codes detected', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 500, // Too low-res for code detection
        mediaAssetHeight: 600,
        mediaAssetByteSize: 50 * 1024,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('FAIL');
      expect(outcome.reasons).toContain('OCR_CODE_NOT_DETECTED');
    });

    it('should detect multiple codes in high-res landscape', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 4000,
        mediaAssetHeight: 2500,
        mediaAssetByteSize: 1200 * 1024,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      const codeSignal = outcome.signals.find(s => s.key === 'code_detection_count');
      expect(codeSignal).toBeDefined();
      expect(codeSignal!.value).toBeGreaterThanOrEqual(2);
    });

    it('should report brand detection', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      const brandSignal = outcome.signals.find(s => s.key === 'brand_detected');
      expect(brandSignal).toBeDefined();
      expect(brandSignal!.value).toBe(1);
    });

    it('should report denomination detection', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      const denomSignal = outcome.signals.find(s => s.key === 'denomination_detected');
      expect(denomSignal).toBeDefined();
      expect(denomSignal!.value).toBe(1);
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

    it('should report OCR text confidence 0â€“100', async () => {
      const outcome = await stage.execute(baseContext);

      const confSignal = outcome.signals.find(s => s.key === 'ocr_text_confidence');
      expect(confSignal).toBeDefined();
      expect(confSignal!.value).toBeGreaterThanOrEqual(0);
      expect(confSignal!.value).toBeLessThanOrEqual(100);
    });
  });
});

