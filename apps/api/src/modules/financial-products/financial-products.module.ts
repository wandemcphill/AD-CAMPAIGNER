import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialProductsController } from "./financial-products.controller";
import { FinancialProductsService } from "./financial-products.service";

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: [FinancialProductsController],
  providers: [FinancialProductsService],
  exports: [FinancialProductsService]
})
export class FinancialProductsModule {}
