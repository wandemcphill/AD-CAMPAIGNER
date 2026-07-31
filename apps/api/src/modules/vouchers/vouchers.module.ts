import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { VouchersController, VoucherClaimController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";

@Module({
  imports: [WebhooksModule],
  controllers: [VouchersController, VoucherClaimController],
  providers: [PrismaService, VouchersService],
  exports: [VouchersService]
})
export class VouchersModule {}
