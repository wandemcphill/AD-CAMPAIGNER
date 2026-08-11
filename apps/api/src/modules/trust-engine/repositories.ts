import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@fliptrybe/database';
import { PrismaService } from '../prisma.service';
import type {
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  CreateSubmissionInput,
  CreateValidationRunInput,
  CreateStageResultInput,
  Verdict,
  ReasonCode,
  StageKey,
} from '@fliptrybe/service-trust-engine';

@Injectable()
export class TrustEngineRepositories {
  readonly submissionRepo: SubmissionRepository;
  readonly validationRunRepo: ValidationRunRepository;
  readonly stageResultRepo: StageResultRepository;

  constructor(private prismaService: PrismaService) {
    const db = this.prismaService.client;

    this.submissionRepo = {
      create: async (data: CreateSubmissionInput) => {
        const submission = await db.assetSubmission.create({
          data: {
            id: data.id,
            workspaceId: data.workspaceId,
            userId: data.userId,
            assetClass: data.assetClass,
            mediaAssetId: data.mediaAssetId ?? null,
            submissionProfile: data.submissionProfile as Prisma.InputJsonValue,
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
      getById: async (submissionId: string) => {
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
      updateStatus: async (submissionId, status) => {
        await db.assetSubmission.update({
          where: { id: submissionId },
          data: { status },
        });
      },
    };

    this.validationRunRepo = {
      create: async (data: CreateValidationRunInput) => {
        const run = await db.validationRun.create({
          data: {
            id: data.id,
            submissionId: data.submissionId,
            configVersion: data.configVersion,
            pipelineVersion: data.pipelineVersion,
            idempotencyKey: data.idempotencyKey,
            verdict: data.verdict ?? 'REVIEW',
            verdictReasons: data.verdictReasons ?? [],
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
          verdict: (run.verdict ?? 'REVIEW') as Verdict,
          verdictReasons: (run.verdictReasons ?? []) as ReasonCode[],
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
      getById: async (runId: string) => {
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
          verdict: (run.verdict ?? 'REVIEW') as Verdict,
          verdictReasons: (run.verdictReasons ?? []) as ReasonCode[],
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
      getLatestBySubmissionId: async (submissionId: string) => {
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
          verdict: (run.verdict ?? 'REVIEW') as Verdict,
          verdictReasons: (run.verdictReasons ?? []) as ReasonCode[],
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
    };

    this.stageResultRepo = {
      create: async (data: CreateStageResultInput) => {
        const result = await db.stageResult.create({
          data: {
            id: data.id,
            validationRunId: data.validationRunId,
            stageKey: data.stageKey,
            status: data.status,
            reasonCodes: data.reasonCodes ?? [],
            resultData: (data.resultData ?? null) as Prisma.InputJsonValue,
            retryCount: data.retryCount,
            durationMs: data.durationMs,
            failureMessage: data.failureMessage ?? null,
          },
        });
        return {
          id: result.id,
          validationRunId: result.validationRunId,
          stageKey: result.stageKey as StageKey,
          status: result.status,
          signals: [],
          reasonCodes: (result.reasonCodes ?? []) as ReasonCode[],
          ...(result.resultData ? { resultData: result.resultData as Record<string, unknown> } : {}),
          retryCount: result.retryCount,
          durationMs: result.durationMs,
          ...(result.failureMessage ? { failureMessage: result.failureMessage } : {}),
          createdAt: result.createdAt,
        };
      },
      getByValidationRunId: async (runId: string) => {
        const results = await db.stageResult.findMany({
          where: { validationRunId: runId },
        });
        return results.map((r) => ({
          id: r.id,
          validationRunId: r.validationRunId,
          stageKey: r.stageKey as StageKey,
          status: r.status,
          signals: [],
          reasonCodes: (r.reasonCodes ?? []) as ReasonCode[],
          ...(r.resultData ? { resultData: r.resultData as Record<string, unknown> } : {}),
          retryCount: r.retryCount,
          durationMs: r.durationMs,
          ...(r.failureMessage ? { failureMessage: r.failureMessage } : {}),
          createdAt: r.createdAt,
        }));
      },
    };
  }

  // Below: plain query helpers for the staff review queue (list + stage detail +
  // decide). These are NOT part of the SubmissionRepository/ValidationRunRepository/
  // StageResultRepository interfaces consumed by TrustEngineService — they're
  // read/write projections used directly by the controller, so adding them here
  // doesn't touch the shared @fliptrybe/service-trust-engine package or its
  // pipeline/arbiter logic.

  async listSubmissions(params: {
    workspaceId: string;
    status?: string;
    assetClass?: string;
    take?: number;
  }) {
    const db = this.prismaService.client;
    const submissions = await db.assetSubmission.findMany({
      where: {
        workspaceId: params.workspaceId,
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.assetClass ? { assetClass: params.assetClass as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 100,
      include: {
        validationRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        moderationQueue: true,
      },
    });

    return submissions.map((submission) => {
      const latestRun = submission.validationRuns[0];
      return {
        id: submission.id,
        workspaceId: submission.workspaceId,
        userId: submission.userId,
        assetClass: submission.assetClass,
        status: submission.status,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        latestVerdict: latestRun?.verdict ?? null,
        latestVerdictReasons: latestRun?.verdictReasons ?? [],
        moderation: submission.moderationQueue
          ? {
              status: submission.moderationQueue.status,
              decision: submission.moderationQueue.decision,
              decisionReason: submission.moderationQueue.decisionReason,
              reviewerUserId: submission.moderationQueue.reviewerUserId,
              reviewedAt: submission.moderationQueue.reviewedAt,
            }
          : null,
      };
    });
  }

  async getSubmissionStages(submissionId: string) {
    const db = this.prismaService.client;
    const latestRun = await db.validationRun.findFirst({
      where: { submissionId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRun) {
      return { submissionId, validationRun: null, stages: [] };
    }

    const stageResults = await db.stageResult.findMany({
      where: { validationRunId: latestRun.id },
      orderBy: { createdAt: 'asc' },
    });

    return {
      submissionId,
      validationRun: {
        id: latestRun.id,
        verdict: latestRun.verdict ?? 'REVIEW',
        verdictReasons: latestRun.verdictReasons ?? [],
        verdictExplained: latestRun.verdictExplained ?? '',
        fraudScore: latestRun.fraudScore ?? 0,
        trustScore: latestRun.trustScore ?? 0,
        finalScore: latestRun.finalScore ?? 0,
        createdAt: latestRun.createdAt,
      },
      stages: stageResults.map((stage) => ({
        stageKey: stage.stageKey,
        status: stage.status,
        reasonCodes: stage.reasonCodes ?? [],
        durationMs: stage.durationMs,
        retryCount: stage.retryCount,
        ...(stage.failureMessage ? { failureMessage: stage.failureMessage } : {}),
        createdAt: stage.createdAt,
      })),
    };
  }

  // Human-decision layer on top of the read-only staff review queue. Nothing else in
  // this codebase writes to ModerationQueue today — this method is both the write
  // path for a staff decision AND the thing that first populates a ModerationQueue
  // row for a submission (via upsert), since no queue consumer exists yet to
  // pre-create rows when a submission lands in REVIEW status. Deliberately does NOT
  // touch pipeline/stage/arbiter logic in services/trust-engine — it only flips
  // AssetSubmission.status and records the decision, using exactly the existing
  // SubmissionStatus enum values (ACCEPTED / REJECTED).
  async decideModeration(params: {
    submissionId: string;
    decision: 'APPROVE' | 'REJECT';
    reviewerUserId: string;
    decisionReason?: string;
  }) {
    const db = this.prismaService.client;

    const submission = await db.assetSubmission.findUnique({
      where: { id: params.submissionId },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }
    if (submission.status !== 'REVIEW') {
      throw new BadRequestException(
        `Submission is not awaiting moderation (current status: ${submission.status}).`,
      );
    }

    const existingQueueRow = await db.moderationQueue.findUnique({
      where: { submissionId: params.submissionId },
    });
    if (existingQueueRow?.decision) {
      throw new BadRequestException(
        `Moderation decision already recorded (${existingQueueRow.decision}).`,
      );
    }

    const latestRun = await db.validationRun.findFirst({
      where: { submissionId: params.submissionId },
      orderBy: { createdAt: 'desc' },
    });

    const newSubmissionStatus = params.decision === 'APPROVE' ? 'ACCEPTED' : 'REJECTED';
    const newQueueStatus = params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const reviewedAt = new Date();

    const [queueRow] = await db.$transaction([
      db.moderationQueue.upsert({
        where: { submissionId: params.submissionId },
        create: {
          submissionId: params.submissionId,
          validationRunId: latestRun?.id ?? null,
          reason: 'VERDICT_REVIEW',
          status: newQueueStatus,
          decision: params.decision,
          decisionReason: params.decisionReason ?? null,
          reviewerUserId: params.reviewerUserId,
          reviewedAt,
        },
        update: {
          status: newQueueStatus,
          decision: params.decision,
          decisionReason: params.decisionReason ?? null,
          reviewerUserId: params.reviewerUserId,
          reviewedAt,
        },
      }),
      db.assetSubmission.update({
        where: { id: params.submissionId },
        data: { status: newSubmissionStatus },
      }),
    ]);

    return {
      submissionId: params.submissionId,
      status: newSubmissionStatus,
      moderation: {
        status: queueRow.status,
        decision: queueRow.decision,
        decisionReason: queueRow.decisionReason,
        reviewerUserId: queueRow.reviewerUserId,
        reviewedAt: queueRow.reviewedAt,
      },
    };
  }
}
