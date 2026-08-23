import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AdminFulfilmentController } from "./admin-fulfilment.controller";
import { AdminFulfilmentService } from "./admin-fulfilment.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminFulfilmentController],
  providers: [AdminFulfilmentService],
  exports: [AdminFulfilmentService]
})
export class AdminFulfilmentModule {}
