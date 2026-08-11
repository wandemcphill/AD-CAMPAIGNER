import { Module } from "@nestjs/common";

import { featureFlags } from "@fliptrybe/feature-flags";

import { PrismaModule } from "../prisma.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialProductsController } from "./financial-products.controller";
import { FinancialProductsService } from "./financial-products.service";
import { FinancialProductsWebhookService } from "./financial-products-webhook.service";
import { FinancialReconciliationService } from "./financial-reconciliation.service";
import { KycService } from "./kyc.service";
import { RemittanceBeneficiaryService } from "./remittance-beneficiary.service";
import { RemittanceCorridorService } from "./remittance-corridor.service";

// Second layer of the same gate as @RequireFeature on the controller: when no
// financial vertical is enabled, the routes are never registered at all (404
// rather than 503). Providers stay registered either way — the webhook and
// reconciliation services must keep working so anything already in flight can
// still be settled after a vertical is switched back off.
const anyFinancialVerticalEnabled =
  featureFlags.virtualAccounts || featureFlags.virtualCards || featureFlags.remittance;

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: anyFinancialVerticalEnabled ? [FinancialProductsController] : [],
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
