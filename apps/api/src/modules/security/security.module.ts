import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { SecurityController } from "./security.controller";
import { SecurityService } from "./security.service";

@Module({
  controllers: [SecurityController],
  providers: [PrismaService, SecurityService],
  exports: [SecurityService]
})
export class SecurityModule {}
