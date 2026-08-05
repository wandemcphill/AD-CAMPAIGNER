import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";

import { Public, RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
import { ProviderWebhooksService } from "./provider-webhooks.service";
import { OutgoingWebhooksService, SUPPORTED_WEBHOOK_EVENTS } from "./outgoing-webhooks.service";

@Controller("developer/webhooks")
@RequirePermissions("analytics:read")
export class OutgoingWebhooksController {
  constructor(@Inject(OutgoingWebhooksService) private readonly webhooks: OutgoingWebhooksService) {}

  @Get("events")
  supportedEvents() {
    return { events: SUPPORTED_WEBHOOK_EVENTS };
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.webhooks.list(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("admin:access")
  create(@Body() body: { targetUrl: string; events: string[] }, @Req() request: WorkspaceContextRequest) {
    return this.webhooks.create(body, workspaceContextFromRequest(request));
  }

  @Delete(":id")
  @RequirePermissions("admin:access")
  revoke(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.webhooks.revoke(id, workspaceContextFromRequest(request));
  }

  @Get(":id/deliveries")
  deliveries(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.webhooks.deliveries(id, workspaceContextFromRequest(request));
  }
}

@Controller("admin/webhooks/incoming")
@RequirePermissions("admin:access")
export class IncomingWebhooksController {
  constructor(@Inject(IncomingWebhooksService) private readonly incoming: IncomingWebhooksService) {}

  @Get()
  list(@Query("status") status: string | undefined, @Query("name") name: string | undefined) {
    return this.incoming.list({ ...(status === undefined ? {} : { status }), ...(name === undefined ? {} : { name }) });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.incoming.detail(id);
  }
}

@Controller("webhooks")
@Public()
export class ProviderWebhooksController {
  constructor(@Inject(ProviderWebhooksService) private readonly provider: ProviderWebhooksService) {}

  @Post("sogo")
  async sogoWebhook(
    @Req() req: RawBodyRequest<unknown>,
    @Headers("x-sogo-signature") signature: string,
    @Headers("x-sogo-timestamp") timestamp: string
  ) {
    const secret = process.env['SOGO_WEBHOOK_SECRET'] || process.env['SOGO_SECRET_KEY'] || '';
    const payload = req.rawBody?.toString() || '';
    await this.provider.handleSogoWebhook(JSON.parse(payload), payload, signature, timestamp, secret);
    return { ok: true };
  }

  @Post("reloadly")
  async reloadlyWebhook(
    @Req() req: RawBodyRequest<unknown>,
    @Headers("x-reloadly-signature") signature: string,
    @Headers("x-reloadly-request-timestamp") timestamp: string
  ) {
    const secret = process.env['RELOADLY_WEBHOOK_SECRET'] || '';
    const payload = req.rawBody?.toString() || '';
    await this.provider.handleReloadlyWebhook(JSON.parse(payload), payload, timestamp, signature, secret);
    return { ok: true };
  }
}
