import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { FxService } from "../fx/fx.service";
import type { PrismaService } from "../prisma.service";
import type { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialProductsService } from "./financial-products.service";
import type { FinancialReconciliationService } from "./financial-reconciliation.service";

/**
 * Card issuance is currency-routed, and USD issuers need a customer first.
 *
 * Two defects this pins:
 *
 *  1. selectCardAdapter asked the router for productType "NGN_CARD" no matter
 *     what currency was requested. Payscribe and Maplerad issue USD only, so a
 *     USD card could never route to either — the scope excluded them before
 *     scoring even ran.
 *
 *  2. issueCard never passed providerCustomerId. Payscribe's adapter throws
 *     without one, and it threw from inside the charge saga's execute step —
 *     i.e. after the wallet had already been debited — turning a configuration
 *     gap into an ops reconciliation item.
 */

const CTX = { userId: "user_test", workspaceId: "workspace_test" };

function buildService(opts: {
  providerCustomer?: { providerCustomerId: string; status: string } | null;
} = {}) {
  const select = vi.fn(() => Promise.resolve({ providerName: "payscribe-virtual-card" }));
  const db = {
    providerCustomer: {
      findUnique: vi.fn(() => Promise.resolve(opts.providerCustomer ?? null))
    }
  };

  const service = new FinancialProductsService(
    { client: db } as unknown as PrismaService,
    { select } as unknown as ProviderRouterService,
    {} as unknown as FinancialReconciliationService,
    {} as unknown as FxService
  );

  return { service, select };
}

describe("virtual card currency routing", () => {
  it("scopes the router to the requested currency, not a hardcoded NGN_CARD", async () => {
    const { service, select } = buildService();

    await (
      service as unknown as {
        selectCardAdapter: (id: string, currency: string) => Promise<unknown>;
      }
    ).selectCardAdapter("vc_1", "USD");

    expect(select).toHaveBeenCalledWith(
      "VIRTUAL_CARD",
      { productType: "USD_CARD" },
      "VirtualCard",
      "vc_1"
    );
  });

  it("still scopes NGN requests to NGN_CARD", async () => {
    const { service, select } = buildService();

    await (
      service as unknown as {
        selectCardAdapter: (id: string, currency: string) => Promise<unknown>;
      }
    ).selectCardAdapter("vc_2", "ngn");

    expect(select).toHaveBeenCalledWith(
      "VIRTUAL_CARD",
      { productType: "NGN_CARD" },
      "VirtualCard",
      "vc_2"
    );
  });
});

describe("provider customer resolution", () => {
  it("returns the stored customer id for an active enrollment", async () => {
    const { service } = buildService({
      providerCustomer: { providerCustomerId: "cus_live_1", status: "ACTIVE" }
    });

    const resolved = await (
      service as unknown as {
        resolveProviderCustomerId: (ctx: unknown, provider: string) => Promise<string | undefined>;
      }
    ).resolveProviderCustomerId(CTX, "payscribe");

    expect(resolved).toBe("cus_live_1");
  });

  it("ignores a non-active enrollment rather than issuing against it", async () => {
    const { service } = buildService({
      providerCustomer: { providerCustomerId: "cus_dead", status: "REVOKED" }
    });

    const resolved = await (
      service as unknown as {
        resolveProviderCustomerId: (ctx: unknown, provider: string) => Promise<string | undefined>;
      }
    ).resolveProviderCustomerId(CTX, "payscribe");

    expect(resolved).toBeUndefined();
  });

  it("rejects enrollment for a provider that does not support it", async () => {
    const { service } = buildService();
    // Sudo's adapter has no enrollCustomer, so enrolling against it is a
    // caller error rather than something to silently no-op.
    (service as unknown as { selectCardAdapter: () => Promise<unknown> }).selectCardAdapter = () =>
      Promise.resolve({ name: "sudo" });

    await expect(
      service.enrollCardCustomer(CTX, {
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@example.com",
        phone: "+2348030000000"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
