import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { ApprovalDecisionDto, ApprovalQueueListQueryDto } from "./approvals.dtos";
import { ApprovalsService } from "./approvals.service";

/**
 * Unified Approvals Queue — a thin read/decide surface over ApprovalsService's
 * generic ApprovalRequest engine.
 *
 * Campaign launch approvals (PATCH admin/campaign-ops/campaigns/:id/status in
 * platform.controllers.ts) and ad-account KYC approvals (PATCH ad-accounts/:id/kyc)
 * now ALSO create ApprovalRequest rows (entityType "ads" / "kyc") so they show up
 * here — see ManagedAdsService.changeCampaignStatus / reviewAdAccountKyc /
 * createAdAccount. Those old endpoints remain live as direct admin overrides (lower
 * risk than deprecating working functionality); deciding here uses
 * `decideAndExecute`, which runs whatever executor ManagedAdsService registered for
 * that entityType so the decision actually lands on the campaign / ad account, not
 * just on this row. If staff instead act through the old endpoint,
 * ApprovalsService.syncExternalDecision keeps this row from being left stuck PENDING.
 */
@Controller("approvals")
@RequirePermissions("campaign:approve")
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
    return this.approvals.decideAndExecute(id, {
      decidedByUserId: context.userId,
      approve: Boolean(body.approve),
      ...(body.note ? { note: body.note } : {})
    });
  }
}
