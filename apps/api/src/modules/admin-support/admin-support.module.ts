import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AdminSupportController } from "./admin-support.controller";
import { AdminSupportService } from "./admin-support.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
  exports: [AdminSupportService]
})
export class AdminSupportModule {}
