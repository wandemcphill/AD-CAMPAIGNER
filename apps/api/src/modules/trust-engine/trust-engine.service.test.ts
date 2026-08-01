/**
 * Trust Engine Service Tests
 * Phase 1: skeleton tests only. Core logic tests in Phases 2+.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrustEngineService } from './trust-engine.service.js';
import { PrismaService } from '../prisma.service.js';
import { QueueProducerService } from '../queue-producer.service.js';
import type { AuthenticatedRequestContext } from '../request-context.js';

vi.mock('@fliptrybe/feature-flags', () => ({
  isFeatureEnabled: () => true,
}));

describe('TrustEngineService', () => {
  let service: TrustEngineService;
  let mockPrisma: PrismaService;
  let mockQueue: QueueProducerService;
  let ctx: AuthenticatedRequestContext;

  beforeEach(() => {
    mockPrisma = {
      assetSubmission: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    mockQueue = {
      enqueueTrustEngineValidation: vi.fn(),
    } as unknown as QueueProducerService;

    ctx = {
      workspaceId: 'ws_123',
      userId: 'user_123',
    };

    service = new TrustEngineService(mockPrisma, mockQueue);
  });

  describe('createSubmission', () => {
    it('should return a submission created response (Phase 1 skeleton)', async () => {
      const dto = {
        assetClass: 'GIFT_CARD' as const,
        submissionProfile: { brand: 'APPLE', region: 'US', denomination: 1000 },
      };

      const result = await service.createSubmission(ctx, dto);

      expect(result).toHaveProperty('submissionId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
      expect(result.message).toContain('Phase 1 skeleton');
    });
  });

  describe('getSubmissionStatus', () => {
    it('should return submission status (Phase 1 skeleton)', async () => {
      const dto = { submissionId: 'sub_123' };

      const result = await service.getSubmissionStatus(ctx, dto);

      expect(result).toHaveProperty('submissionId');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('processSubmission', () => {
    it('should process submission (Phase 1 skeleton)', async () => {
      await expect(service.processSubmission('sub_123')).resolves.not.toThrow();
    });
  });
});
