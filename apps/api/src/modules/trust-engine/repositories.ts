import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  SubmissionRow,
  ValidationRunRow,
  StageResultRow,
  CreateSubmissionInput,
  CreateValidationRunInput,
  CreateStageResultInput,
} from '@fliptrybe/service-trust-engine';

@Injectable()
export class TrustEngineRepositories {
  readonly submissionRepo: SubmissionRepository;
  readonly validationRunRepo: ValidationRunRepository;
  readonly stageResultRepo: StageResultRepository;

  constructor(private prisma: PrismaService) {
    this.submissionRepo = {
      create: async (data: CreateSubmissionInput) => {
        const submission = await this.prisma.assetSubmission.create({
          data: {
            id: data.id,
            workspaceId: data.workspaceId,
            userId: data.userId,
            assetClass: data.assetClass,
            mediaAssetId: data.mediaAssetId,
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
          mediaAssetId: submission.mediaAssetId,
          submissionProfile: submission.submissionProfile,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        };
      },
      getById: async (submissionId: string) => {
        const submission = await this.prisma.assetSubmission.findUnique({
          where: { id: submissionId },
        });
        if (!submission) return null;
        return {
          id: submission.id,
          workspaceId: submission.workspaceId,
          userId: submission.userId,
          assetClass: submission.assetClass,
          status: submission.status,
          mediaAssetId: submission.mediaAssetId,
          submissionProfile: submission.submissionProfile,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        };
      },
      updateStatus: async (submissionId: string, status: any) => {
        await this.prisma.assetSubmission.update({
          where: { id: submissionId },
          data: { status },
        });
      },
    };

    this.validationRunRepo = {
      create: async (data: CreateValidationRunInput) => {
        const run = await this.prisma.validationRun.create({
          data: {
            id: data.id,
            submissionId: data.submissionId,
            configVersion: data.configVersion,
            pipelineVersion: data.pipelineVersion,
            idempotencyKey: data.idempotencyKey,
            verdict: data.verdict || 'REVIEW',
            verdictReasons: data.verdictReasons || [],
            verdictExplained: data.verdictExplained || '',
            fraudScore: data.fraudScore || 0,
            trustScore: data.trustScore || 0,
            finalScore: data.finalScore || 0,
          },
        });
        return {
          id: run.id,
          submissionId: run.submissionId,
          configVersion: run.configVersion,
          pipelineVersion: run.pipelineVersion,
          idempotencyKey: run.idempotencyKey,
          verdict: run.verdict,
          verdictReasons: run.verdictReasons,
          verdictExplained: run.verdictExplained,
          fraudScore: run.fraudScore,
          trustScore: run.trustScore,
          finalScore: run.finalScore,
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
        const run = await this.prisma.validationRun.findUnique({
          where: { id: runId },
        });
        if (!run) return null;
        return {
          id: run.id,
          submissionId: run.submissionId,
          configVersion: run.configVersion,
          pipelineVersion: run.pipelineVersion,
          idempotencyKey: run.idempotencyKey,
          verdict: run.verdict,
          verdictReasons: run.verdictReasons,
          verdictExplained: run.verdictExplained,
          fraudScore: run.fraudScore,
          trustScore: run.trustScore,
          finalScore: run.finalScore,
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
        const run = await this.prisma.validationRun.findFirst({
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
          verdict: run.verdict,
          verdictReasons: run.verdictReasons,
          verdictExplained: run.verdictExplained,
          fraudScore: run.fraudScore,
          trustScore: run.trustScore,
          finalScore: run.finalScore,
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
        const result = await this.prisma.stageValidationResult.create({
          data: {
            id: data.id,
            validationRunId: data.validationRunId,
            stageKey: data.stageKey,
            status: data.status,
            signals: data.signals as any,
            reasonCodes: data.reasonCodes,
            resultData: data.resultData as any,
            retryCount: data.retryCount,
            durationMs: data.durationMs,
            failureMessage: data.failureMessage,
          },
        });
        return {
          id: result.id,
          validationRunId: result.validationRunId,
          stageKey: result.stageKey,
          status: result.status,
          signals: result.signals,
          reasonCodes: result.reasonCodes,
          resultData: result.resultData,
          retryCount: result.retryCount,
          durationMs: result.durationMs,
          failureMessage: result.failureMessage,
          createdAt: result.createdAt,
        };
      },
      getByValidationRunId: async (runId: string) => {
        const results = await this.prisma.stageValidationResult.findMany({
          where: { validationRunId: runId },
        });
        return results.map((r) => ({
          id: r.id,
          validationRunId: r.validationRunId,
          stageKey: r.stageKey,
          status: r.status,
          signals: r.signals,
          reasonCodes: r.reasonCodes,
          resultData: r.resultData,
          retryCount: r.retryCount,
          durationMs: r.durationMs,
          failureMessage: r.failureMessage,
          createdAt: r.createdAt,
        }));
      },
    };
  }
}
