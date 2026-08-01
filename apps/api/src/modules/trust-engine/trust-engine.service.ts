/**
 * Trust Engine Service — orchestrates the validation pipeline.
 * Phase 1: skeleton. Core logic implemented in Phases 2–9.
 */

import { Injectable, Logger } from '@nestjs/common';
import { isFeatureEnabled } from '@fliptrybe/feature-flags';
import { ConfigResolver } from '@fliptrybe/service-trust-engine';
import type {
  SubmissionRepository,
  TrustEngineLogger,
} from '@fliptrybe/service-trust-engine';
import { uid } from 'uid';
import { PrismaService } from '../prisma.service.js';
import { QueueProducerService } from '../queue-producer.service.js';
import { AuthenticatedRequestContext } from '../request-context.js';
import type {
  CreateSubmissionDto,
  SubmissionStatusDto,
  CreateSubmissionResponseDto,
  SubmissionStatusResponseDto,
} from './dtos.js';
import { PrismaSubmissionRepository, PrismaValidationRunRepository } from './repositories.js';

/**
 * Adapter: Nest Logger to Trust Engine Logger interface.
 */
class NestLoggerAdapter implements TrustEngineLogger {
  constructor(private readonly nestLogger: Logger) {}

  debug(message: string, metadata?: Record<string, unknown>) {
    this.nestLogger.debug(message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.nestLogger.log(message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.nestLogger.warn(message, metadata);
  }

  error(message: string, error?: unknown, metadata?: Record<string, unknown>) {
    this.nestLogger.error(message, error, metadata);
  }

  audit(action: string, metadata: Record<string, unknown>) {
    this.nestLogger.log(`[AUDIT] ${action}`, metadata);
  }

  redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...obj };
    const secretKeys = ['secret', 'pin', 'code', 'ecode', 'cardInfo', 'token', 'key'];
    for (const key of secretKeys) {
      if (key in redacted) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }
}

@Injectable()
export class TrustEngineService {
  private readonly logger = new Logger(TrustEngineService.name);
  private readonly trustEngineLogger = new NestLoggerAdapter(this.logger);

  private readonly submissionRepo: SubmissionRepository;
  private readonly configResolver: ConfigResolver;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducerService
  ) {
    // Initialize repositories
    this.submissionRepo = new PrismaSubmissionRepository(prisma);

    // Initialize config resolver with optional workspace config loader
    this.configResolver = new ConfigResolver(
      {},
      this.trustEngineLogger
    );
  }

  /**
   * Create a new submission and queue it for validation.
   * Phase 2: accept upload and enqueue for pipeline execution.
   */
  async createSubmission(
    ctx: AuthenticatedRequestContext,
    dto: CreateSubmissionDto
  ): Promise<CreateSubmissionResponseDto> {
    if (!isFeatureEnabled('trustEngine')) {
      throw new Error('Trust Engine is not enabled');
    }

    this.logger.debug('Creating submission', {
      assetClass: dto.assetClass,
      workspaceId: ctx.workspaceId,
    });

    const submissionId = uid('sub');

    // Create AssetSubmission record
    await this.submissionRepo.create({
      id: submissionId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      assetClass: dto.assetClass,
      mediaAssetId: dto.mediaAssetId,
      submissionProfile: dto.submissionProfile,
    });

    // Enqueue for pipeline processing
    await this.queue.enqueueTrustEngineValidation(submissionId);

    this.logger.info('Submission created and queued', { submissionId });

    return {
      submissionId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      message: 'Submission received. We will verify it in the next 30 seconds.',
    };
  }

  /**
   * Get the status of a submission.
   * Phase 1: skeleton. Phase 2+: poll ValidationRun for verdict.
   */
  getSubmissionStatus(
    ctx: AuthenticatedRequestContext,
    dto: SubmissionStatusDto
  ): Promise<SubmissionStatusResponseDto> {
    if (!isFeatureEnabled('trustEngine')) {
      throw new Error('Trust Engine is not enabled');
    }

    this.logger.debug('Getting submission status', {
      submissionId: dto.submissionId,
    });

    // Phase 1: skeleton only
    // Phase 2: load AssetSubmission, get latest ValidationRun, return status

    return Promise.resolve({
      submissionId: dto.submissionId,
      status: 'PENDING',
      assetClass: 'GIFT_CARD',
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Process a submission (called by the worker queue).
   * Phase 1: skeleton. Phases 2–9: implement pipeline execution.
   */
  processSubmission(submissionId: string): Promise<void> {
    if (!isFeatureEnabled('trustEngine')) {
      this.logger.warn('Trust Engine disabled; skipping submission', { submissionId });
      return Promise.resolve();
    }

    this.logger.debug('Processing submission', { submissionId });

    // Phase 1: skeleton only
    // Phases 2–9:
    // 1. Load AssetSubmission
    // 2. Resolve config
    // 3. Create ValidationRun
    // 4. Run pipeline: stages → arbiter → verdict
    // 5. Persist results
    // 6. Emit event (submission_accepted / _rejected / _review)
    return Promise.resolve();
  }
}
