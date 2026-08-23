import { Controller, Get } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminSupportService } from "./admin-support.service";

@Controller("admin/support")
@RequirePermissions("admin:access")
export class AdminSupportController {
  constructor(private readonly service: AdminSupportService) {}

  @Get("overview")
  overview() {
    return this.service.overview();
  }
}
