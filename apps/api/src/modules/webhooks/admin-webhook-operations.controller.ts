import { Controller, Get } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminWebhookOperationsService } from "./admin-webhook-operations.service";

@Controller("admin/webhook-operations")
@RequirePermissions("admin:access")
export class AdminWebhookOperationsController {
  constructor(private readonly operations: AdminWebhookOperationsService) {}

  @Get("overview")
  overview() {
    return this.operations.overview();
  }
}
