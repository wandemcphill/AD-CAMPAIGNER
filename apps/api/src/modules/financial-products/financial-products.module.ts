import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialProductsController } from "./financial-products.controller";
import { FinancialProductsService } from "./financial-products.service";
import { FinancialProductsWebhookService } from "./financial-products-webhook.service";
import { FinancialReconciliationService } from "./financial-reconciliation.service";
import { KycService } from "./kyc.service";
import { RemittanceBeneficiaryService } from "./remittance-beneficiary.service";
import { RemittanceCorridorService } from "./remittance-corridor.service";

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: [FinancialProductsController],
  providers: [
    FinancialProductsService,
    FinancialProductsWebhookService,
    FinancialReconciliationService,
    KycService,
    RemittanceBeneficiaryService,
    RemittanceCorridorService
  ],
  exports: [
    FinancialProductsService,
    FinancialProductsWebhookService,
    FinancialReconciliationService,
    KycService,
    RemittanceBeneficiaryService,
    RemittanceCorridorService
  ]
})
export class FinancialProductsModule {}
