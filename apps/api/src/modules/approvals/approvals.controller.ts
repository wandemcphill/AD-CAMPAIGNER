import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { ApprovalDecisionDto, ApprovalQueueListQueryDto } from "./approvals.dtos";
import { ApprovalsService } from "./approvals.service";

/**
 * Unified Approvals Queue — a thin read/decide surface over ApprovalsService's
 * generic ApprovalRequest engine.
 *
 * IMPORTANT SCOPE NOTE: campaign launch approvals (PATCH
 * admin/campaign-ops/campaigns/:id/status in platform.controllers.ts) and ad-account
 * KYC approvals (PATCH ad-accounts/:id/kyc) do NOT go through ApprovalRequest today —
 * they're separate ad-hoc endpoints with their own status columns. This controller
 * only surfaces whatever domains actually call ApprovalsService.request() (currently
 * Digital Access refunds/reversals). Unifying campaign/KYC approval into this queue is
 * a deliberately deferred follow-up, not something this controller papers over.
 */
@Controller("approvals")
@RequirePermissions("admin:access", "campaign:approve")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@Query() query: ApprovalQueueListQueryDto, @Req() request: WorkspaceContextRequest) {
    const context = workspaceContextFromRequest(request);
    return this.approvals.list({
      workspaceId: context.workspaceId,
      status: query.status ?? "all",
      type: query.type ?? "all"
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.approvals.get(id);
  }

  @Post(":id/decide")
  decide(
    @Param("id") id: string,
    @Body() body: ApprovalDecisionDto,
    @Req() request: WorkspaceContextRequest
  ) {
    const context = workspaceContextFromRequest(request);
    return this.approvals.decide(id, {
      decidedByUserId: context.userId,
      approve: Boolean(body.approve),
      ...(body.note ? { note: body.note } : {})
    });
  }
}
