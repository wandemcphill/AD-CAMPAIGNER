import { Controller, Get, Inject } from "@nestjs/common";

import { RequirePermissions } from "./authorization.decorators";
import { AdminCommandCenterService } from "./admin-command-center.service";

@Controller("admin/command-center")
@RequirePermissions("admin:access")
export class AdminCommandCenterController {
  constructor(
    @Inject(AdminCommandCenterService)
    private readonly commandCenter: AdminCommandCenterService
  ) {}

  @Get("overview")
  overview() {
    return this.commandCenter.getOverview();
  }
}
