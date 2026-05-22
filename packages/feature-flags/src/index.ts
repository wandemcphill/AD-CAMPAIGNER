export const featureFlags = {
  liveProviderIntegrations: false,
  manualPaymentReview: true,
  aiCampaignAssistant: true,
  globalSearch: true,
  realtimeCampaignUpdates: true,
  otpModule: false,
  premiumOtp: false,
  budgetOtp: false,
  otpAdmin: false
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}
