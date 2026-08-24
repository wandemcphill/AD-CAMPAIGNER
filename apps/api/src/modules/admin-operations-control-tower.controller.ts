import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";

import { RequirePermissions } from "./authorization.decorators";
import { AdminOperationsControlTowerService } from "./admin-operations-control-tower.service";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "./request-context";

@Controller("admin/operations-control-tower")
@RequirePermissions("admin:access")
export class AdminOperationsControlTowerController {
  constructor(private readonly operations: AdminOperationsControlTowerService) {}

  @Get("overview")
  overview() {
    return this.operations.overview();
  }

  @Get("queue")
  queue() {
    return this.operations.queue();
  }

  @Post("fulfilment/:domain/:id/reconcile")
  reconcile(
    @Param("domain") domain: string,
    @Param("id") resourceId: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    const context = authenticatedContextFromHeaders(request.headers);
    if (!context.userId) {
      throw new UnauthorizedException("Authenticated administrator context is required.");
    }
    return this.operations.reconcileFulfilment(domain, resourceId, body.reason ?? "", context.userId);
  }
}
