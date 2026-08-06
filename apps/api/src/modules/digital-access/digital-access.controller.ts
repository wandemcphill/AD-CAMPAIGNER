import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import {
  metadataContextFromRequest,
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { Public, RequirePermissions } from "../authorization.decorators";
import { toEnvelope } from "../grace-window";
import type {
  CreateDigitalAccessRequestDto,
  DigitalAccessAssignDto,
  DigitalAccessCategoryDto,
  DigitalAccessListQueryDto,
  DigitalAccessPlanDto,
  DigitalAccessRequestQueryDto,
  DigitalAccessServiceDto,
  DigitalAccessStatusDto
} from "./digital-access.dtos";
import { DigitalAccessHubService } from "./digital-access.service";

@Controller("digital-access")
@RequirePermissions("analytics:read")
export class DigitalAccessController {
  constructor(@Inject(DigitalAccessHubService) private readonly hub: DigitalAccessHubService) {}

  @Get("categories")
  @Public()
  categories() {
    return this.hub.listCategories();
  }

  @Get("services")
  @Public()
  services(@Query() query: DigitalAccessListQueryDto) {
    return this.hub.listServices(query);
  }

  @Get("services/:slug")
  @Public()
  service(@Param("slug") slug: string) {
    return this.hub.getService(slug);
  }

  @Get("requests")
  requests(@Req() request: WorkspaceContextRequest) {
    return this.hub.listRequests(workspaceContextFromRequest(request));
  }

  @Get("requests/:id")
  request(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.hub.getRequest(id, workspaceContextFromRequest(request));
  }

  @Post("requests")
  @RequirePermissions("campaign:create")
  async createRequest(
    @Body() body: CreateDigitalAccessRequestDto,
    @Req() request: WorkspaceContextRequest
  ) {
    const result = await this.hub.createRequest(body, {
      ...workspaceContextFromRequest(request),
      ...metadataContextFromRequest(request)
    });
    return toEnvelope({
      resourceId: result.request.id,
      data: result,
      toStatus: ({ request: r }) =>
        r.status === "fulfilled"
          ? "active"
          : r.status === "failed" || r.status === "cancelled"
            ? "failed"
            : "pending"
    });
  }
}

@Controller("admin/digital-access")
@RequirePermissions("admin:access")
export class AdminDigitalAccessController {
  constructor(@Inject(DigitalAccessHubService) private readonly hub: DigitalAccessHubService) {}

  @Get("overview")
  overview(@Req() request: WorkspaceContextRequest) {
    return this.hub.getAdminOverview(workspaceContextFromRequest(request));
  }

  @Get("categories")
  categories(@Req() request: WorkspaceContextRequest) {
    return this.hub.listAdminCategories(workspaceContextFromRequest(request));
  }

  @Post("categories")
  createCategory(@Body() body: DigitalAccessCategoryDto, @Req() request: WorkspaceContextRequest) {
    return this.hub.createCategory(body, workspaceContextFromRequest(request));
  }

  @Patch("categories/:id")
  updateCategory(
    @Param("id") id: string,
    @Body() body: DigitalAccessCategoryDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.updateCategory(id, body, workspaceContextFromRequest(request));
  }

  @Get("services")
  services(@Query() query: DigitalAccessListQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.hub.listAdminServices(query, workspaceContextFromRequest(request));
  }

  @Post("services")
  createService(@Body() body: DigitalAccessServiceDto, @Req() request: WorkspaceContextRequest) {
    return this.hub.createService(body, workspaceContextFromRequest(request));
  }

  @Patch("services/:id")
  updateService(
    @Param("id") id: string,
    @Body() body: DigitalAccessServiceDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.updateService(id, body, workspaceContextFromRequest(request));
  }

  @Get("plans")
  plans(@Req() request: WorkspaceContextRequest, @Query("serviceId") serviceId?: string) {
    return this.hub.listAdminPlans(workspaceContextFromRequest(request), serviceId);
  }

  @Post("plans")
  createPlan(@Body() body: DigitalAccessPlanDto, @Req() request: WorkspaceContextRequest) {
    return this.hub.createPlan(body, workspaceContextFromRequest(request));
  }

  @Patch("plans/:id")
  updatePlan(
    @Param("id") id: string,
    @Body() body: DigitalAccessPlanDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.updatePlan(id, body, workspaceContextFromRequest(request));
  }

  @Get("requests")
  requests(@Query() query: DigitalAccessRequestQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.hub.listAdminRequests(query, workspaceContextFromRequest(request));
  }

  @Patch("requests/:id/status")
  status(
    @Param("id") id: string,
    @Body() body: DigitalAccessStatusDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.updateRequestStatus(id, body.status, workspaceContextFromRequest(request));
  }

  // A refund-triggering status transition doesn't execute inline — updateRequestStatus
  // above returns { pending: true, approvalRequestId } instead. A second admin (not the
  // one who requested it — enforced in ApprovalsService) must call one of these.
  @Post("approvals/:id/approve")
  approveRefund(
    @Param("id") id: string,
    @Body() body: { note?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.approveRefund(id, workspaceContextFromRequest(request), body.note);
  }

  @Post("approvals/:id/reject")
  rejectRefund(
    @Param("id") id: string,
    @Body() body: { note?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.rejectRefund(id, workspaceContextFromRequest(request), body.note);
  }

  @Patch("requests/:id/assign")
  assign(
    @Param("id") id: string,
    @Body() body: DigitalAccessAssignDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.hub.assignRequest(
      id,
      body.assignedTo ?? null,
      workspaceContextFromRequest(request)
    );
  }
}
