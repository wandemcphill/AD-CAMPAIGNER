import { describe, expect, it } from "vitest";

import { calculateAvailableBalance } from "./index";

describe("ledger math", () => {
  it("calculates available balance from immutable entries", () => {
    const balance = calculateAvailableBalance([
      {
        id: "1",
        walletId: "wallet",
        kind: "CREDIT",
        amount: { amountMinor: 10000, currency: "NGN" },
        reference: "fund",
        description: "Funded wallet",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "2",
        walletId: "wallet",
        kind: "HOLD",
        amount: { amountMinor: 2500, currency: "NGN" },
        reference: "campaign",
        description: "Campaign reserve",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    expect(balance.amountMinor).toBe(7500);
  });
});
