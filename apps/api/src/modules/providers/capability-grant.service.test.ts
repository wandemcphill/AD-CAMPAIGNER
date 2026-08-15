import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { CAPABILITY_LADDER, ProvidersService, type CapabilityRung } from "./providers.service";

/**
 * ProviderCapabilityGrant is the hard allowlist ProviderRouterService.select()
 * checks before routing any financial domain — a provider without an enabled
 * grant is treated as "no candidate" no matter how healthy its ProviderConfig
 * row looks. Nothing in the API could write this table before, so bringing a
 * provider live meant running SQL against production.
 *
 * These tests pin the two rules that make it safe to expose the table to admins:
 * the ladder can't be skipped, and revoking a rung can't leave a higher one
 * standing on it.
 */

const LADDER_BELOW_ENABLED = CAPABILITY_LADDER.filter((rung) => rung !== "enabled");

type GrantResult = Record<CapabilityRung, boolean> & { cascadedOff: CapabilityRung[] };

interface AuditCall {
  data: {
    action: string;
    entityType: string;
    metadata: {
      reason: string | null;
      previous: Record<CapabilityRung, boolean>;
      next: Record<CapabilityRung, boolean>;
      cascadedOff: CapabilityRung[];
    };
  };
}

function grantRow(overrides: Partial<Record<CapabilityRung, boolean>> = {}) {
  return {
    id: "grant_1",
    providerName: "fincra-remittance",
    capability: "REMITTANCE",
    domain: "REMITTANCE",
    priority: 100,
    currencies: [],
    countries: [],
    notes: null,
    updatedAt: new Date("2026-08-15T00:00:00Z"),
    ...Object.fromEntries(CAPABILITY_LADDER.map((rung) => [rung, false])),
    ...overrides
  };
}

describe("ProvidersService.updateCapabilityGrant", () => {
  let service: ProvidersService;
  let updateMock: ReturnType<typeof vi.fn>;
  let auditMock: ReturnType<typeof vi.fn>;
  let currentGrant: ReturnType<typeof grantRow>;

  const context = { userId: "user_admin" };

  beforeEach(() => {
    currentGrant = grantRow();
    updateMock = vi.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...currentGrant, ...data })
    );
    auditMock = vi.fn(() => Promise.resolve({}));

    const prisma = {
      client: {
        providerCapabilityGrant: {
          findUnique: vi.fn(() => Promise.resolve(currentGrant)),
          findMany: vi.fn(() => Promise.resolve([currentGrant])),
          update: updateMock
        },
        providerConfig: { findMany: vi.fn(() => Promise.resolve([])) },
        auditLog: { create: auditMock }
      }
    } as unknown as PrismaService;

    service = new ProvidersService(prisma);
  });

  it("refuses to enable a grant that has climbed no rungs", async () => {
    await expect(
      service.updateCapabilityGrant("grant_1", { enabled: true }, context)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("names every unmet step in the rejection, not just the first", async () => {
    currentGrant = grantRow({ documented: true, implemented: true });

    await expect(
      service.updateCapabilityGrant("grant_1", { enabled: true }, context)
    ).rejects.toThrow(/sandboxVerified.*kybApproved.*complianceApproved.*productionApproved/);
  });

  it("refuses to skip a single rung in the middle of the ladder", async () => {
    currentGrant = grantRow({ documented: true });

    await expect(
      service.updateCapabilityGrant("grant_1", { sandboxVerified: true }, context)
    ).rejects.toThrow(/implemented/);
  });

  it("allows enabling once every earlier step is met", async () => {
    currentGrant = grantRow(
      Object.fromEntries(LADDER_BELOW_ENABLED.map((rung) => [rung, true]))
    );

    const result = (await service.updateCapabilityGrant(
      "grant_1",
      { enabled: true },
      context
    )) as unknown as GrantResult;

    expect(result.enabled).toBe(true);
    expect((auditMock.mock.calls[0]![0] as AuditCall).data.action).toBe(
      "provider.capability_enabled"
    );
  });

  it("cascades a revocation upward instead of leaving a grant enabled on a withdrawn claim", async () => {
    currentGrant = grantRow(
      Object.fromEntries(CAPABILITY_LADDER.map((rung) => [rung, true]))
    );

    const result = (await service.updateCapabilityGrant(
      "grant_1",
      { sandboxVerified: false, reason: "sandbox credentials revoked by provider" },
      context
    )) as unknown as GrantResult;

    expect(result.enabled).toBe(false);
    expect(result.kybApproved).toBe(false);
    expect(result.complianceApproved).toBe(false);
    expect(result.productionApproved).toBe(false);
    // Rungs below the revoked one are untouched.
    expect(result.documented).toBe(true);
    expect(result.implemented).toBe(true);
    expect(result.cascadedOff).toEqual([
      "kybApproved",
      "complianceApproved",
      "productionApproved",
      "enabled"
    ]);
  });

  it("records the reason and the before/after ladder on every change", async () => {
    currentGrant = grantRow({ documented: true });

    await service.updateCapabilityGrant(
      "grant_1",
      { implemented: true, reason: "adapter merged in #412" },
      context
    );

    const audited = (auditMock.mock.calls[0]![0] as AuditCall).data;
    expect(audited.action).toBe("provider.capability_updated");
    expect(audited.entityType).toBe("ProviderCapabilityGrant");
    expect(audited.metadata.reason).toBe("adapter merged in #412");
    expect(audited.metadata.previous.implemented).toBe(false);
    expect(audited.metadata.next.implemented).toBe(true);
  });

  it("requires an authenticated admin", async () => {
    await expect(
      service.updateCapabilityGrant("grant_1", { documented: true }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s on an unknown grant id", async () => {
    const prisma = {
      client: {
        providerCapabilityGrant: { findUnique: vi.fn(() => Promise.resolve(null)) }
      }
    } as unknown as PrismaService;

    await expect(
      new ProvidersService(prisma).updateCapabilityGrant("nope", { documented: true }, context)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProvidersService.listCapabilityGrants", () => {
  it("reports a fully-climbed grant as not routable when no ProviderConfig row backs it", async () => {
    const grant = grantRow(Object.fromEntries(CAPABILITY_LADDER.map((r) => [r, true])));

    const prisma = {
      client: {
        providerCapabilityGrant: { findMany: vi.fn(() => Promise.resolve([grant])) },
        // No matching ProviderConfig — the router would find nothing to rank.
        providerConfig: { findMany: vi.fn(() => Promise.resolve([])) }
      }
    } as unknown as PrismaService;

    const [row] = await new ProvidersService(prisma).listCapabilityGrants();

    expect(row!.hasProviderConfig).toBe(false);
    expect(row!.routable).toBe(false);
    expect(row!.nextRung).toBeNull();
  });

  it("surfaces the next unmet rung so an operator knows what to earn", async () => {
    const grant = grantRow({ documented: true, implemented: true });

    const prisma = {
      client: {
        providerCapabilityGrant: { findMany: vi.fn(() => Promise.resolve([grant])) },
        providerConfig: {
          findMany: vi.fn(() =>
            Promise.resolve([{ name: "fincra-remittance", status: "HEALTHY" }])
          )
        }
      }
    } as unknown as PrismaService;

    const [row] = await new ProvidersService(prisma).listCapabilityGrants();

    expect(row!.nextRung).toBe("sandboxVerified");
    expect(row!.routable).toBe(false);
  });
});
