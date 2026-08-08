import "reflect-metadata";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi, afterEach } from "vitest";

import { authorizationPublicKey } from "../authorization.decorators";
import { AdminSettlementController } from "./settlement.controller";
import type { SettlementService } from "./settlement.service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("AdminSettlementController webhook route", () => {
  it("is marked @Public() so Fincra's unauthenticated webhook calls are not blocked by the admin auth guard", () => {
    const isPublic = Reflect.getMetadata(authorizationPublicKey, AdminSettlementController.prototype.handleWebhook);
    expect(isPublic).toBe(true);
  });

  it("rejects when FINCRA_WEBHOOK_KEY is not configured, rather than skipping verification", async () => {
    delete process.env["FINCRA_WEBHOOK_KEY"];
    const settlement = { handleSettlementWebhook: vi.fn() } as unknown as SettlementService;
    const controller = new AdminSettlementController(settlement);

    await expect(
      controller.handleWebhook("fincra", "sig", { data: { reference: "ref_1" } })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(settlement.handleSettlementWebhook).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    process.env["FINCRA_WEBHOOK_KEY"] = "test-key";
    const settlement = { handleSettlementWebhook: vi.fn() } as unknown as SettlementService;
    const controller = new AdminSettlementController(settlement);

    await expect(
      controller.handleWebhook("fincra", "not-a-real-signature", { data: { reference: "ref_1" } })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(settlement.handleSettlementWebhook).not.toHaveBeenCalled();
  });
});
