import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { Public, RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import type {
  AddRewardTaskDto,
  AdminResolveCompletionDto,
  AdminResolveEntitlementDto,
  CreateRewardCampaignDto,
  GenerateQrCodesDto,
  RewardCampaignQueryDto,
  ScanQrCodeDto,
  SubmitTaskCompletionDto,
  UpdateRewardCampaignDto
} from "./rewards.dtos";
import { RewardsService } from "./rewards.service";

@Controller("rewards")
@RequireFeature("rewards")
@RequirePermissions("analytics:read")
export class RewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  @Post("campaigns")
  @RequirePermissions("campaign:create")
  createCampaign(@Body() body: CreateRewardCampaignDto, @Req() request: WorkspaceContextRequest) {
    return this.rewards.createCampaign(workspaceContextFromRequest(request), body);
  }

  @Get("campaigns")
  @RequirePermissions("analytics:read")
  listCampaigns(@Query() query: RewardCampaignQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.rewards.listCampaigns(workspaceContextFromRequest(request), query);
  }

  @Get("campaigns/:id")
  @RequirePermissions("analytics:read")
  getCampaign(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.rewards.getCampaign(workspaceContextFromRequest(request), id);
  }

  @Patch("campaigns/:id")
  @RequirePermissions("campaign:create")
  updateCampaign(
    @Param("id") id: string,
    @Body() body: UpdateRewardCampaignDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.rewards.updateCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post("campaigns/:id/tasks")
  @RequirePermissions("campaign:create")
  addTask(
    @Param("id") id: string,
    @Body() body: AddRewardTaskDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.rewards.addTask(workspaceContextFromRequest(request), id, body);
  }

  @Post("tasks/:taskId/complete")
  @RequirePermissions("campaign:create")
  submitTaskCompletion(
    @Param("taskId") taskId: string,
    @Body() body: SubmitTaskCompletionDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.rewards.submitTaskCompletion(workspaceContextFromRequest(request), taskId, body);
  }

  @Post("qr/scan")
  @RequirePermissions("campaign:create")
  scanQrCode(@Body() body: ScanQrCodeDto, @Req() request: WorkspaceContextRequest) {
    return this.rewards.scanQrCode(workspaceContextFromRequest(request), body);
  }

  @Get("campaigns/:id/leaderboard")
  @Public()
  getLeaderboard(
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.rewards.getLeaderboard(id, Number(page) || 1, Number(limit) || 50);
  }

  @Get("my/progress")
  getMyProgress(@Req() request: WorkspaceContextRequest) {
    return this.rewards.getMyProgress(workspaceContextFromRequest(request));
  }

  @Post("webhooks/tiktok")
  @Public()
  handleTikTokWebhook(
    @Req() request: WorkspaceContextRequest,
    @Headers("x-tiktok-signature") signature: string | undefined
  ) {
    const req = request as unknown as { rawBody?: Buffer; body?: unknown };
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.rewards.handleTikTokVideoWebhook(raw, signature);
  }
}

@Controller("admin/rewards")
@RequireFeature("rewards", "rewardsAdmin")
@RequirePermissions("admin:access")
export class AdminRewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  @Get("campaigns")
  listCampaigns(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.rewards.adminListCampaigns(Number(page) || 1, Number(limit) || 20);
  }

  @Get("review-queue")
  getReviewQueue(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.rewards.adminGetReviewQueue(Number(page) || 1, Number(limit) || 20);
  }

  @Post("completions/:id/resolve")
  resolveCompletion(
    @Param("id") id: string,
    @Body() body: AdminResolveCompletionDto,
    @Req() request: WorkspaceContextRequest
  ) {
    const ctx = workspaceContextFromRequest(request);
    return this.rewards.adminResolveCompletion(id, body, ctx.userId);
  }

  @Post("entitlements/:id/resolve")
  resolveEntitlement(
    @Param("id") id: string,
    @Body() body: AdminResolveEntitlementDto
  ) {
    return this.rewards.adminResolveEntitlement(id, body);
  }

  @Post("campaigns/:id/qr-codes")
  generateQrCodes(
    @Param("id") id: string,
    @Body() body: GenerateQrCodesDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.rewards.generateQrCodes(workspaceContextFromRequest(request), id, body);
  }

  @Get("campaigns/:id/qr-codes")
  listQrCodes(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.rewards.listQrCodes(workspaceContextFromRequest(request), id);
  }
}
