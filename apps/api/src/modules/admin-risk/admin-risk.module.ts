import { Module } from "@nestjs/common";

import { AdminRiskController } from "./admin-risk.controller";
import { AdminRiskService } from "./admin-risk.service";

@Module({
  controllers: [AdminRiskController],
  providers: [AdminRiskService]
})
export class AdminRiskModule {}
