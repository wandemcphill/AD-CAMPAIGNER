import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminAuditService } from "./admin-audit.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditController],
  providers: [AdminAuditService],
  exports: [AdminAuditService]
})
export class AdminAuditModule {}
