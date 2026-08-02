import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { VouchersController, VoucherClaimController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";

@Module({
  imports: [WebhooksModule, PrismaModule],
  controllers: [VouchersController, VoucherClaimController],
  providers: [VouchersService],
  exports: [VouchersService]
})
export class VouchersModule {}
