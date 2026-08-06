import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { ApprovalsService } from "./approvals.service";

@Module({
  imports: [PrismaModule],
  providers: [ApprovalsService],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
