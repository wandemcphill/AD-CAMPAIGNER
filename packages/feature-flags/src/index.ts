export const featureFlags = {
  liveProviderIntegrations: false,
  manualPaymentReview: true,
  aiCampaignAssistant: true,
  globalSearch: true,
  realtimeCampaignUpdates: true,
  digitalAccess: true,
  digitalAccessAdmin: true,
  virtualNumbers: true,
  virtualNumbersAdmin: true,
  vtu: true,
  vtuAdmin: true,
  billsElectricity: true,
  billsCable: true,
  billsBetting: true,
  billsEducation: true,
  workflowAutomation: true,
  rewards: true,
  rewardsAdmin: true,
  giftCardSell: true,
  giftCardBuy: true,
  cryptoSell: true,
  rmbBuy: true,
  airtimeCashout: true,
  digitalValueAdmin: true,
  trustEngine: false,
  trustEngineAdmin: false,
  // Financial products remain DISABLED until each provider integration is
  // sandbox-verified end-to-end (auth + real transaction + webhook + idempotency
  // + ledger reconciliation) per the provider-integration governance rule. The
  // adapters are documented/code-complete but NOT production-ready. Do not flip
  // these on from code — enable per-provider via ProviderConfig after sign-off.
  virtualAccounts: false,
  virtualCards: false,
  remittance: false,
  kycVerification: false,
  kybVerification: false,
  telecomGateway: true,
  guestCheckout: true,
  support: true
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}
