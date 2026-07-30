import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { CreateAutomationWorkflowDto, UpdateAutomationWorkflowDto } from "./automation.dtos";
import { AutomationService } from "./automation.service";

@Controller("automation/workflows")
@RequirePermissions("analytics:read")
export class AutomationController {
  constructor(@Inject(AutomationService) private readonly automation: AutomationService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.automation.list(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(@Body() body: CreateAutomationWorkflowDto, @Req() request: WorkspaceContextRequest) {
    return this.automation.create(body, workspaceContextFromRequest(request));
  }

  @Patch(":id")
  @RequirePermissions("campaign:create")
  update(
    @Param("id") id: string,
    @Body() body: UpdateAutomationWorkflowDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.automation.update(id, body, workspaceContextFromRequest(request));
  }

  @Delete(":id")
  @RequirePermissions("campaign:create")
  remove(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.automation.remove(id, workspaceContextFromRequest(request));
  }
}
