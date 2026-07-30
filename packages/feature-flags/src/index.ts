export const featureFlags = {
  liveProviderIntegrations: false,
  manualPaymentReview: true,
  aiCampaignAssistant: true,
  globalSearch: true,
  realtimeCampaignUpdates: true,
  digitalAccess: false,
  digitalAccessAdmin: false,
  virtualNumbers: false,
  virtualNumbersAdmin: false,
  vtu: true,
  vtuAdmin: true
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}
