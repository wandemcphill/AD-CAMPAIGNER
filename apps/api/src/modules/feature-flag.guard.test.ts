import { ServiceUnavailableException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import type { FeatureFlag } from "@fliptrybe/feature-flags";

import { FeatureFlagGuard } from "./feature-flag.guard";

/**
 * The financial verticals (virtualAccounts / virtualCards / remittance) ship
 * with their flags OFF until each provider integration is sandbox-verified.
 * Before this guard existed the flags were declarative only — the module
 * registered unconditionally and no controller consulted them, so the routes
 * were reachable. These tests pin the enforcement.
 */

function contextFor(flags: FeatureFlag[] | undefined) {
  const reflector = {
    getAllAndOverride: vi.fn(() => flags)
  } as unknown as Reflector;

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {}
  } as unknown as ExecutionContext;

  return { guard: new FeatureFlagGuard(reflector), context };
}

describe("FeatureFlagGuard", () => {
  it("allows routes that declare no feature requirement", () => {
    const { guard, context } = contextFor(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows a route whose flag is enabled", () => {
    const { guard, context } = contextFor(["vtu"]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each<FeatureFlag>(["virtualAccounts", "virtualCards", "remittance", "kycVerification"])(
    "blocks %s while its flag is disabled",
    (flag) => {
      const { guard, context } = contextFor([flag]);
      expect(() => guard.canActivate(context)).toThrow(ServiceUnavailableException);
    }
  );

  it("blocks when any one of several required flags is disabled", () => {
    const { guard, context } = contextFor(["vtu", "remittance"]);
    expect(() => guard.canActivate(context)).toThrow(ServiceUnavailableException);
  });

  it("names the disabled flag so ops can tell which gate fired", () => {
    const { guard, context } = contextFor(["remittance"]);
    expect(() => guard.canActivate(context)).toThrow(/remittance/);
  });
});
