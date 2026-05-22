import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { AdminDigitalAccessController, DigitalAccessController } from "./digital-access.controller";
import { DigitalAccessHubService } from "./digital-access.service";

@Module({
  controllers: [DigitalAccessController, AdminDigitalAccessController],
  providers: [PrismaService, DigitalAccessHubService],
  exports: [DigitalAccessHubService]
})
export class DigitalAccessModule {}
