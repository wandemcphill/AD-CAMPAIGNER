import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";

@Module({
  controllers: [ApiKeysController],
  providers: [PrismaService, ApiKeysService],
  exports: [ApiKeysService]
})
export class ApiKeysModule {}
