import { Injectable } from '@nestjs/common';
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
}
