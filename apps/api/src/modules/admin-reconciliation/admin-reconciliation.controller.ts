import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { AdminReconciliationService } from "./admin-reconciliation.service";

const STATUS_VALUES = ["OPEN", "INVESTIGATING", "RESOLVED", "WONT_FIX"] as const;
type ReconciliationStatus = (typeof STATUS_VALUES)[number];

function parseStatus(value: string | undefined): ReconciliationStatus | undefined {
  if (!value) return undefined;
  if ((STATUS_VALUES as readonly string[]).includes(value)) return value as ReconciliationStatus;
  throw new BadRequestException("Invalid reconciliation status");
}

@Controller("admin/reconciliation")
@RequirePermissions("admin:access")
export class AdminReconciliationController {
  constructor(private readonly service: AdminReconciliationService) {}

  @Get("exceptions")
  list(@Query("status") status?: string) {
    return this.service.list(parseStatus(status));
  }

  @Get("exceptions/:id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch("exceptions/:id")
  update(
    @Param("id") id: string,
    @Body() body: { status: string; note: string },
    @Req() request: WorkspaceContextRequest
  ) {
    const status = parseStatus(body.status);
    if (!status) throw new BadRequestException("Status is required");
    return this.service.update(
      id,
      status,
      body.note ?? "",
      workspaceContextFromRequest(request).userId
    );
  }
}
