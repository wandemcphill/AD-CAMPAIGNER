import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { AdminIdentityService } from "./admin-identity.service";

@Controller("admin/users")
@RequirePermissions("admin:access")
export class AdminIdentityController {
  constructor(private readonly service: AdminIdentityService) {}

  @Get(":id/security")
  security(@Param("id") id: string) {
    return this.service.getSecurity(id);
  }

  @Post(":id/revoke-sessions")
  revokeSessions(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.revokeAllSessions(
      id,
      workspaceContextFromRequest(request).userId,
      body.reason ?? ""
    );
  }
}
