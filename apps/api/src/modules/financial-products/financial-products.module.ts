import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { FinancialProductsController } from "./financial-products.controller";
import { FinancialProductsService } from "./financial-products.service";

@Module({
  imports: [PrismaModule],
  controllers: [FinancialProductsController],
  providers: [FinancialProductsService],
  exports: [FinancialProductsService]
})
export class FinancialProductsModule {}
