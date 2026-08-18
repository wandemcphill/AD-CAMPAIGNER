/**
 * Runtime feature flags.
 *
 * `featureFlagDefaults` is the code-level default for every flag. The exported
 * `featureFlags` object is those defaults with per-flag environment overrides
 * applied at process start, so a deployment (Render env group) can turn a
 * vertical on or off without a code change or redeploy of the flag file.
 *
 * Override variable name = `FEATURE_` + the flag name in UPPER_SNAKE_CASE:
 *
 *   virtualAccounts     -> FEATURE_VIRTUAL_ACCOUNTS
 *   walletWithdrawals   -> FEATURE_WALLET_WITHDRAWALS
 *   billsElectricity    -> FEATURE_BILLS_ELECTRICITY
 *
 * Accepted truthy values: "true", "1", "yes", "on". Falsy: "false", "0", "no",
 * "off". Anything else (including an empty string) leaves the default in place,
 * so a blank Render variable can never silently disable a live vertical.
 *
 * NOTE: this resolves from `process.env` and therefore only applies server-side
 * (API, worker, Next.js server components). Browser bundles must read flags
 * from the API's `GET /platform/feature-flags` endpoint instead — `process.env`
 * lookups are not available to client components.
 */
export const featureFlagDefaults = {
  liveProviderIntegrations: true,
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
  // Financial products default to DISABLED until each provider integration is
  // sandbox-verified end-to-end (auth + real transaction + webhook + idempotency
  // + ledger reconciliation) per the provider-integration governance rule. The
  // adapters are code-complete. Do not flip these defaults on from code — enable
  // them per-environment via FEATURE_* env after sign-off, and note that the
  // flag only opens the API surface: a request still needs an ENABLED
  // ProviderConfig row for its domain or it fails with 503.
  virtualAccounts: false,
  virtualCards: false,
  remittance: false,
  // Wallet withdrawal (bank-only, NGN) reuses the same NGN payout adapters as
  // `remittance` — same sandbox-verification gate applies.
  walletWithdrawals: false,
  kycVerification: false,
  kybVerification: false,
  telecomGateway: true,
  guestCheckout: true,
  support: true,
  // Customer invoicing and payment links are self-contained FlipTrybe features
  // (no external provider integration to sandbox-verify), so they default on.
  invoicing: true,
  paymentLinks: true
} as const;

export type FeatureFlag = keyof typeof featureFlagDefaults;

export const featureFlagNames = Object.keys(featureFlagDefaults) as FeatureFlag[];

const TRUTHY = new Set(["true", "1", "yes", "on"]);
const FALSY = new Set(["false", "0", "no", "off"]);

/** `virtualAccounts` -> `FEATURE_VIRTUAL_ACCOUNTS` */
export function featureFlagEnvName(flag: FeatureFlag): string {
  return `FEATURE_${flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
}

function readEnvOverride(flag: FeatureFlag): boolean | undefined {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env[featureFlagEnvName(flag)]
      : undefined;

  if (raw === undefined) return undefined;

  const normalized = raw.trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return undefined;
}

export function resolveFeatureFlags(): Record<FeatureFlag, boolean> {
  const resolved = {} as Record<FeatureFlag, boolean>;
  for (const flag of featureFlagNames) {
    resolved[flag] = readEnvOverride(flag) ?? featureFlagDefaults[flag];
  }
  return resolved;
}

/**
 * Resolved once at module load. Every existing `featureFlags.x` call site keeps
 * working and now honours the environment.
 */
export const featureFlags: Record<FeatureFlag, boolean> = resolveFeatureFlags();

export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides: Partial<Record<FeatureFlag, boolean>> = {}
) {
  return overrides[flag] ?? featureFlags[flag];
}

/** Flags safe to hand to a browser client (the whole set — none are secrets). */
export function publicFeatureFlags(): Record<FeatureFlag, boolean> {
  return { ...featureFlags };
}
