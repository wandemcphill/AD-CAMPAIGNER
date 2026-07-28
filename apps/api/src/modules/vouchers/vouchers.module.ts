import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { VouchersController, VoucherClaimController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";

@Module({
  controllers: [VouchersController, VoucherClaimController],
  providers: [PrismaService, VouchersService],
  exports: [VouchersService]
})
export class VouchersModule {}
