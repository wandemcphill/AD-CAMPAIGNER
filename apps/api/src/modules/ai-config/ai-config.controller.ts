import { Body, Controller, Get, Inject, Put, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { AiConfigService } from "./ai-config.service";
import type { UpdateAiConfigDto } from "./ai-config.dtos";

// AI provider configuration (model provider, API endpoint, system-prompt override)
// is internal infrastructure that must never leak to customers. Both read and write
// are platform-admin only. "analytics:read" is held by every workspace role, so it
// must NOT gate reads here; admin:access resolves solely from isPlatformAdmin.
@Controller("ai-config")
@RequirePermissions("admin:access")
@RequireFeature("aiCampaignAssistant")
export class AiConfigController {
  constructor(@Inject(AiConfigService) private readonly aiConfig: AiConfigService) {}

  @Get()
  get(@Req() request: WorkspaceContextRequest) {
    return this.aiConfig.get(workspaceContextFromRequest(request));
  }

  @Put()
  @RequirePermissions("admin:access")
  update(@Body() body: UpdateAiConfigDto, @Req() request: WorkspaceContextRequest) {
    return this.aiConfig.update(body, workspaceContextFromRequest(request));
  }
}
