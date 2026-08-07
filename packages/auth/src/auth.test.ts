import { describe, expect, it } from "vitest";

import { hasPermission } from "./index";

describe("RBAC", () => {
  it("never grants admin:access from the OWNER/ADMIN role alone", () => {
    // Every self-registered user is OWNER of their own new workspace, so
    // admin:access must come solely from isPlatformAdmin — never a role
    // default — or any signup would qualify for the platform admin console.
    expect(hasPermission({ role: "OWNER", permissions: [] }, "admin:access")).toBe(false);
    expect(hasPermission({ role: "ADMIN", permissions: [] }, "admin:access")).toBe(false);
  });

  it("ignores admin:access listed in a member's stored permissions array", () => {
    expect(
      hasPermission({ role: "VIEWER", permissions: ["admin:access"] }, "admin:access")
    ).toBe(false);
  });

  it("grants admin:access only when isPlatformAdmin is set", () => {
    expect(
      hasPermission({ role: "OWNER", permissions: [], isPlatformAdmin: true }, "admin:access")
    ).toBe(true);
    expect(
      hasPermission({ role: "VIEWER", permissions: [], isPlatformAdmin: true }, "admin:access")
    ).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(hasPermission({ role: "VIEWER", permissions: [] }, "campaign:create")).toBe(false);
    expect(hasPermission({ role: "VIEWER", permissions: [] }, "analytics:read")).toBe(true);
  });
});
