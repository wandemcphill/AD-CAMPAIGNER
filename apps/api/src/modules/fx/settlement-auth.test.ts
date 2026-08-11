import "reflect-metadata";
import { describe, expect, it } from "vitest";

import { authorizationPermissionsKey } from "../authorization.decorators";
import { SettlementController } from "./settlement.controller";
import { FxQuoteController } from "./fx.controller";

/**
 * Both controllers previously had no @RequirePermissions/@Public anywhere,
 * which meant every route always 403'd via AuthorizationGuard's fail-closed
 * default — accidentally safe, but only by luck, and undiscoverable as
 * "secure" from the source. Pinning the explicit gate so a future refactor
 * can't silently drop back to the implicit (and fragile) always-403 state.
 */
describe("v1/settlements and v1/fx — explicit authorization", () => {
  it("SettlementController requires admin:access at the class level", () => {
    const perms: unknown = Reflect.getMetadata(authorizationPermissionsKey, SettlementController);
    expect(perms).toEqual(["admin:access"]);
  });

  it("FxQuoteController requires admin:access at the class level", () => {
    const perms: unknown = Reflect.getMetadata(authorizationPermissionsKey, FxQuoteController);
    expect(perms).toEqual(["admin:access"]);
  });
});
