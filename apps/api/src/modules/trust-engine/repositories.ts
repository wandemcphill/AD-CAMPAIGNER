import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type {
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  CreateSubmissionInput,
  CreateValidationRunInput,
  CreateStageResultInput,
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
      updateStatus: async (submissionId: string, status: any) => {
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
    };

    this.stageResultRepo = {
      create: async (data: CreateStageResultInput) => {
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
          resultData: result.resultData,
          retryCount: result.retryCount,
          durationMs: result.durationMs,
          failureMessage: result.failureMessage ?? undefined,
          createdAt: result.createdAt,
        } as any;
      },
      getByValidationRunId: async (runId: string) => {
        const results = await db.stageResult.findMany({
          where: { validationRunId: runId },
        });
        return results.map((r: any) => ({
          id: r.id,
          validationRunId: r.validationRunId,
          stageKey: r.stageKey,
          status: r.status,
          signals: [],
          reasonCodes: (r.reasonCodes as any) ?? [],
          resultData: r.resultData,
          retryCount: r.retryCount,
          durationMs: r.durationMs,
          failureMessage: r.failureMessage ?? undefined,
          createdAt: r.createdAt,
        })) as any;
      },
    };
  }
}
