import { Controller, Get, Query } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminAuditService } from "./admin-audit.service";

@Controller("admin/audit")
@RequirePermissions("audit:read")
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get("logs")
  list(
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("actorUserId") actorUserId?: string
  ) {
    return this.audit.list({
      ...(limit ? { limit: Number(limit) } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorUserId ? { actorUserId } : {})
    });
  }
}
