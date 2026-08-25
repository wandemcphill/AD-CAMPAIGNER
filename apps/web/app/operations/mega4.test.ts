import { describe, expect, it } from "vitest";

import { isActionableOperationalState } from "./mega4-operational-state";

describe("MEGA 4 operational state", () => {
  it("marks only actionable states as requiring customer action", () => {
    expect(isActionableOperationalState("needs_review")).toBe(true);
    expect(isActionableOperationalState("verification_required")).toBe(true);
    expect(isActionableOperationalState("restricted")).toBe(true);
    expect(isActionableOperationalState("processing")).toBe(false);
    expect(isActionableOperationalState("completed")).toBe(false);
  });
});
