import { Controller, Get } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminProviderGovernanceService } from "./admin-provider-governance.service";

@Controller("admin/provider-governance")
@RequirePermissions("admin:access")
export class AdminProviderGovernanceController {
  constructor(private readonly service: AdminProviderGovernanceService) {}

  @Get("overview")
  overview() {
    return this.service.overview();
  }
}
