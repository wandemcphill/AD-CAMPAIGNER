import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { AutomationController } from "./automation.controller";
import { AutomationService } from "./automation.service";

@Module({
  controllers: [AutomationController],
  providers: [PrismaService, AutomationService],
  exports: [AutomationService]
})
export class AutomationModule {}
