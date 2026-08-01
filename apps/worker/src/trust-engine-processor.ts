import type { Job } from 'bullmq';
import {
  TrustEngineService,
  ConsoleLogger,
  ConfigResolver,
  IntakeStage,
  QualityStage,
  ClassificationStage,
  OcrStage,
  BrandValidationStage,
  DuplicateStage,
  FraudScoringStage,
} from '@fliptrybe/service-trust-engine';
import { createPrismaClient, type DatabaseClient } from '@fliptrybe/database';
import type { TrustEngineValidationJob } from './queues';
import type {
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  SubmissionContext,
} from '@fliptrybe/service-trust-engine';

let dbSingleton: DatabaseClient | undefined;
let serviceSingleton: TrustEngineService | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) {
    dbSingleton = createPrismaClient();
  }
  return dbSingleton;
}

/**
 * Create repository implementations that wrap Prisma models.
 */
function createRepositories(db: DatabaseClient): {
  submissionRepo: SubmissionRepository;
  validationRunRepo: ValidationRunRepository;
  stageResultRepo: StageResultRepository;
} {
  return {
    submissionRepo: {
      async create(data) {
        const submission = await db.assetSubmission.create({
          data: {
            id: data.id,
            workspaceId: data.workspaceId,
            userId: data.userId,
            assetClass: data.assetClass,
            mediaAssetId: data.mediaAssetId ?? null,
            submissionProfile: data.submissionProfile as any,
            status: 'PENDING',
          },
        });
        return {
          id: submission.id,
          workspaceId: submission.workspaceId,
          userId: submission.userId,
          assetClass: submission.assetClass,
          status: submission.status,
          mediaAssetId: submission.mediaAssetId ?? '',
          submissionProfile: (submission.submissionProfile ?? {}) as Record<string, unknown>,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        };
      },
      async getById(submissionId) {
        const submission = await db.assetSubmission.findUnique({
          where: { id: submissionId },
        });
        if (!submission) return null;
        return {
          id: submission.id,
          workspaceId: submission.workspaceId,
          userId: submission.userId,
          assetClass: submission.assetClass,
          status: submission.status,
          mediaAssetId: submission.mediaAssetId ?? '',
          submissionProfile: (submission.submissionProfile ?? {}) as Record<string, unknown>,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        };
      },
      async updateStatus(submissionId, status) {
        await db.assetSubmission.update({
          where: { id: submissionId },
          data: { status },
        });
      },
    },
    validationRunRepo: {
      async create(data) {
        const run = await db.validationRun.create({
          data: {
            id: data.id,
            submissionId: data.submissionId,
            configVersion: data.configVersion,
            pipelineVersion: data.pipelineVersion,
            idempotencyKey: data.idempotencyKey,
            verdict: (data.verdict as any) ?? 'REVIEW',
            verdictReasons: (data.verdictReasons as any) ?? [],
            verdictExplained: data.verdictExplained ?? '',
            fraudScore: data.fraudScore ?? 0,
            trustScore: data.trustScore ?? 0,
            finalScore: data.finalScore ?? 0,
          },
        });
        return {
          id: run.id,
          submissionId: run.submissionId,
          configVersion: run.configVersion,
          pipelineVersion: run.pipelineVersion,
          idempotencyKey: run.idempotencyKey,
          verdict: run.verdict as any,
          verdictReasons: (run.verdictReasons as any) ?? [],
          verdictExplained: run.verdictExplained ?? '',
          fraudScore: run.fraudScore ?? 0,
          trustScore: run.trustScore ?? 0,
          finalScore: run.finalScore ?? 0,
          stageDurationMs: run.stageDurationMs as Record<string, number>,
          totalDurationMs: 0,
          stagesFailed: [],
          stagesInconcl: [],
          externalCalls: 0,
          externalCostMicro: 0,
          createdAt: run.createdAt,
        };
      },
      async getById(runId) {
        const run = await db.validationRun.findUnique({
          where: { id: runId },
        });
        if (!run) return null;
        return {
          id: run.id,
          submissionId: run.submissionId,
          configVersion: run.configVersion,
          pipelineVersion: run.pipelineVersion,
          idempotencyKey: run.idempotencyKey,
          verdict: run.verdict as any,
          verdictReasons: (run.verdictReasons as any) ?? [],
          verdictExplained: run.verdictExplained ?? '',
          fraudScore: run.fraudScore ?? 0,
          trustScore: run.trustScore ?? 0,
          finalScore: run.finalScore ?? 0,
          stageDurationMs: run.stageDurationMs as Record<string, number>,
          totalDurationMs: 0,
          stagesFailed: [],
          stagesInconcl: [],
          externalCalls: 0,
          externalCostMicro: 0,
          createdAt: run.createdAt,
        };
      },
      async getLatestBySubmissionId(submissionId) {
        const run = await db.validationRun.findFirst({
          where: { submissionId },
          orderBy: { createdAt: 'desc' },
        });
        if (!run) return null;
        return {
          id: run.id,
          submissionId: run.submissionId,
          configVersion: run.configVersion,
          pipelineVersion: run.pipelineVersion,
          idempotencyKey: run.idempotencyKey,
          verdict: run.verdict as any,
          verdictReasons: (run.verdictReasons as any) ?? [],
          verdictExplained: run.verdictExplained ?? '',
          fraudScore: run.fraudScore ?? 0,
          trustScore: run.trustScore ?? 0,
          finalScore: run.finalScore ?? 0,
          stageDurationMs: run.stageDurationMs as Record<string, number>,
          totalDurationMs: 0,
          stagesFailed: [],
          stagesInconcl: [],
          externalCalls: 0,
          externalCostMicro: 0,
          createdAt: run.createdAt,
        };
      },
    },
    stageResultRepo: {
      async create(data) {
        const result = await db.stageResult.create({
          data: {
            id: data.id,
            validationRunId: data.validationRunId,
            stageKey: data.stageKey as string,
            status: data.status,
            reasonCodes: (data.reasonCodes as any) ?? [],
            resultData: (data.resultData as any) ?? null,
            retryCount: data.retryCount,
            durationMs: data.durationMs,
            failureMessage: data.failureMessage ?? null,
          },
        });
        return {
          id: result.id,
          validationRunId: result.validationRunId,
          stageKey: result.stageKey as any,
          status: result.status,
          signals: [],
          reasonCodes: (result.reasonCodes as any) ?? [],
          resultData: (result.resultData ?? {}) as Record<string, unknown>,
          retryCount: result.retryCount,
          durationMs: result.durationMs,
          failureMessage: result.failureMessage || undefined,
          createdAt: result.createdAt,
        } as any;
      },
      async getByValidationRunId(runId) {
        const results = await db.stageResult.findMany({
          where: { validationRunId: runId },
        });
        return results.map((r) => ({
          id: r.id,
          validationRunId: r.validationRunId,
          stageKey: r.stageKey as any,
          status: r.status,
          signals: [],
          reasonCodes: (r.reasonCodes as any) ?? [],
          resultData: (r.resultData ?? {}) as Record<string, unknown>,
          retryCount: r.retryCount,
          durationMs: r.durationMs,
          failureMessage: r.failureMessage || undefined,
          createdAt: r.createdAt,
        })) as any;
      },
    },
  };
}

/**
 * Get or create the TrustEngineService singleton.
 */
function getService(): TrustEngineService {
  if (serviceSingleton) {
    return serviceSingleton;
  }

  const db = getDb();
  const repos = createRepositories(db);
  const logger = new ConsoleLogger();

  const stages = [
    new IntakeStage(),
    new QualityStage(),
    new ClassificationStage(),
    new OcrStage(),
    new BrandValidationStage(),
    new DuplicateStage(),
    new FraudScoringStage(),
  ];

  serviceSingleton = new TrustEngineService({
    submissionRepo: repos.submissionRepo,
    validationRunRepo: repos.validationRunRepo,
    stageResultRepo: repos.stageResultRepo,
    stages,
    logger,
  });

  return serviceSingleton;
}

/**
 * Process trust engine validation jobs from the queue.
 */
export async function processTrustEngineJob(job: Job<TrustEngineValidationJob>): Promise<void> {
  const { submissionId } = job.data;
  const service = getService();
  const db = getDb();

  try {
    const submission = await db.assetSubmission.findUnique({
      where: { id: submissionId },
      include: { mediaAsset: true },
    });

    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const configResolver = new ConfigResolver();
    const config = await configResolver.resolve({
      workspaceId: submission.workspaceId,
      userId: submission.userId,
    });

    const mediaAsset = submission.mediaAsset;
    const ctx: SubmissionContext = {
      submissionId: submission.id,
      workspaceId: submission.workspaceId,
      userId: submission.userId,
      assetClass: submission.assetClass,
      submissionProfile: (submission.submissionProfile ?? {}) as Record<string, unknown>,
      ...(submission.mediaAssetId ? { mediaAssetId: submission.mediaAssetId } : {}),
      ...(mediaAsset?.url ? { mediaAssetUrl: mediaAsset.url } : {}),
      ...(mediaAsset?.byteSize ? { mediaAssetByteSize: mediaAsset.byteSize } : {}),
      ...(mediaAsset?.width ? { mediaAssetWidth: mediaAsset.width } : {}),
      ...(mediaAsset?.height ? { mediaAssetHeight: mediaAsset.height } : {}),
      ...(mediaAsset?.checksumSha256 ? { checksumSha256: mediaAsset.checksumSha256 } : {}),
      config,
      configVersion: config.version,
      pipelineVersion: 1,
    };

    const verdict = await service.processSubmission(ctx);

    console.log(`[trust-engine] Submission ${submissionId} processed with verdict: ${verdict}`);
  } catch (error) {
    console.error(`[trust-engine] Job failed for submission ${submissionId}`, error);
    throw error;
  }
}
