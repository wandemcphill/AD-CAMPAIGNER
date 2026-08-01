/**
 * Fraud Scoring Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FraudScoringStage } from './fraud-scoring.stage.js';
import type { SubmissionContext } from '../types.js';

describe('FraudScoringStage', () => {
  let stage: FraudScoringStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new FraudScoringStage();
    baseContext = {
      submissionId: 'sub_123',
      workspaceId: 'ws_123',
      userId: 'user_123',
      assetClass: 'GIFT_CARD',
      submissionProfile: { brand: 'APPLE', region: 'US', denomination: 5000 },
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
    it('should return neutral fraud score for clean submission', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThanOrEqual(40);
      expect(fraudSignal!.value).toBeLessThanOrEqual(60);
    });

    it('should increase fraud score for very low resolution', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 300,
        mediaAssetHeight: 200,
      };

      const outcome = await stage.execute(ctx);

      expect(outcome.status).toBe('PASS');
      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThan(50);
    });

    it('should increase fraud score for extreme aspect ratio', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 4000,
        mediaAssetHeight: 1000,
      };

      const outcome = await stage.execute(ctx);

      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThan(50);
    });

    it('should increase fraud score for portrait image claiming gift card', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        mediaAssetWidth: 1000,
        mediaAssetHeight: 2400,
        assetClass: 'GIFT_CARD',
      };

      const outcome = await stage.execute(ctx);

      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThan(50);
    });

    it('should increase fraud score for very high denomination', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'US', denomination: 300000 },
      };

      const outcome = await stage.execute(ctx);

      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThan(50);
    });

    it('should increase fraud score for mismatched region', async () => {
      const ctx: SubmissionContext = {
        ...baseContext,
        submissionProfile: { brand: 'APPLE', region: 'UK', denomination: 5000 },
      };

      const outcome = await stage.execute(ctx);

      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThan(50);
    });

    it('should report fraud score 0–100', async () => {
      const outcome = await stage.execute(baseContext);

      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBeGreaterThanOrEqual(0);
      expect(fraudSignal!.value).toBeLessThanOrEqual(100);
    });

    it('should return neutral score if mediaAssetId missing', async () => {
      const { mediaAssetId, ...ctxWithoutId } = baseContext;
      void mediaAssetId;

      const outcome = await stage.execute({
        ...ctxWithoutId,
      });

      expect(outcome.status).toBe('PASS');
      const fraudSignal = outcome.signals.find(s => s.key === 'fraud_score');
      expect(fraudSignal).toBeDefined();
      expect(fraudSignal!.value).toBe(50); // Neutral
    });
  });
});
