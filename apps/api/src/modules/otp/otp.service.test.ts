import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OtpMarketplaceService } from "./otp.service";

const env = { ...process.env };
const workspaceA = { userId: "user_a", workspaceId: "workspace_a" };
const workspaceB = { userId: "user_b", workspaceId: "workspace_b" };

describe("OtpMarketplaceService", () => {
  beforeEach(() => {
    process.env.ENABLE_OTP_MODULE = "true";
    process.env.ENABLE_BUDGET_OTP = "true";
    process.env.ENABLE_PREMIUM_OTP = "false";
    process.env.ENABLE_OTP_ADMIN = "true";
    process.env.OTP_PROVIDER_MODE = "mock";
    process.env.OTP_BETA_WORKSPACE_IDS = "workspace_demo,workspace_a,workspace_b";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("quotes compliant beta OTP orders", async () => {
    const service = new OtpMarketplaceService();
    const quote = await service.quote({
      serviceCode: "whatsapp",
      countryCode: "NG",
      providerTier: "BUDGET",
      attestationAccepted: true
    });

    expect(quote.routing.providerName).toContain("mock");
    expect(quote.fraudAssessment.action).toBe("ALLOW");
  });

  it("blocks orders without beta approval or attestation before charging", async () => {
    process.env.OTP_BETA_WORKSPACE_IDS = "";
    const service = new OtpMarketplaceService();

    await expect(
      service.createOrder({
        serviceCode: "whatsapp",
        countryCode: "NG",
        providerTier: "BUDGET",
        idempotencyKey: "otp_test_block"
      })
    ).rejects.toThrow("OTP order blocked");
  });

  it("charges once for duplicate idempotency keys", async () => {
    const service = new OtpMarketplaceService();
    const first = await service.createOrder({
      serviceCode: "whatsapp",
      countryCode: "NG",
      providerTier: "BUDGET",
      attestationAccepted: true,
      idempotencyKey: "otp_same"
    });
    const second = await service.createOrder({
      serviceCode: "whatsapp",
      countryCode: "NG",
      providerTier: "BUDGET",
      attestationAccepted: true,
      idempotencyKey: "otp_same"
    });

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.order.id).toBe(first.order.id);
  });

  it("scopes OTP orders and wallet state to the active workspace", async () => {
    const service = new OtpMarketplaceService();
    const created = await service.createOrder(
      {
        serviceCode: "whatsapp",
        countryCode: "NG",
        providerTier: "BUDGET",
        attestationAccepted: true,
        idempotencyKey: "otp_workspace_a"
      },
      undefined,
      workspaceA
    );

    expect(service.listOrders(workspaceA)).toEqual([created.order]);
    expect(service.listOrders(workspaceB)).toEqual([]);
    expect(service.getWallet(workspaceA).workspaceId).toBe(workspaceA.workspaceId);
    expect(service.getWallet(workspaceB).workspaceId).toBe(workspaceB.workspaceId);
    expect(() => service.refundOrder(created.order.id, workspaceB)).toThrow(
      `OTP order ${created.order.id} was not found.`
    );
  });

  it("refunds idempotently through the OTP wallet boundary", async () => {
    const service = new OtpMarketplaceService();
    const created = await service.createOrder({
      serviceCode: "whatsapp",
      countryCode: "NG",
      providerTier: "BUDGET",
      attestationAccepted: true,
      idempotencyKey: "otp_refund"
    });
    const firstRefund = service.refundOrder(created.order.id);
    const secondRefund = service.refundOrder(created.order.id);

    expect(firstRefund.refund.status).toBe("REFUNDED");
    expect(secondRefund.refund.status).toBe("SKIPPED");
  });

  it("rejects negative OTP pricing rule values", () => {
    const service = new OtpMarketplaceService();

    expect(() => service.setPricingRule({ tier: "BUDGET", platformFeeMinor: -1 })).toThrow(
      "OTP platform fee must be a non-negative minor-unit amount."
    );
  });
});
