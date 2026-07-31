import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
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
