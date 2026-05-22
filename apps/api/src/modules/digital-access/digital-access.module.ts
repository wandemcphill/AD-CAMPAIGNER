import { Module } from "@nestjs/common";

import { AdminDigitalAccessController, DigitalAccessController } from "./digital-access.controller";
import { DigitalAccessHubService } from "./digital-access.service";

@Module({
  controllers: [DigitalAccessController, AdminDigitalAccessController],
  providers: [DigitalAccessHubService],
  exports: [DigitalAccessHubService]
})
export class DigitalAccessModule {}
