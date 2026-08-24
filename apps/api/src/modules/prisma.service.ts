import { Injectable, Optional, OnModuleDestroy } from "@nestjs/common";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: DatabaseClient;

  // Expose the generated Prisma delegates through the Nest adapter. Keeping the
  // wrapper as the injection boundary preserves the existing architecture while
  // allowing modules to use the conventional `db.<model>` form with generated types.
  get auditLog() { return this.client.auditLog; }
  get paymentIntent() { return this.client.paymentIntent; }
  get user() { return this.client.user; }
  get campaign() { return this.client.campaign; }
  get wallet() { return this.client.wallet; }
  get growthOrder() { return this.client.growthOrder; }
  get vtuOrder() { return this.client.vtuOrder; }
  get virtualNumberOrder() { return this.client.virtualNumberOrder; }
  get campaignRiskAssessment() { return this.client.campaignRiskAssessment; }
  get vtuCanonicalSku() { return this.client.vtuCanonicalSku; }
  get providerCapabilityGrant() { return this.client.providerCapabilityGrant; }
  get providerHealth() { return this.client.providerHealth; }
  get financialReconciliationException() { return this.client.financialReconciliationException; }
  get pricingRule() { return this.client.pricingRule; }
  get telecomOrder() { return this.client.telecomOrder; }
  get digitalAccessRequest() { return this.client.digitalAccessRequest; }
  get giftCardPurchaseTransaction() { return this.client.giftCardPurchaseTransaction; }
  get airtimeCashoutTransaction() { return this.client.airtimeCashoutTransaction; }
  get remittanceTransfer() { return this.client.remittanceTransfer; }
  get rmbOrder() { return this.client.rmbOrder; }
  get guestTransaction() { return this.client.guestTransaction; }
  get walletWithdrawal() { return this.client.walletWithdrawal; }
  get session() { return this.client.session; }
  get kycVerification() { return this.client.kycVerification; }
  get supportTicket() { return this.client.supportTicket; }
  get providerConfig() { return this.client.providerConfig; }

  // `client` is never meant to come from Nest's DI container -- `DatabaseClient`
  // is a type-only interface, and this parameter exists so tests can pass a mock
  // client directly via `new PrismaService(mockClient)`.
  constructor(@Optional() client: DatabaseClient = createPrismaClient()) {
    this.client = client;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
