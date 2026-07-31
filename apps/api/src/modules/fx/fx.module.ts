import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { FxController, FxQuoteController } from "./fx.controller";
import { FxService } from "./fx.service";

@Module({
  controllers: [FxController, FxQuoteController],
  providers: [PrismaService, FxService],
  exports: [FxService]
})
export class FxModule {}
