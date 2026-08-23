import { Controller, Get, Query } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminRiskService } from "./admin-risk.service";

@Controller("admin/risk")
@RequirePermissions("admin:access")
export class AdminRiskController {
  constructor(private readonly service: AdminRiskService) {}

  @Get("overview")
  overview() {
    return this.service.overview();
  }

  @Get("campaign-reviews")
  campaignReviews(@Query("limit") limit?: string) {
    return this.service.campaignReviews(limit ? Number(limit) : 100);
  }
}
