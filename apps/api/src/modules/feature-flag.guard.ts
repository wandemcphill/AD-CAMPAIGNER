import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { isFeatureEnabled, type FeatureFlag } from "@fliptrybe/feature-flags";

import { featureFlagKey } from "./feature-flag.decorators";

/**
 * Enforces @RequireFeature(...). Routes without the decorator are unaffected.
 *
 * Registered AFTER AuthorizationGuard so an unauthenticated caller still gets
 * 401/403 rather than a 503 that would disclose which verticals exist and
 * whether they are switched on.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredFlags = this.reflector.getAllAndOverride<FeatureFlag[]>(featureFlagKey, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredFlags?.length) {
      return true;
    }

    const disabled = requiredFlags.find((flag) => !isFeatureEnabled(flag));

    if (disabled) {
      throw new ServiceUnavailableException(`Feature "${disabled}" is not enabled.`);
    }

    return true;
  }
}
