import { describe, expect, it } from "vitest";

import { hasPermission } from "./index";

describe("RBAC", () => {
  it("grants owners platform governance permissions", () => {
    expect(hasPermission({ role: "OWNER", permissions: [] }, "admin:access")).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(hasPermission({ role: "VIEWER", permissions: [] }, "campaign:create")).toBe(false);
    expect(hasPermission({ role: "VIEWER", permissions: [] }, "analytics:read")).toBe(true);
  });
});
