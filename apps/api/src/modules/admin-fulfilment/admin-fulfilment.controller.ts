import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "../request-context";
import { AdminFulfilmentService } from "./admin-fulfilment.service";

@Controller("admin/fulfilment")
@RequirePermissions("admin:access")
export class AdminFulfilmentController {
  constructor(private readonly fulfilment: AdminFulfilmentService) {}

  @Get("overview")
  overview(@Query("days") days?: string) {
    return this.fulfilment.overview(days ? Number(days) : 7);
  }

  @Get("queue")
  queue(
    @Query("domain") domain?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.fulfilment.listQueue({
      ...(domain ? { domain: domain as never } : {}),
      ...(status ? { status } : {}),
      ...(limit ? { limit: Number(limit) } : {})
    });
  }

  @Post("/:domain/:id/reconciliation")
  openReconciliation(
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
    return this.fulfilment.openReconciliation(
      body.resourceType,
      resourceId,
      body.kind,
      body.providerName,
      body.providerDomain as never,
      body.workspaceId ?? null,
      `[${domain}] ${body.reason}`,
      context.userId
    );
  }
}
