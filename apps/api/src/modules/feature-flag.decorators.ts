import { SetMetadata } from "@nestjs/common";

import type { FeatureFlag } from "@fliptrybe/feature-flags";

export const featureFlagKey = "fliptrybe:feature:flags";

/**
 * Gates a route on one or more feature flags. ALL listed flags must be enabled
 * or the route responds 503 (see FeatureFlagGuard).
 *
 * This is the transport-layer half of the provider-integration governance rule:
 * a vertical whose adapters are code-complete but not yet sandbox-verified must
 * not be reachable over HTTP just because its module happens to be registered.
 */
export const RequireFeature = (...flags: FeatureFlag[]) => SetMetadata(featureFlagKey, flags);
