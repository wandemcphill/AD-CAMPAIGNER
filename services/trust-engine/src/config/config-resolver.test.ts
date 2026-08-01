/**
 * Configuration Resolver Tests
 * Verifies that config is loaded correctly from environment and merged.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigResolver } from './config-resolver.js';
import { NoOpLogger } from '../logger.js';

describe('ConfigResolver', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadGlobalDefaults', () => {
    it('should load defaults from environment variables', async () => {
      process.env.TRUST_ENGINE_CONFIG_VERSION = '2';
      process.env.TRUST_ENGINE_FRAUD_ACCEPT_MAX = '25';
      process.env.TRUST_ENGINE_FRAUD_REJECT_MIN = '75';
      process.env.TRUST_ENGINE_INFERENCE_PROVIDER = 'google_vision';
      process.env.TRUST_ENGINE_ENABLED_ASSET_CLASSES = 'GIFT_CARD,AIRTIME_PIN';

      const resolver = new ConfigResolver({}, new NoOpLogger());

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      expect(config.version).toBe(2);
      expect(config.thresholds.acceptMax).toBe(25);
      expect(config.thresholds.rejectMin).toBe(75);
      expect(config.inference.provider).toBe('google_vision');
      expect(config.enabledAssetClasses).toContain('GIFT_CARD');
      expect(config.enabledAssetClasses).toContain('AIRTIME_PIN');
    });

    it('should use defaults when environment variables are not set', async () => {
      // Clear relevant env vars
      delete process.env.TRUST_ENGINE_FRAUD_ACCEPT_MAX;
      delete process.env.TRUST_ENGINE_FRAUD_REJECT_MIN;

      const resolver = new ConfigResolver({}, new NoOpLogger());

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      expect(config.thresholds.acceptMax).toBe(30);
      expect(config.thresholds.rejectMin).toBe(70);
    });

    it('should parse boolean environment variables correctly', async () => {
      process.env.TRUST_ENGINE_REQUIRE_FULL_CARD = 'false';
      process.env.TRUST_ENGINE_SHORT_CIRCUIT_ON_INTAKE_FAIL = '0';
      process.env.TRUST_ENGINE_DUPLICATE_NEAR_REVIEW = 'true';

      const resolver = new ConfigResolver({}, new NoOpLogger());

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      expect(config.qualityThresholds.requireFullCard).toBe(false);
      expect(config.shortCircuit.onIntakeFail).toBe(false);
      expect(config.duplicatePolicy.nearReview).toBe(true);
    });

    it('should parse comma-separated asset classes', async () => {
      process.env.TRUST_ENGINE_ENABLED_ASSET_CLASSES = 'GIFT_CARD,AIRTIME_PIN,RECHARGE_VOUCHER';

      const resolver = new ConfigResolver({}, new NoOpLogger());

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      expect(config.enabledAssetClasses).toHaveLength(3);
      expect(config.enabledAssetClasses).toContain('AIRTIME_PIN');
    });
  });

  describe('merge', () => {
    it('should merge workspace overrides with global defaults', async () => {
      const resolver = new ConfigResolver(
        {
          loadWorkspaceConfig: () => Promise.resolve({
            thresholds: {
              acceptMax: 20,
              rejectMin: 80,
            },
          }),
        },
        new NoOpLogger()
      );

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      // Overridden
      expect(config.thresholds.acceptMax).toBe(20);
      expect(config.thresholds.rejectMin).toBe(80);

      // Still defaults
      expect(config.qualityThresholds.minQualityScore).toBe(50);
    });

    it('should return defaults if workspace config loading fails', async () => {
      const resolver = new ConfigResolver(
        {
          loadWorkspaceConfig: () => Promise.reject(new Error('Database error')),
        },
        new NoOpLogger()
      );

      const config = await resolver.resolve({
        workspaceId: 'ws_123',
        userId: 'user_123',
      });

      // Should not throw; should return defaults
      expect(config.thresholds.acceptMax).toBe(30);
      expect(config.thresholds.rejectMin).toBe(70);
    });
  });
});
