import { Body, Controller, Get, Inject, Param, Post, Query, Req, UnauthorizedException } from "@nestjs/common";

import { RequirePermissions } from "./authorization.decorators";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "./request-context";
import { AdminCommandCenterService } from "./admin-command-center.service";

@Controller("admin/command-center")
@RequirePermissions("admin:access")
export class AdminCommandCenterController {
  constructor(
    @Inject(AdminCommandCenterService)
    private readonly commandCenter: AdminCommandCenterService
  ) {}

  @Get("overview")
  overview() {
    return this.commandCenter.getOverview();
  }

  @Get("alerts")
  alerts() {
    return this.commandCenter.getAlerts();
  }

  @Get("fulfilment")
  fulfilment(@Query("days") days?: string) {
    return this.commandCenter.getFulfilmentOverview(days ? Number(days) : 7);
  }

  @Get("fulfilment/queue")
  fulfilmentQueue(
    @Query("domain") domain?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.commandCenter.listFulfilment({
      ...(domain ? { domain: domain as never } : {}),
      ...(status ? { status } : {}),
      ...(limit ? { limit: Number(limit) } : {})
    });
  }

  @Post("fulfilment/:domain/:id/reconciliation")
  openFulfilmentReconciliation(
    @Param("domain") domain: string,
    @Param("id") resourceId: string,
    @Body()
    body: {
      resourceType: string;
      kind: string;
      providerName: string;
      providerDomain: string;
      workspaceId?: string | null;
      reason: string;
    },
    @Req() request: WorkspaceContextRequest
  ) {
    const context = authenticatedContextFromHeaders(request.headers);
    if (!context.userId) {
      throw new UnauthorizedException("Authenticated administrator context is required.");
    }
    return this.commandCenter.openFulfilmentReconciliation(
      {
        domain: domain as never,
        resourceType: body.resourceType,
        resourceId,
        kind: body.kind,
        providerName: body.providerName,
        providerDomain: body.providerDomain as never,
        ...(body.workspaceId !== undefined ? { workspaceId: body.workspaceId } : {}),
        reason: body.reason
      },
      context.userId
    );
  }
}