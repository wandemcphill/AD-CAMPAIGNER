import { describe, expect, it } from "vitest";

import type { DigitalAccessRequest, LedgerEntry, Wallet } from "@fliptrybe/types";

import {
  assertDigitalAccessStatusTransition,
  assessDigitalAccessAbuse,
  canRequestDigitalAccess,
  chargeDigitalAccessWallet,
  defaultDigitalAccessCatalog,
  normalizeDigitalAccessContact,
  refundDigitalAccessWallet
} from "./index";

const wallet: Wallet = {
  id: "wallet_demo",
  workspaceId: "workspace_demo",
  availableBalance: { amountMinor: 1000000, currency: "NGN" },
  heldBalance: { amountMinor: 0, currency: "NGN" },
  createdAt: "2026-05-22T00:00:00.000Z",
  updatedAt: "2026-05-22T00:00:00.000Z"
};

const openingCredit: LedgerEntry = {
  id: "ledger_opening",
  walletId: wallet.id,
  kind: "CREDIT",
  amount: { amountMinor: 1000000, currency: "NGN" },
  reference: "opening",
  description: "Opening balance",
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt
};

describe("digital access domain", () => {
  it("seeds required catalog drafts as inactive", () => {
    expect(defaultDigitalAccessCatalog.categories).toHaveLength(4);
    expect(defaultDigitalAccessCatalog.services.map((item) => item.name)).toContain("ChatGPT");
    expect(defaultDigitalAccessCatalog.services.every((item) => !item.isActive)).toBe(true);
    expect(defaultDigitalAccessCatalog.plans.every((item) => !item.isActive)).toBe(true);
  });

  it("normalizes valid contacts and rejects invalid input", () => {
    expect(normalizeDigitalAccessContact("email", "USER@Example.com ")).toBe("user@example.com");
    expect(normalizeDigitalAccessContact("whatsapp", "234 801 000 0000")).toBe("+2348010000000");
    expect(() => normalizeDigitalAccessContact("email", "not-email")).toThrow(/email/);
  });

  it("requires an active service, active plan, and positive price", () => {
    const service = { ...defaultDigitalAccessCatalog.services[0]!, isActive: true };
    const plan = {
      ...defaultDigitalAccessCatalog.plans.find((item) => item.serviceId === service.id)!,
      isActive: true,
      price: { amountMinor: 650000, currency: "NGN" as const }
    };

    expect(canRequestDigitalAccess(service, plan)).toBe(true);
    expect(canRequestDigitalAccess({ ...service, isActive: false }, plan)).toBe(false);
    expect(
      canRequestDigitalAccess(service, { ...plan, price: { ...plan.price, amountMinor: 0 } })
    ).toBe(false);
  });

  it("blocks active duplicates and high velocity requests", () => {
    const request = (id: string): DigitalAccessRequest => ({
      id,
      workspaceId: wallet.workspaceId,
      userId: "user_demo",
      serviceId: "dasvc_chatgpt",
      planId: "plan",
      serviceName: "ChatGPT",
      planName: "Starter",
      contactType: "email",
      contactValue: "user@example.com",
      status: "pending",
      amount: { amountMinor: 650000, currency: "NGN" },
      idempotencyKey: id,
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:00:00.000Z"
    });

    const assessment = assessDigitalAccessAbuse({
      userId: "user_demo",
      serviceId: "dasvc_chatgpt",
      contactValue: "user@example.com",
      requests: [request("req_1")],
      now: new Date("2026-05-22T10:05:00.000Z")
    });

    expect(assessment.allowed).toBe(false);
    expect(assessment.signals).toContain("active_duplicate_request");
  });

  it("charges and refunds wallet requests idempotently", () => {
    const state = { wallet, ledgerEntries: [openingCredit], charges: [] };
    const charged = chargeDigitalAccessWallet(state, {
      requestId: "req_1",
      idempotencyKey: "idem_1",
      workspaceId: wallet.workspaceId,
      walletId: wallet.id,
      amount: { amountMinor: 250000, currency: "NGN" }
    });
    const chargedAgain = chargeDigitalAccessWallet(charged.state, {
      requestId: "req_1",
      idempotencyKey: "idem_1",
      workspaceId: wallet.workspaceId,
      walletId: wallet.id,
      amount: { amountMinor: 250000, currency: "NGN" }
    });
    const refunded = refundDigitalAccessWallet(chargedAgain.state, { requestId: "req_1" });
    const refundedAgain = refundDigitalAccessWallet(refunded.state, { requestId: "req_1" });

    expect(charged.ledgerEntry?.kind).toBe("DEBIT");
    expect(chargedAgain.idempotent).toBe(true);
    expect(refunded.refund.status).toBe("REFUNDED");
    expect(refundedAgain.idempotent).toBe(true);
  });

  it("guards status transitions", () => {
    expect(() => assertDigitalAccessStatusTransition("pending", "processing")).not.toThrow();
    expect(() => assertDigitalAccessStatusTransition("fulfilled", "failed")).toThrow(/already/);
    expect(() => assertDigitalAccessStatusTransition("processing", "pending")).toThrow(/pending/);
  });
});
