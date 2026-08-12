import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { TrustEngineService } from '@fliptrybe/service-trust-engine';
import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest,
} from '../request-context';
import { RequirePermissions } from '../authorization.decorators';
import { RequireFeature } from '../feature-flag.decorators';
import { QueueProducerService } from '../queue-producer.service';
import { CreateSubmissionDto, ListSubmissionsQueryDto, ModerateSubmissionDto } from './dtos';
import { TrustEngineRepositories } from './repositories';

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
    private readonly repositories: TrustEngineRepositories,
  ) {}

  // Staff review queue (list). Scoped to the caller's workspace, same as every other
  // route on this controller.
  @Get('submissions')
  async listSubmissions(
    @Query() query: ListSubmissionsQueryDto,
    @Req() request: WorkspaceContextRequest,
  ) {
    const { workspaceId } = workspaceContextFromRequest(request);
    return this.repositories.listSubmissions({
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assetClass ? { assetClass: query.assetClass } : {}),
    });
  }

  // Per-stage breakdown of the latest validation run for a submission — what the
  // review UI renders as the 7-stage timeline. Read-only projection over
  // ValidationRun + StageResult; does not touch pipeline/arbiter logic.
  @Get('submissions/:submissionId/stages')
  async getSubmissionStages(@Param('submissionId') submissionId: string) {
    return this.repositories.getSubmissionStages(submissionId);
  }

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

  // Human-decision layer on top of the staff review queue. This is a standalone
  // decide endpoint rather than routing through the unified ApprovalsService/
  // ApprovalRequest engine (see apps/api/src/modules/approvals/approvals.service.ts):
  // ModerationQueue is a 1:1 domain table keyed off AssetSubmission with its own
  // reviewer/decision/reason columns already in the schema, so there is nothing
  // generic to gain by shadowing it with an ApprovalRequest row — that engine exists
  // for actions that don't already own their state (Digital Access refunds today;
  // campaign/KYC approvals are explicitly NOT unified into it either, per
  // approvals.controller.ts's scope note). Gated behind a dedicated write permission
  // since the class-level default (`analytics:read`) is read-only.
  @Post('submissions/:submissionId/moderate')
  @RequirePermissions('trust_engine:moderate')
  async moderateSubmission(
    @Param('submissionId') submissionId: string,
    @Body() body: ModerateSubmissionDto,
    @Req() request: WorkspaceContextRequest,
  ) {
    const { userId } = workspaceContextFromRequest(request);
    return this.repositories.decideModeration({
      submissionId,
      decision: body.decision,
      reviewerUserId: userId,
      ...(body.reason ? { decisionReason: body.reason } : {}),
    });
  }
}
