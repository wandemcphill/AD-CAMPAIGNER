import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AdminRiskController } from "./admin-risk.controller";
import { AdminRiskService } from "./admin-risk.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminRiskController],
  providers: [AdminRiskService]
})
export class AdminRiskModule {}
