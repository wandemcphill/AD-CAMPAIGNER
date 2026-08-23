import { Controller, Get } from "@nestjs/common";

import { RequirePermissions } from "./authorization.decorators";
import { AdminOperationsControlTowerService } from "./admin-operations-control-tower.service";

@Controller("admin/operations-control-tower")
@RequirePermissions("admin:access")
export class AdminOperationsControlTowerController {
  constructor(private readonly operations: AdminOperationsControlTowerService) {}

  @Get("overview")
  overview() {
    return this.operations.overview();
  }

  @Get("queue")
  queue() {
    return this.operations.queue();
  }
}
