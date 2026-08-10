import { describe, expect, it, vi } from "vitest";

import { ProviderRouterService } from "./provider-router.service";
import type { PrismaService } from "../prisma.service";

function buildPrismaMock(overrides: {
  configs?: unknown[];
  grants?: unknown[];
  healthRows?: unknown[];
}) {
  const providerRoutingAttemptCreate = vi.fn().mockResolvedValue({});
  const client = {
    providerConfig: { findMany: vi.fn().mockResolvedValue(overrides.configs ?? []) },
    providerCapabilityGrant: { findMany: vi.fn().mockResolvedValue(overrides.grants ?? []) },
    providerHealth: { findMany: vi.fn().mockResolvedValue(overrides.healthRows ?? []) },
    providerRoutingAttempt: { create: providerRoutingAttemptCreate }
  };
  const prisma = { client } as unknown as PrismaService;
  return { prisma, client, providerRoutingAttemptCreate };
}

const CONFIG = {
  name: "swappr-remittance",
  domain: "REMITTANCE",
  status: "HEALTHY",
  priority: 10,
  enabledCountries: [],
  enabledNetworks: [],
  enabledProductTypes: [],
  deletedAt: null
};

describe("ProviderRouterService — ProviderCapabilityGrant hard gate", () => {
  it("returns null and logs NO_CANDIDATE when a ProviderConfig exists but has no enabled grant", async () => {
    const { prisma, providerRoutingAttemptCreate } = buildPrismaMock({ configs: [CONFIG], grants: [] });
    const router = new ProviderRouterService(prisma);

    const result = await router.select("REMITTANCE", { productType: "BANK_TRANSFER" }, "Remittance", "order_1");

    expect(result).toBeNull();
    expect(providerRoutingAttemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is typed `any` by vitest
        data: expect.objectContaining({
          status: "NO_CANDIDATE",
          providerName: "NONE",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.stringContaining is typed `any` by vitest
          reason: expect.stringContaining("swappr-remittance")
        })
      })
    );
  });

  it("selects a provider once it holds an enabled ProviderCapabilityGrant for the domain", async () => {
    const grant = { providerName: "swappr-remittance", domain: "REMITTANCE", enabled: true };
    const { prisma, providerRoutingAttemptCreate } = buildPrismaMock({ configs: [CONFIG], grants: [grant] });
    const router = new ProviderRouterService(prisma);

    const result = await router.select("REMITTANCE", { productType: "BANK_TRANSFER" }, "Remittance", "order_2");

    expect(result).toEqual({ providerName: "swappr-remittance" });
    expect(providerRoutingAttemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is typed `any` by vitest
        data: expect.objectContaining({ status: "SELECTED", providerName: "swappr-remittance" })
      })
    );
  });

  it("ignores a grant for a different provider even if configured", async () => {
    const grant = { providerName: "some-other-provider", domain: "REMITTANCE", enabled: true };
    const { prisma } = buildPrismaMock({ configs: [CONFIG], grants: [grant] });
    const router = new ProviderRouterService(prisma);

    const result = await router.select("REMITTANCE", { productType: "BANK_TRANSFER" }, "Remittance", "order_3");

    expect(result).toBeNull();
  });
});
