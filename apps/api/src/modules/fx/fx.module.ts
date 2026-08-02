import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { FxController, FxQuoteController } from "./fx.controller";
import { FxService } from "./fx.service";
import { SettlementController, AdminSettlementController } from "./settlement.controller";
import { SettlementService } from "./settlement.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    FxController,
    FxQuoteController,
    SettlementController,
    AdminSettlementController
  ],
  providers: [FxService, SettlementService],
  exports: [FxService, SettlementService]
})
export class FxModule {}
