import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
  controllers: [ProvidersController],
  providers: [PrismaService, ProvidersService],
  exports: [ProvidersService]
})
export class ProvidersModule {}
