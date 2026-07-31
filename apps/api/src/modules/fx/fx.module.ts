import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { FxController, FxQuoteController } from "./fx.controller";
import { FxService } from "./fx.service";
import { SettlementController, AdminSettlementController } from "./settlement.controller";
import { SettlementService } from "./settlement.service";

@Module({
  controllers: [
    FxController,
    FxQuoteController,
    SettlementController,
    AdminSettlementController
  ],
  providers: [PrismaService, FxService, SettlementService],
  exports: [FxService, SettlementService]
})
export class FxModule {}
