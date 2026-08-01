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
    if (!status || status.status === 'PENDING') {
      return { error: 'Submission not found' };
    }

    return { verdict: status.verdict || 'REVIEW', reasons: status.reasons };
  }
}
