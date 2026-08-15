import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { VtuModule } from "../vtu/vtu.module";
import {
  AdminVouchersController,
  VouchersController,
  VoucherClaimController
} from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";

@Module({
  imports: [WebhooksModule, PrismaModule, VtuModule],
  controllers: [VouchersController, VoucherClaimController, AdminVouchersController],
  providers: [VouchersService],
  exports: [VouchersService]
})
export class VouchersModule {}
