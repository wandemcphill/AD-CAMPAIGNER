import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { FxController } from "./fx.controller";
import { FxService } from "./fx.service";

@Module({
  controllers: [FxController],
  providers: [PrismaService, FxService],
  exports: [FxService]
})
export class FxModule {}
