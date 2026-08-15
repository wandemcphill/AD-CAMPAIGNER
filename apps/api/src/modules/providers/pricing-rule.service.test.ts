import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { PricingRuleService } from "./pricing-rule.service";

function buildService() {
  const created: Record<string, unknown>[] = [];
  const auditRows: Record<string, unknown>[] = [];

  const db = {
    pricingRule: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve({ id: "pr_1", ...args.data });
      }),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "pr_1", domain: "VTU", markupBps: 200, ...args.data })
      )
    },
    auditLog: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        auditRows.push(args.data);
        return Promise.resolve({});
      })
    }
  };

  return {
    auditRows,
    created,
    db,
    service: new PricingRuleService({ client: db } as unknown as PrismaService)
  };
}

const baseRule = { domain: "VTU" as never, markupBps: 200 };

describe("PricingRuleService.create", () => {
  it("rejects a negative markup", async () => {
    const { created, service } = buildService();

    await expect(service.create({ ...baseRule, markupBps: -100 })).rejects.toThrow(/negative/i);
    expect(created).toHaveLength(0);
  });

  it("rejects a fractional markup", async () => {
    const { service } = buildService();

    await expect(service.create({ ...baseRule, markupBps: 12.5 })).rejects.toThrow(/whole number/i);
  });

  it("rejects a markup beyond the absurd ceiling even when confirmed", async () => {
    const { service } = buildService();

    await expect(
      service.create({ ...baseRule, markupBps: 60_000, confirmHighMarkup: true })
    ).rejects.toThrow(/ceiling/i);
  });

  it("requires explicit confirmation for a high but plausible markup", async () => {
    const { service } = buildService();

    await expect(service.create({ ...baseRule, markupBps: 20_000 })).rejects.toThrow(/confirmHighMarkup/);
  });

  it("accepts a high markup once confirmed, and does not persist the confirm flag", async () => {
    const { created, service } = buildService();

    await service.create({ ...baseRule, markupBps: 20_000, confirmHighMarkup: true });

    expect(created[0]?.["markupBps"]).toBe(20_000);
    expect(created[0]).not.toHaveProperty("confirmHighMarkup");
  });

  it("accepts an ordinary markup and records who set it", async () => {
    const { auditRows, service } = buildService();

    await service.create(baseRule, { userId: "user_1", workspaceId: "ws_1" });

    expect(auditRows[0]).toMatchObject({
      action: "pricing_rule.created",
      actorUserId: "user_1",
      entityType: "PricingRule"
    });
  });

  it("still writes the rule when audit logging fails", async () => {
    const { created, db, service } = buildService();
    db.auditLog.create.mockRejectedValueOnce(new Error("audit table unavailable"));

    await expect(service.create(baseRule)).resolves.toBeDefined();
    expect(created).toHaveLength(1);
  });
});

describe("PricingRuleService.setActive", () => {
  it("records deactivation", async () => {
    const { auditRows, service } = buildService();

    await service.setActive("pr_1", false, { userId: "user_1" });

    expect(auditRows[0]).toMatchObject({ action: "pricing_rule.deactivated", entityId: "pr_1" });
  });
});
