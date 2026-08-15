import { Body, Controller, Get, Inject, Param, Patch, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "../request-context";
import { FinancialReconciliationService } from "./financial-reconciliation.service";

type ReconciliationStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "WONT_FIX";

/**
 * Deliberately registered outside the feature-flag gate on the rest of
 * FinancialProductsModule: an exception opened while a vertical was live still
 * has to be reviewable after that vertical is switched off, and an unresolved
 * money divergence is exactly the thing an operator must never lose sight of.
 */
@Controller("admin/reconciliation")
@RequirePermissions("admin:access")
export class FinancialReconciliationController {
  constructor(
    @Inject(FinancialReconciliationService)
    private readonly reconciliation: FinancialReconciliationService
  ) {}

  @Get("exceptions")
  list(
    @Query("status") status?: ReconciliationStatus,
    @Query("providerName") providerName?: string,
    @Query("workspaceId") workspaceId?: string,
    @Query("limit") limit?: string
  ) {
    return this.reconciliation.list({
      ...(status ? { status } : {}),
      ...(providerName ? { providerName } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(limit ? { limit: Number(limit) } : {})
    });
  }

  @Patch("exceptions/:id")
  setStatus(
    @Param("id") id: string,
    @Body() body: { status: ReconciliationStatus; note: string },
    @Req() request: WorkspaceContextRequest
  ) {
    const context = authenticatedContextFromHeaders(request.headers);

    return this.reconciliation.setStatus(id, body.status, context.userId, body.note);
  }
}
