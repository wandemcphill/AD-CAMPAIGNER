/**
 * Duplicate Detection Stage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DuplicateStage } from './duplicate.stage.js';
import type { SubmissionContext } from '../types.js';

describe('DuplicateStage', () => {
  let stage: DuplicateStage;
  let baseContext: SubmissionContext;

  beforeEach(() => {
    stage = new DuplicateStage();
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
      checksumSha256: 'abc123def456',
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
    it('should pass for unique submission', async () => {
      const outcome = await stage.execute(baseContext);

      expect(outcome.status).toBe('PASS');
      expect(outcome.reasons).toHaveLength(0);
      const dupSignal = outcome.signals.find(s => s.key === 'duplicate_risk');
      expect(dupSignal).toBeDefined();
      expect(dupSignal!.value).toBeLessThan(50);
    });

    it('should report low duplicate risk for normal cards', async () => {
      const outcome = await stage.execute(baseContext);

      const dupSignal = outcome.signals.find(s => s.key === 'duplicate_risk');
      expect(dupSignal).toBeDefined();
      expect(dupSignal!.value).toBeGreaterThanOrEqual(0);
      expect(dupSignal!.value).toBeLessThanOrEqual(100);
    });
  });
});
