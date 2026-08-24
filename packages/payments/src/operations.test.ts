import { describe, expect, it } from "vitest";
import { buildNotificationDedupeKey, createOperationalNotification, notificationSeverity, supportActionForFailure } from "./operations.js";

describe("operational communication", () => {
  it("classifies security and failed transaction events as critical", () => {
    expect(notificationSeverity("security.alert")).toBe("critical");
    expect(notificationSeverity("transaction.failed")).toBe("critical");
  });

  it("classifies pending events as warnings", () => {
    expect(notificationSeverity("transaction.pending")).toBe("warning");
  });

  it("creates deterministic dedupe keys", () => {
    expect(buildNotificationDedupeKey({ userId: "u1", event: "transaction.succeeded", resourceId: "tx1" }))
      .toBe("ft:notify:u1:transaction.succeeded:tx1");
  });

  it("maps ambiguous money failures to reconciliation", () => {
    expect(supportActionForFailure("unknown_delivery")).toBe("reconcile");
    expect(supportActionForFailure("retryable")).toBe("retry");
    expect(supportActionForFailure("rejected")).toBe("contact_support");
  });

  it("builds a complete notification envelope", () => {
    expect(createOperationalNotification({
      event: "transaction.succeeded",
      userId: "u1",
      title: "Transfer complete",
      message: "Your transfer is complete.",
      channels: ["in_app", "email"]
    })).toMatchObject({
      severity: "info",
      dedupeKey: "ft:notify:u1:transaction.succeeded:account"
    });
  });
});
