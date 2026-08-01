/**
 * Trust Engine Service — public API for submission lifecycle.
 */

import type {
  SubmissionContext,
  SubmissionStatus,
  ValidationStage,
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  Verdict,
  AssetClass,
} from './types.js';
import { PipelineOrchestrator, DefaultArbiter } from './pipeline/orchestrator.js';
import type { TrustEngineLogger } from './logger.js';
import { NoOpLogger } from './logger.js';

/**
 * Generate a simple UUID-like ID.
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export interface TrustEngineServiceDeps {
  submissionRepo: SubmissionRepository;
  validationRunRepo: ValidationRunRepository;
  stageResultRepo: StageResultRepository;
  stages: ValidationStage[];
  logger?: TrustEngineLogger;
}

/**
 * Main service that orchestrates the submission validation pipeline.
 */
export class TrustEngineService {
  private readonly logger: TrustEngineLogger;
  private readonly stages: ValidationStage[];

  constructor(private readonly deps: TrustEngineServiceDeps) {
    this.logger = deps.logger ?? new NoOpLogger();
    this.stages = deps.stages;
  }

  /**
   * Create a new submission and enqueue for processing.
   */
  async createSubmission(input: {
    workspaceId: string;
    userId: string;
    assetClass: string;
    mediaAssetId?: string;
    submissionProfile: Record<string, unknown>;
  }): Promise<string> {
    const submissionId = `sub_${generateId()}`;

    await this.deps.submissionRepo.create({
      id: submissionId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      assetClass: input.assetClass as AssetClass,
      ...(input.mediaAssetId && { mediaAssetId: input.mediaAssetId }),
      submissionProfile: input.submissionProfile,
    });

    this.logger.debug('Submission created', {
      submissionId,
      workspaceId: input.workspaceId,
    });

    return submissionId;
  }

  /**
   * Get the current status of a submission (verdict + reasons).
   */
  async getSubmissionStatus(submissionId: string): Promise<{
    status: SubmissionStatus;
    verdict?: Verdict;
    reasons: string[];
    explainedVerdict?: string;
  }> {
    const submission = await this.deps.submissionRepo.getById(submissionId);
    if (!submission) {
      return {
        status: 'PENDING',
        reasons: ['SUBMISSION_NOT_FOUND'],
      };
    }

    const latestRun = await this.deps.validationRunRepo.getLatestBySubmissionId(
      submissionId
    );

    if (!latestRun) {
      return {
        status: submission.status,
        reasons: [],
      };
    }

    return {
      status: submission.status,
      verdict: latestRun.verdict,
      reasons: latestRun.verdictReasons,
      explainedVerdict: latestRun.verdictExplained,
    };
  }

  /**
   * Process a submission through the full pipeline.
   * Called by the job queue handler.
   */
  async processSubmission(ctx: SubmissionContext): Promise<Verdict> {
    this.logger.info('Processing submission', {
      submissionId: ctx.submissionId,
      stages: this.stages.map(s => s.key),
    });

    const startTime = performance.now();

    try {
      // Run the pipeline
      const orchestrator = new PipelineOrchestrator({
        context: ctx,
        stages: this.stages,
        arbitrator: new DefaultArbiter(),
        logger: this.logger,
      });

      const { result, stageResults, totalDurationMs, externalCalls, externalCostMicro } =
        await orchestrator.execute();

      // Save validation run
      const runId = `vrun_${generateId()}`;
      const idempotencyKey = this.deriveIdempotencyKey(ctx);

      await this.deps.validationRunRepo.create({
        id: runId,
        submissionId: ctx.submissionId,
        configVersion: ctx.configVersion,
        pipelineVersion: ctx.pipelineVersion,
        idempotencyKey,
        verdict: result.verdict,
        verdictReasons: [...result.reasons],
        verdictExplained: result.explained,
        fraudScore: result.fraudScore,
        trustScore: result.trustScore,
        finalScore: result.finalScore,
      });

      // Save all stage results
      for (const [stageKey, outcome] of stageResults) {
        await this.deps.stageResultRepo.create({
          id: `sr_${generateId()}`,
          validationRunId: runId,
          stageKey,
          status: outcome.status,
          signals: [...outcome.signals],
          reasonCodes: [...outcome.reasons],
          retryCount: outcome.retryCount,
          durationMs: outcome.durationMs,
          ...(outcome.failureMessage && { failureMessage: outcome.failureMessage }),
        });
      }

      // Update submission status
      const submissionStatus = this.verdictToStatus(result.verdict);
      await this.deps.submissionRepo.updateStatus(ctx.submissionId, submissionStatus);

      this.logger.info('Submission processed', {
        submissionId: ctx.submissionId,
        verdict: result.verdict,
        totalDurationMs,
        externalCalls,
        externalCostMicro,
      });

      return result.verdict;
    } catch (err) {
      this.logger.error('Submission processing failed', err, {
        submissionId: ctx.submissionId,
        durationMs: performance.now() - startTime,
      });

      // Mark as REVIEW on unexpected failure
      await this.deps.submissionRepo.updateStatus(ctx.submissionId, 'REVIEW');
      throw err;
    }
  }

  /**
   * Derive a stable idempotency key for a submission to prevent duplicate processing.
   */
  private deriveIdempotencyKey(ctx: SubmissionContext): string {
    const key = `${ctx.submissionId}:${ctx.configVersion}:${ctx.pipelineVersion}`;
    return key;
  }

  /**
   * Map verdict to submission status.
   */
  private verdictToStatus(verdict: Verdict): SubmissionStatus {
    switch (verdict) {
      case 'ACCEPT':
        return 'ACCEPTED';
      case 'REVIEW':
        return 'REVIEW';
      case 'REJECT':
        return 'REJECTED';
    }
  }
}
