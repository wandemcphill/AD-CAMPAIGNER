import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { ProviderRouterService } from "./provider-router.service";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, ProviderRouterService],
  exports: [ProvidersService, ProviderRouterService]
})
export class ProvidersModule {}
