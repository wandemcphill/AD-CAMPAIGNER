import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { SecurityService } from "./security.service";

@Controller("security/two-factor")
@RequirePermissions("analytics:read")
export class SecurityController {
  constructor(@Inject(SecurityService) private readonly security: SecurityService) {}

  @Get()
  status(@Req() request: WorkspaceContextRequest) {
    return this.security.status(workspaceContextFromRequest(request));
  }

  @Post("setup")
  setup(@Req() request: WorkspaceContextRequest) {
    return this.security.setup(workspaceContextFromRequest(request));
  }

  @Post("confirm")
  confirm(@Body() body: { code: string }, @Req() request: WorkspaceContextRequest) {
    return this.security.confirm(body.code, workspaceContextFromRequest(request));
  }

  @Post("disable")
  disable(@Body() body: { code: string }, @Req() request: WorkspaceContextRequest) {
    return this.security.disable(body.code, workspaceContextFromRequest(request));
  }
}
