import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AdminIdentityController } from "./admin-identity.controller";
import { AdminIdentityService } from "./admin-identity.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminIdentityController],
  providers: [AdminIdentityService]
})
export class AdminIdentityModule {}
