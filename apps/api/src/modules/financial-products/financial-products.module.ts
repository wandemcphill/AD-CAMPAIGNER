import { Module } from "@nestjs/common";

import { featureFlags } from "@fliptrybe/feature-flags";

import { FxModule } from "../fx/fx.module";
import { PrismaModule } from "../prisma.module";
import { ProvidersModule } from "../providers/providers.module";
import { FinancialProductsController } from "./financial-products.controller";
import { FinancialProductsService } from "./financial-products.service";
import { FinancialProductsWebhookController } from "./financial-products-webhook.controller";
import { FinancialProductsWebhookService } from "./financial-products-webhook.service";
import { FinancialReconciliationController } from "./financial-reconciliation.controller";
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
  featureFlags.virtualAccounts ||
  featureFlags.virtualCards ||
  featureFlags.remittance ||
  featureFlags.walletWithdrawals;

@Module({
  // FxModule: a USD card is funded from an NGN wallet, so issuance and top-up
  // convert through the same FxService quote discipline the FX desk uses rather
  // than a second, parallel rate path.
  imports: [PrismaModule, ProvidersModule, FxModule],
  // The webhook controller is registered unconditionally — see its own header
  // comment. Only the customer-facing controller is gated.
  // FinancialReconciliationController is likewise unconditional: an exception
  // opened while a vertical was live still has to be resolvable afterwards.
  controllers: anyFinancialVerticalEnabled
    ? [
        FinancialProductsController,
        FinancialProductsWebhookController,
        FinancialReconciliationController
      ]
    : [FinancialProductsWebhookController, FinancialReconciliationController],
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
