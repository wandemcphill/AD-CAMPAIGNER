import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import { Public, RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { ApplyAsAgencyDto, ApplyAsCreatorDto, ReviewApplicationDto } from "./marketplace.dtos";
import { MarketplaceService } from "./marketplace.service";

@Controller("marketplace")
@Public()
export class MarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Get("agencies")
  agencies(@Query("specialty") specialty?: string) {
    return this.marketplace.listAgencies(specialty === undefined ? {} : { specialty });
  }

  @Get("creators")
  creators(@Query("niche") niche?: string) {
    return this.marketplace.listCreators(niche === undefined ? {} : { niche });
  }
}

@Controller("marketplace/applications")
@RequirePermissions("analytics:read")
export class MarketplaceApplicationsController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Get("mine")
  mine(@Req() request: WorkspaceContextRequest) {
    return this.marketplace.myApplications(workspaceContextFromRequest(request));
  }

  @Post("agency")
  @RequirePermissions("campaign:create")
  applyAsAgency(@Body() body: ApplyAsAgencyDto, @Req() request: WorkspaceContextRequest) {
    return this.marketplace.applyAsAgency(body, workspaceContextFromRequest(request));
  }

  @Post("creator")
  @RequirePermissions("campaign:create")
  applyAsCreator(@Body() body: ApplyAsCreatorDto, @Req() request: WorkspaceContextRequest) {
    return this.marketplace.applyAsCreator(body, workspaceContextFromRequest(request));
  }
}

@Controller("admin/marketplace")
@RequirePermissions("admin:access")
export class AdminMarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Get("applications")
  applications(
    @Query("status") status: string | undefined,
    @Query("type") type: "agency" | "creator" | undefined,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.marketplace.adminListApplications(
      { ...(status === undefined ? {} : { status }), ...(type === undefined ? {} : { type }) },
      workspaceContextFromRequest(request)
    );
  }

  @Patch("applications/agency/:id")
  reviewAgencyApplication(
    @Param("id") id: string,
    @Body() body: ReviewApplicationDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.marketplace.adminReviewAgencyApplication(
      id,
      body.decision,
      body.rejectionReason,
      workspaceContextFromRequest(request)
    );
  }

  @Patch("applications/creator/:id")
  reviewCreatorApplication(
    @Param("id") id: string,
    @Body() body: ReviewApplicationDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.marketplace.adminReviewCreatorApplication(
      id,
      body.decision,
      body.rejectionReason,
      workspaceContextFromRequest(request)
    );
  }

  @Get("agencies")
  agencies(@Req() request: WorkspaceContextRequest) {
    return this.marketplace.adminListAgencies(workspaceContextFromRequest(request));
  }

  @Get("creators")
  creators(@Req() request: WorkspaceContextRequest) {
    return this.marketplace.adminListCreators(workspaceContextFromRequest(request));
  }

  @Patch("agencies/:id/active")
  setAgencyActive(
    @Param("id") id: string,
    @Body() body: { isActive: boolean },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.marketplace.adminSetAgencyActive(id, body.isActive, workspaceContextFromRequest(request));
  }

  @Patch("creators/:id/active")
  setCreatorActive(
    @Param("id") id: string,
    @Body() body: { isActive: boolean },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.marketplace.adminSetCreatorActive(id, body.isActive, workspaceContextFromRequest(request));
  }
}
