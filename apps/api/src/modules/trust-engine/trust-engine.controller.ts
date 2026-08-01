import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TrustEngineService } from '@fliptrybe/service-trust-engine';

@Controller('trust-engine')
export class TrustEngineController {
  constructor(private trustEngine: TrustEngineService) {}

  @Post('submissions')
  async createSubmission(
    @Body()
    body: {
      workspaceId: string;
      userId: string;
      assetClass: 'GIFT_CARD' | 'AIRTIME_PIN' | 'VOUCHER';
      mediaAssetId: string;
      submissionProfile: Record<string, unknown>;
    },
  ) {
    const submissionId = await this.trustEngine.createSubmission(body);
    return { submissionId };
  }

  @Get('submissions/:submissionId')
  async getSubmissionStatus(@Param('submissionId') submissionId: string) {
    const status = await this.trustEngine.getSubmissionStatus(submissionId);
    return status;
  }

  @Post('submissions/:submissionId/process')
  async processSubmission(@Param('submissionId') submissionId: string) {
    const status = await this.trustEngine.getSubmissionStatus(submissionId);
    if (!status) {
      return { error: 'Submission not found' };
    }

    const verdict = await this.trustEngine.processSubmission({
      submissionId: status.id,
      workspaceId: status.workspaceId,
      userId: status.userId,
      assetClass: status.assetClass as any,
      submissionProfile: status.submissionProfile as any,
      mediaAssetId: status.mediaAssetId,
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
        enabledAssetClasses: ['GIFT_CARD', 'AIRTIME_PIN', 'VOUCHER'],
        enabledBrands: [],
      },
      configVersion: 1,
      pipelineVersion: 1,
    });

    return { verdict };
  }
}
