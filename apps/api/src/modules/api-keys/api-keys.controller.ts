import { Body, Controller, Delete, Get, Inject, Param, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { ApiKeysService } from "./api-keys.service";

@Controller("developer/api-keys")
@RequirePermissions("analytics:read")
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.apiKeys.list(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("admin:access")
  create(
    @Body() body: { name: string; environment: "TEST" | "PRODUCTION"; scopes: string[] },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.apiKeys.create(body, workspaceContextFromRequest(request));
  }

  @Delete(":id")
  @RequirePermissions("admin:access")
  revoke(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.apiKeys.revoke(id, workspaceContextFromRequest(request));
  }
}
