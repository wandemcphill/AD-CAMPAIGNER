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
  virtualAccounts: true,
  virtualCards: true,
  remittance: true,
  telecomGateway: true
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}
