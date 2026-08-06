import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";

import type { ProviderDomain } from "@fliptrybe/providers";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import { ProvidersService } from "./providers.service";

@Controller("admin/providers")
@RequirePermissions("admin:access")
export class ProvidersController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}

  @Get()
  overview() {
    return this.providers.overview();
  }

  @Post(":domain/:name/disable")
  disable(
    @Param("domain") domain: ProviderDomain,
    @Param("name") name: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.setProviderStatus(
      domain,
      name,
      "DISABLED",
      authenticatedContextFromHeaders(request.headers),
      body.reason
    );
  }

  @Post(":domain/:name/enable")
  enable(
    @Param("domain") domain: ProviderDomain,
    @Param("name") name: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.setProviderStatus(
      domain,
      name,
      "HEALTHY",
      authenticatedContextFromHeaders(request.headers),
      body.reason
    );
  }
}
