import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { TrustEngineService } from '@fliptrybe/service-trust-engine';
import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest,
} from '../request-context';
import { RequirePermissions } from '../authorization.decorators';
import { RequireFeature } from '../feature-flag.decorators';
import { QueueProducerService } from '../queue-producer.service';
import { CreateSubmissionDto } from './dtos';

// trustEngine is off in packages/feature-flags (7-stage validation pipeline,
// not yet wired into a queue consumer end-to-end) — same class of gap as
// financial-products before it got @RequireFeature: no gate here meant the
// routes were reachable despite the flag, just with nothing consuming the
// queued validation job on the other end.
@Controller('trust-engine')
@RequirePermissions('analytics:read')
@RequireFeature('trustEngine')
export class TrustEngineController {
  constructor(
    private readonly trustEngine: TrustEngineService,
    private readonly queue: QueueProducerService,
  ) {}

  @Post('submissions')
  @RequirePermissions('campaign:create')
  async createSubmission(
    @Body() body: CreateSubmissionDto,
    @Req() request: WorkspaceContextRequest,
  ) {
    const { userId, workspaceId } = workspaceContextFromRequest(request);

    const submissionId = await this.trustEngine.createSubmission({
      workspaceId,
      userId,
      assetClass: body.assetClass,
      ...(body.mediaAssetId ? { mediaAssetId: body.mediaAssetId } : {}),
      submissionProfile: body.submissionProfile,
    });

    await this.queue.enqueueTrustEngineValidation(submissionId);

    return {
      submissionId,
      status: 'PENDING',
      message: 'Submission received and queued for validation.',
    };
  }

  @Get('submissions/:submissionId')
  async getSubmissionStatus(@Param('submissionId') submissionId: string) {
    return this.trustEngine.getSubmissionStatus(submissionId);
  }
}
