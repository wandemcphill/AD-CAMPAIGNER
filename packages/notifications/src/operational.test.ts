import { describe, expect, it } from "vitest";

import {
  createOperationalNotification,
  defaultOperationalEventName,
  isFinancialOutcomeNotification,
  isSecurityNotification
} from "./operational.js";

describe("operational notifications", () => {
  it("keeps the operational vocabulary stable", () => {
    expect(defaultOperationalEventName("VERIFICATION_REQUIRED")).toBe("verification_required");
    expect(isSecurityNotification("SECURITY_ALERT")).toBe(true);
    expect(isFinancialOutcomeNotification("TRANSACTION_REVIEW")).toBe(true);
    expect(isFinancialOutcomeNotification("VERIFICATION_COMPLETED")).toBe(false);
  });

  it("builds an in-app message from durable event context", () => {
    expect(
      createOperationalNotification({
        workspaceId: "ws_1",
        kind: "TRANSACTION_REVIEW",
        title: "Payment needs review",
        body: "We are checking the provider outcome.",
        actionHref: "/orders/txn_1"
      })
    ).toMatchObject({
      workspaceId: "ws_1",
      channel: "IN_APP",
      title: "Payment needs review",
      body: "We are checking the provider outcome. /orders/txn_1"
    });
  });
});
