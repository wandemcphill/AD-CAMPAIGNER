/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { SettlementService } from "./settlement.service";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function buildQuote() {
  return {
    id: "fxq_1",
    status: "USED",
    baseCurrency: "NGN",
    quoteCurrency: "USD",
    sourceAmountMinor: 100_000n,
    customerRateMicros: 1_000_000n,
    spreadBps: 150,
    bufferBps: 100
  };
}

function buildDb(overrides: Record<string, unknown> = {}) {
  const wallet = { id: "wallet_1", workspaceId: "workspace_1", currency: "NGN" };

  const txClient = {
    wallet: { findUnique: vi.fn(() => Promise.resolve(wallet)) },
    settlementInstruction: {
      create: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve({ id: "settle_1", ...args.data })),
      update: vi.fn(() => Promise.resolve({}))
    },
    ledgerEntry: { create: vi.fn(() => Promise.resolve({ id: "le_1" })) }
  };

  return {
    fxQuote: { findUnique: vi.fn(() => Promise.resolve(buildQuote())) },
    settlementBeneficiary: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve({ id: "bene_1", ...args.data }))
    },
    wallet: { findUnique: vi.fn(() => Promise.resolve(wallet)) },
    settlementAlert: { create: vi.fn(() => Promise.resolve({ id: "alrt_1" })) },
    auditLog: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient)),
    ...overrides
  };
}

describe("SettlementService — KYC/KYB gating", () => {
  it("blocks settlement creation above the threshold with no beneficiary", async () => {
    const db = buildDb();
    const service = new SettlementService({ client: db } as unknown as PrismaService);

    await expect(
      service.createSettlementInstruction("fxq_1", {
        workspaceId: "workspace_1",
        partnerId: "partner_1",
        transactionId: "txn_1",
        destinationAmountMinor: 200_000,
        beneficiaryReference: "acct_123"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks settlement creation when the beneficiary is not KYC-verified", async () => {
    const db = buildDb({
      settlementBeneficiary: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: "bene_1", workspaceId: "workspace_1", kycStatus: "PENDING" })
        )
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);

    await expect(
      service.createSettlementInstruction("fxq_1", {
        workspaceId: "workspace_1",
        partnerId: "partner_1",
        beneficiaryId: "bene_1",
        transactionId: "txn_1",
        destinationAmountMinor: 200_000,
        beneficiaryReference: "acct_123"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks settlement creation when the beneficiary belongs to a different workspace", async () => {
    const db = buildDb({
      settlementBeneficiary: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: "bene_1", workspaceId: "workspace_OTHER", kycStatus: "VERIFIED" })
        )
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);

    await expect(
      service.createSettlementInstruction("fxq_1", {
        workspaceId: "workspace_1",
        partnerId: "partner_1",
        beneficiaryId: "bene_1",
        transactionId: "txn_1",
        destinationAmountMinor: 200_000,
        beneficiaryReference: "acct_123"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows settlement creation above the threshold with a verified beneficiary", async () => {
    const db = buildDb({
      settlementBeneficiary: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: "bene_1", workspaceId: "workspace_1", kycStatus: "VERIFIED" })
        )
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);

    const result = await service.createSettlementInstruction("fxq_1", {
      workspaceId: "workspace_1",
      partnerId: "partner_1",
      beneficiaryId: "bene_1",
      transactionId: "txn_1",
      destinationAmountMinor: 200_000,
      beneficiaryReference: "acct_123"
    });

    expect(result).toMatchObject({ workspaceId: "workspace_1" });
  });

  it("allows settlement creation below the threshold with no beneficiary on file", async () => {
    const db = buildDb();
    const service = new SettlementService({ client: db } as unknown as PrismaService);

    const result = await service.createSettlementInstruction("fxq_1", {
      workspaceId: "workspace_1",
      partnerId: "partner_1",
      transactionId: "txn_1",
      destinationAmountMinor: 50_000,
      beneficiaryReference: "acct_123"
    });

    expect(result).toMatchObject({ workspaceId: "workspace_1" });
  });
});

describe("SettlementService — alerting", () => {
  it("writes a CRITICAL alert when the provider rejects a submitted transfer", async () => {
    const db = buildDb({
      settlementInstruction: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: "settle_1",
            status: "PENDING",
            beneficiaryReference: "acct_123",
            workspaceId: "workspace_1",
            sourceAmountMinor: 100_000n,
            sourceCurrency: "NGN",
            destinationAmountMinor: 100_000n,
            destinationCurrency: "USD",
            fxRateMicros: 1_000_000n,
            idempotencyKey: "idem_1",
            metadata: {}
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);
    (service as unknown as { settlementProvider: unknown }).settlementProvider = {
      name: "mock",
      createTransfer: vi.fn(() =>
        Promise.resolve({
          id: "t1",
          source: { amount: 100_000n, currency: "NGN" },
          destination: { amount: 100_000n, currency: "USD" },
          beneficiary: { name: undefined, reference: "acct_123" },
          status: "FAILED",
          providerReference: "prov_ref_1",
          providerTimestamp: new Date(),
          errorReason: "Insufficient provider liquidity"
        })
      )
    };

    await service.submitSettlement("settle_1");

    expect(db.settlementAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementInstructionId: "settle_1",
          kind: "SETTLEMENT_FAILED",
          severity: "CRITICAL"
        })
      })
    );
  });

  it("writes a WARNING alert on reconciliation divergence", async () => {
    const db = buildDb({
      settlementInstruction: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: "settle_1",
            status: "SUBMITTED",
            providerReference: "prov_ref_1",
            providerStatus: "PROCESSING",
            workspaceId: "workspace_1",
            sourceCurrency: "NGN",
            destinationAmountMinor: 100_000n,
            submittedAt: new Date()
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      },
      settlementReconciliation: {
        upsert: vi.fn((args: { create: Record<string, unknown> }) => Promise.resolve(args.create))
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);
    (service as unknown as { settlementProvider: unknown }).settlementProvider = {
      name: "mock",
      getTransferStatus: vi.fn(() =>
        Promise.resolve({
          id: "t1",
          source: { amount: 100_000n, currency: "NGN" },
          destination: { amount: 90_000n, currency: "USD" }, // amount mismatch
          beneficiary: { name: undefined, reference: "acct_123" },
          status: "COMPLETED", // status mismatch vs PROCESSING
          providerReference: "prov_ref_1",
          providerTimestamp: new Date()
        })
      )
    };

    await service.reconcileSettlement("settle_1");

    expect(db.settlementAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementInstructionId: "settle_1",
          kind: "RECONCILIATION_DIVERGED",
          severity: "WARNING"
        })
      })
    );
  });

  it("posts CRITICAL alerts to the ops webhook when SETTLEMENT_ALERTS_WEBHOOK_URL is configured", async () => {
    process.env["SETTLEMENT_ALERTS_WEBHOOK_URL"] = "https://hooks.example.test/ops";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const db = buildDb({
      settlementInstruction: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: "settle_1",
            status: "PENDING",
            beneficiaryReference: "acct_123",
            workspaceId: "workspace_1",
            sourceAmountMinor: 100_000n,
            sourceCurrency: "NGN",
            destinationAmountMinor: 100_000n,
            destinationCurrency: "USD",
            fxRateMicros: 1_000_000n,
            idempotencyKey: "idem_1",
            metadata: {}
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);
    (service as unknown as { settlementProvider: unknown }).settlementProvider = {
      name: "mock",
      createTransfer: vi.fn(() =>
        Promise.resolve({
          id: "t1",
          source: { amount: 100_000n, currency: "NGN" },
          destination: { amount: 100_000n, currency: "USD" },
          beneficiary: { name: undefined, reference: "acct_123" },
          status: "FAILED",
          providerReference: "prov_ref_1",
          providerTimestamp: new Date(),
          errorReason: "Insufficient provider liquidity"
        })
      )
    };

    await service.submitSettlement("settle_1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.example.test/ops",
      expect.objectContaining({ method: "POST" })
    );
    fetchSpy.mockRestore();
  });

  it("does not throw when the ops webhook delivery itself fails", async () => {
    process.env["SETTLEMENT_ALERTS_WEBHOOK_URL"] = "https://hooks.example.test/ops";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const db = buildDb({
      settlementInstruction: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: "settle_1",
            status: "PENDING",
            beneficiaryReference: "acct_123",
            workspaceId: "workspace_1",
            sourceAmountMinor: 100_000n,
            sourceCurrency: "NGN",
            destinationAmountMinor: 100_000n,
            destinationCurrency: "USD",
            fxRateMicros: 1_000_000n,
            idempotencyKey: "idem_1",
            metadata: {}
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);
    (service as unknown as { settlementProvider: unknown }).settlementProvider = {
      name: "mock",
      createTransfer: vi.fn(() =>
        Promise.resolve({
          id: "t1",
          source: { amount: 100_000n, currency: "NGN" },
          destination: { amount: 100_000n, currency: "USD" },
          beneficiary: { name: undefined, reference: "acct_123" },
          status: "FAILED",
          providerReference: "prov_ref_1",
          providerTimestamp: new Date(),
          errorReason: "Insufficient provider liquidity"
        })
      )
    };

    await expect(service.submitSettlement("settle_1")).resolves.toBeDefined();
    fetchSpy.mockRestore();
  });

  it("does not write an alert when reconciliation is clean", async () => {
    const db = buildDb({
      settlementInstruction: {
        findUnique: vi.fn(() =>
          Promise.resolve({
            id: "settle_1",
            status: "SUBMITTED",
            providerReference: "prov_ref_1",
            providerStatus: "COMPLETED",
            workspaceId: "workspace_1",
            sourceCurrency: "NGN",
            destinationAmountMinor: 100_000n,
            submittedAt: new Date()
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      },
      settlementReconciliation: {
        upsert: vi.fn((args: { create: Record<string, unknown> }) => Promise.resolve(args.create))
      }
    });
    const service = new SettlementService({ client: db } as unknown as PrismaService);
    (service as unknown as { settlementProvider: unknown }).settlementProvider = {
      name: "mock",
      getTransferStatus: vi.fn(() =>
        Promise.resolve({
          id: "t1",
          source: { amount: 100_000n, currency: "NGN" },
          destination: { amount: 100_000n, currency: "USD" },
          beneficiary: { name: undefined, reference: "acct_123" },
          status: "COMPLETED",
          providerReference: "prov_ref_1",
          providerTimestamp: new Date()
        })
      )
    };

    await service.reconcileSettlement("settle_1");

    expect(db.settlementAlert.create).not.toHaveBeenCalled();
  });
});
