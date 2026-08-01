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
  billsElectricity: false,
  billsCable: false,
  workflowAutomation: true,
  rewards: true,
  rewardsAdmin: true,
  giftCardSell: false,
  giftCardBuy: false,
  airtimeCashout: false,
  digitalValueAdmin: false,
  trustEngine: false,
  trustEngineAdmin: false
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}
