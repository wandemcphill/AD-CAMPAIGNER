import { describe, expect, it } from "vitest";

import {
  assessOtpFraud,
  calculateOtpPrice,
  chargeOtpWallet,
  defaultOtpServices,
  refundOtpWallet,
  routeOtpProvider
} from ".";
import type { LedgerEntry, OtpProviderHealth, Wallet } from "@fliptrybe/types";

const wallet: Wallet = {
  id: "wallet_demo",
  workspaceId: "workspace_demo",
  availableBalance: { amountMinor: 500000, currency: "NGN" },
  heldBalance: { amountMinor: 0, currency: "NGN" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const openingCredit: LedgerEntry = {
  id: "ledger_opening",
  walletId: wallet.id,
  kind: "CREDIT",
  amount: { amountMinor: 500000, currency: "NGN" },
  reference: "opening",
  description: "Opening balance",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("OTP service domain", () => {
  it("prices USD supplier costs into NGN customer prices with margin", () => {
    const result = calculateOtpPrice({
      supplierCost: { amountMinor: 50, currency: "USD" },
      tier: "BUDGET"
    });

    expect(result.customerPrice.currency).toBe("NGN");
    expect(result.customerPrice.amountMinor).toBeGreaterThan(result.grossMargin.amountMinor);
    expect(result.profitable).toBe(true);
  });

  it("routes by success-per-cost instead of cheapest-only", () => {
    const health: OtpProviderHealth[] = [
      {
        providerName: "cheap-down",
        tier: "BUDGET",
        status: "DOWN",
        latencyMs: 100,
        successRateBps: 9900,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        providerName: "reliable",
        tier: "BUDGET",
        status: "HEALTHY",
        latencyMs: 250,
        successRateBps: 9600,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    const routed = routeOtpProvider({
      health,
      quotes: [
        {
          providerName: "cheap-down",
          tier: "BUDGET",
          supplierCost: { amountMinor: 20, currency: "USD" },
          available: true,
          estimatedLatencyMs: 100,
          successRateBps: 9900,
          inventory: 100
        },
        {
          providerName: "reliable",
          tier: "BUDGET",
          supplierCost: { amountMinor: 75, currency: "USD" },
          available: true,
          estimatedLatencyMs: 250,
          successRateBps: 9600,
          inventory: 25
        }
      ]
    });

    expect(routed.providerName).toBe("reliable");
  });

  it("blocks unapproved workspaces before charging", () => {
    const assessment = assessOtpFraud({
      service: defaultOtpServices[0]!,
      recentOrders: [],
      workspaceApproved: false,
      attestationAccepted: true
    });

    expect(assessment.action).toBe("BLOCK");
  });

  it("charges and refunds idempotently", () => {
    const state = { wallet, ledgerEntries: [openingCredit], charges: [] };
    const firstCharge = chargeOtpWallet(state, {
      otpOrderId: "otp_1",
      idempotencyKey: "idem_1",
      workspaceId: wallet.workspaceId,
      walletId: wallet.id,
      amount: { amountMinor: 100000, currency: "NGN" }
    });
    const secondCharge = chargeOtpWallet(firstCharge.state, {
      otpOrderId: "otp_1",
      idempotencyKey: "idem_1",
      workspaceId: wallet.workspaceId,
      walletId: wallet.id,
      amount: { amountMinor: 100000, currency: "NGN" }
    });
    const firstRefund = refundOtpWallet(secondCharge.state, { otpOrderId: "otp_1" });
    const secondRefund = refundOtpWallet(firstRefund.state, { otpOrderId: "otp_1" });

    expect(firstCharge.idempotent).toBe(false);
    expect(secondCharge.idempotent).toBe(true);
    expect(firstRefund.refund.status).toBe("REFUNDED");
    expect(secondRefund.idempotent).toBe(true);
  });

  it("rejects negative wallet charges before mutating OTP wallet state", () => {
    const state = { wallet, ledgerEntries: [openingCredit], charges: [] };

    expect(() =>
      chargeOtpWallet(state, {
        otpOrderId: "otp_negative",
        idempotencyKey: "idem_negative",
        workspaceId: wallet.workspaceId,
        walletId: wallet.id,
        amount: { amountMinor: -100, currency: "NGN" }
      })
    ).toThrow("OTP wallet charge must be a positive minor-unit amount.");
    expect(state.ledgerEntries).toHaveLength(1);
    expect(state.charges).toHaveLength(0);
  });
});
