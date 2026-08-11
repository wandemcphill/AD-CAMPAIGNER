import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AiConfigController } from "./ai-config.controller";
import { AiConfigService } from "./ai-config.service";

@Module({
  imports: [PrismaModule],
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService]
})
export class AiConfigModule {}
