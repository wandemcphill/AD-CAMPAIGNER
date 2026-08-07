import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { ProvidersService } from "./providers.service";

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      providerConfig: {
        findMany: vi.fn(() => Promise.resolve([])),
        findFirst: vi.fn(() => Promise.resolve(null)),
        update: vi.fn()
      },
      providerHealth: {
        findMany: vi.fn(() => Promise.resolve([]))
      },
      auditLog: {
        create: vi.fn(() => Promise.resolve({}))
      },
      ...overrides
    }
  } as unknown as PrismaService;
}

describe("ProvidersService registry", () => {
  it("returns an empty list when no ProviderConfig rows exist", async () => {
    const service = new ProvidersService(buildPrisma());

    await expect(service.listRegistry()).resolves.toEqual([]);
  });

  it("joins ProviderConfig rows with their latest ProviderHealth row", async () => {
    const config = {
      id: "pc_1",
      name: "clubkonnect",
      domain: "VTU",
      tier: "BUDGET",
      status: "HEALTHY",
      priority: 10,
      enabledCountries: [],
      enabledNetworks: [],
      enabledProductTypes: [],
      credentialsRef: "vault:clubkonnect",
      updatedAt: new Date("2026-01-01T00:00:00Z")
    };
    const health = {
      providerName: "clubkonnect",
      status: "HEALTHY",
      latencyMs: 120,
      successRateBps: 9800,
      balanceMinor: 500000,
      currency: "NGN",
      reason: null,
      checkedAt: new Date("2026-01-01T01:00:00Z")
    };
    const prisma = buildPrisma({
      providerConfig: {
        findMany: vi.fn(() => Promise.resolve([config])),
        findFirst: vi.fn(() => Promise.resolve(config)),
        update: vi.fn(() => Promise.resolve({ ...config, priority: 20 }))
      },
      providerHealth: {
        findMany: vi.fn(() => Promise.resolve([health]))
      }
    });
    const service = new ProvidersService(prisma);

    const result = await service.listRegistry();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "pc_1",
      name: "clubkonnect",
      domain: "VTU",
      priority: 10,
      health: { latencyMs: 120, successRateBps: 9800 }
    });
  });

  it("requires an authenticated admin to update a registry entry", async () => {
    const service = new ProvidersService(buildPrisma());

    await expect(
      service.updateRegistryEntry("pc_1", { priority: 5 }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects updates to a provider config that does not exist", async () => {
    const service = new ProvidersService(buildPrisma());

    await expect(
      service.updateRegistryEntry("pc_missing", { priority: 5 }, { userId: "user_1" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("writes an audit log entry when a registry entry is updated", async () => {
    const config = {
      id: "pc_1",
      name: "clubkonnect",
      domain: "VTU",
      status: "HEALTHY",
      priority: 10
    };
    const auditLogCreate = vi.fn(() => Promise.resolve({}));
    const prisma = buildPrisma({
      providerConfig: {
        findFirst: vi.fn(() => Promise.resolve(config)),
        update: vi.fn(() => Promise.resolve({ ...config, priority: 20 })),
        findMany: vi.fn(() => Promise.resolve([]))
      },
      auditLog: { create: auditLogCreate }
    });
    const service = new ProvidersService(prisma);

    await service.updateRegistryEntry("pc_1", { priority: 20 }, { userId: "user_1" });

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is typed `any` by vitest
        data: expect.objectContaining({
          action: "provider.registry_update",
          actorUserId: "user_1"
        })
      })
    );
  });
});
