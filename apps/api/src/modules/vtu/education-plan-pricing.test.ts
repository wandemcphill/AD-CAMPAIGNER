import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { VtuService } from "./vtu.service";

/**
 * Admin-entered education pricing.
 *
 * Not every provider can price itself. SirpData sells WAEC/NECO/UTME/NABTEB PINs
 * but its documented API has no pricing endpoint — the cost appears only as
 * `amountCharged` on the purchase response, after the money is spent. Since
 * buyEducation refuses to charge without a plan row, SirpData could never serve
 * an education order at all. An admin-entered MANUAL row is the way out, and the
 * daily catalog sync must not undo one.
 */

const CTX = { userId: "user_admin", workspaceId: "workspace_test" };

describe("VtuService education plan pricing", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let auditCreate: ReturnType<typeof vi.fn>;
  let service: VtuService;

  beforeEach(() => {
    upsert = vi.fn((args: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: "vedu_1", ...args.create })
    );
    auditCreate = vi.fn(() => Promise.resolve({}));

    const db = {
      vtuEducationPlan: {
        upsert,
        findMany: vi.fn(() => Promise.resolve([])),
        findUnique: vi.fn(() => Promise.resolve(null))
      },
      auditLog: { create: auditCreate }
    };

    const prisma = { client: db } as unknown as PrismaService;
    // Only the Prisma client is exercised by these methods; the queue, pricing
    // rules, router and quote services are never reached.
    service = new VtuService(
      prisma,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
  });

  it("stores an admin price as MANUAL so the sync will not reprice it", async () => {
    const plan = await service.adminUpsertEducationPlan(
      {
        providerName: "sirpdata",
        productCode: "neco_pin",
        displayName: "NECO Result Checker PIN",
        costMinor: 123_000
      },
      CTX
    );

    expect(plan.pricingSource).toBe("MANUAL");
    expect(plan.costMinor).toBe(123_000);

    const args = upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    // Both halves must mark MANUAL — an existing SYNC row being priced by an
    // admin has to flip, or the next sync would silently overwrite it.
    expect(args.update["pricingSource"]).toBe("MANUAL");
    expect(args.create["pricingSource"]).toBe("MANUAL");

    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects an exam type the provider does not sell, at configuration time", async () => {
    // SirpData's documented examType set is waec_pin/neco_pin/utme_pin/nabteb_pin.
    // Catching this here is the difference between an operator seeing the error
    // and a customer hitting it mid-purchase.
    await expect(
      service.adminUpsertEducationPlan(
        {
          providerName: "sirpdata",
          productCode: "nbais_pin",
          displayName: "NBAIS PIN",
          costMinor: 92_000
        },
        CTX
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("accepts every exam type SirpData does document", async () => {
    for (const productCode of ["waec_pin", "neco_pin", "utme_pin", "nabteb_pin"]) {
      await expect(
        service.adminUpsertEducationPlan(
          { providerName: "sirpdata", productCode, displayName: productCode, costMinor: 1_000 },
          CTX
        )
      ).resolves.toBeTruthy();
    }
  });

  it("does not constrain providers whose catalog is synced", async () => {
    // TopupWizard's product codes come from its own /pricing endpoint, so there
    // is no local list to validate against and an override must still be possible.
    await expect(
      service.adminUpsertEducationPlan(
        {
          providerName: "topupwizard",
          productCode: "some-provider-specific-id",
          displayName: "WAEC E-Pin",
          costMinor: 345_000
        },
        CTX
      )
    ).resolves.toBeTruthy();
  });

  it("rejects a non-positive or non-integer price", async () => {
    for (const costMinor of [0, -100, 12.5]) {
      await expect(
        service.adminUpsertEducationPlan(
          {
            providerName: "sirpdata",
            productCode: "waec_pin",
            displayName: "WAEC",
            costMinor
          },
          CTX
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it("normalises provider name casing so a row is not duplicated by it", async () => {
    await service.adminUpsertEducationPlan(
      {
        providerName: "SirpData",
        productCode: "waec_pin",
        displayName: "WAEC Result Checker PIN",
        costMinor: 345_000
      },
      CTX
    );

    const args = upsert.mock.calls[0]?.[0] as { where: { providerName_productCode: { providerName: string } } };
    expect(args.where.providerName_productCode.providerName).toBe("sirpdata");
  });
});
