/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createHmac } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { FinancialProductsWebhookController } from "./financial-products-webhook.controller";
import type { FinancialProductsWebhookService } from "./financial-products-webhook.service";
import { PrismaService } from "../prisma.service";
import type { DatabaseClient } from "@fliptrybe/database";

const FINCRA_KEY = "fincra_webhook_key";

function fincraSignature(rawBody: string) {
  return createHmac("sha512", FINCRA_KEY).update(rawBody).digest("hex");
}

/** Minimal RawBodyRequest — only `rawBody` is read. */
function requestWith(rawBody: string) {
  return { rawBody: Buffer.from(rawBody, "utf8") } as never;
}

function setup(options: { alreadyProcessed?: boolean } = {}) {
  const upsert = vi.fn(({ create }: { create: Record<string, unknown> }) =>
    Promise.resolve({
      id: "evt_1",
      processed: options.alreadyProcessed ?? false,
      ...create
    })
  );
  const prisma = new PrismaService({
    providerWebhookEvent: { upsert }
  } as unknown as DatabaseClient);

  const handle = vi.fn(() => Promise.resolve());
  const processor = { handle } as unknown as FinancialProductsWebhookService;

  return {
    controller: new FinancialProductsWebhookController(processor, prisma),
    handle,
    upsert
  };
}

describe("FinancialProductsWebhookController", () => {
  it("processes a correctly signed Fincra delivery", async () => {
    process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] = FINCRA_KEY;
    const { controller, handle } = setup();
    const rawBody = JSON.stringify({ id: "evt_abc", event: "transfer.completed", status: "SUCCESS" });

    const result = await controller.fincra(requestWith(rawBody), fincraSignature(rawBody));

    expect(result).toEqual({ ok: true });
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fincra",
        eventType: "transfer.completed",
        providerWebhookEventId: "evt_1"
      })
    );
  });

  it("rejects a delivery whose signature does not match, without processing it", async () => {
    process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] = FINCRA_KEY;
    const { controller, handle, upsert } = setup();
    const rawBody = JSON.stringify({ id: "evt_abc", event: "transfer.completed" });

    await expect(
      controller.fincra(requestWith(rawBody), fincraSignature("a different body"))
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(handle).not.toHaveBeenCalled();
    // The rejected delivery is still recorded — a burst of signature failures
    // is exactly what an operator needs to be able to see.
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ signatureValid: false })
      })
    );
  });

  it("rejects a delivery when no webhook key is configured", async () => {
    delete process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"];
    const { controller, handle } = setup();
    const rawBody = JSON.stringify({ id: "evt_abc", event: "transfer.completed" });

    await expect(
      controller.fincra(requestWith(rawBody), fincraSignature(rawBody))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(handle).not.toHaveBeenCalled();
  });

  it("acknowledges a retry of an already-processed event without reprocessing", async () => {
    process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] = FINCRA_KEY;
    const { controller, handle } = setup({ alreadyProcessed: true });
    const rawBody = JSON.stringify({ id: "evt_abc", event: "transfer.completed" });

    const result = await controller.fincra(requestWith(rawBody), fincraSignature(rawBody));

    expect(result).toEqual({ ok: true, alreadyProcessed: true });
    expect(handle).not.toHaveBeenCalled();
  });

  it("rejects a malformed body before touching the database", async () => {
    process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] = FINCRA_KEY;
    const { controller, upsert } = setup();

    await expect(controller.fincra(requestWith("not json"), "sig")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an unsigned Swappr delivery", async () => {
    process.env["SWAPPR_WEBHOOK_SECRET"] = "swappr_secret";
    const { controller, handle } = setup();
    const rawBody = JSON.stringify({ id: "evt_1", event: "virtual_account.credit" });

    await expect(controller.swappr(requestWith(rawBody), undefined)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(handle).not.toHaveBeenCalled();
  });

  it("rejects an unsigned Payscribe delivery", async () => {
    process.env["PAYSCRIBE_WEBHOOK_SECRET"] = "payscribe_secret";
    const { controller, handle } = setup();
    const rawBody = JSON.stringify({ id: "evt_1", event: "accounts.payment.status" });

    await expect(
      controller.payscribe(requestWith(rawBody), undefined, undefined, undefined)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(handle).not.toHaveBeenCalled();
  });
});
