/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FxService } from "../fx/fx.service";
import type { PrismaService } from "../prisma.service";
import type { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialProductsService } from "./financial-products.service";
import { FinancialReconciliationService } from "./financial-reconciliation.service";

/**
 * Covers the HOLD -> (RELEASE+DEBIT | RELEASE | left-HOLD) ledger discipline
 * for FinancialProductsService.requestWithdrawal — the highest-risk code path
 * in the wallet-withdrawal feature (real FlipTrybe money leaving, not a
 * third-party recipient's). Mirrors the deterministic-fake approach in
 * financial-products.service.test.ts (sendRemittance ambiguous-failure suite).
 */

const WORKSPACE_ID = "workspace_test";
const USER_ID = "user_test";

function buildFakeWallet() {
  return { id: "wallet_test", workspaceId: WORKSPACE_ID, currency: "NGN" };
}

function buildHarness() {
  const ledgerEntryCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `ledger_${String(args.data["kind"]).toLowerCase()}_${Math.random()}`, ...args.data })
  );
  const walletWithdrawalCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...args.data })
  );
  const walletWithdrawalUpdate = vi.fn((args: { where: { id: string }; data: Record<string, unknown> }) =>
    Promise.resolve({ id: args.where.id, ...args.data })
  );
  const reconciliationUpsert = vi.fn((args: { create: Record<string, unknown> }) =>
    Promise.resolve({ id: "exc_test", ...args.create })
  );

  const tx = {
    wallet: { findFirst: vi.fn(() => Promise.resolve(buildFakeWallet())) },
    ledgerEntry: {
      findMany: vi.fn(() => Promise.resolve([])), // empty ledger => 0 available, so amountMinor must be 0 to pass
      create: ledgerEntryCreate
    },
    walletWithdrawal: {
      create: walletWithdrawalCreate,
      update: walletWithdrawalUpdate
    }
  };

  const db = {
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    walletWithdrawal: { update: walletWithdrawalUpdate },
    financialReconciliationException: { upsert: reconciliationUpsert },
    auditLog: { create: vi.fn() }
  };

  const prisma = { client: db } as unknown as PrismaService;
  const reconciliation = new FinancialReconciliationService(prisma);

  const providerRouter = {
    select: vi.fn(() => Promise.resolve({ providerName: "swappr" }))
  } as unknown as ProviderRouterService;

  return { ledgerEntryCreate, walletWithdrawalCreate, walletWithdrawalUpdate, reconciliationUpsert, prisma, reconciliation, providerRouter };
}

function buildService(
  harness: ReturnType<typeof buildHarness>,
  sendTransferImpl: () => Promise<unknown>
) {
  const service = new FinancialProductsService(
    harness.prisma,
    harness.providerRouter,
    harness.reconciliation,
    {} as unknown as FxService
  );
  const sendTransferMock = vi.fn((..._args: unknown[]) => sendTransferImpl());
  const fakeProvider = {
    name: "swappr",
    remittanceCapabilities: {
      supportsIndicativeRates: true,
      supportsLockedQuotes: false,
      supportsConversions: true,
      supportsPayouts: true,
      supportsBeneficiaries: true
    },
    sendTransfer: sendTransferMock,
    getQuote: vi.fn(),
    getTransferStatus: vi.fn()
  };
  (service as unknown as { buildRemittanceAdapter: () => unknown }).buildRemittanceAdapter = () => fakeProvider;
  return { service, sendTransferMock };
}

const dto = {
  amountMinor: 0, // 0 required <= available (0) so the HOLD step passes with an empty ledger
  recipientName: "Test Recipient",
  recipientAccountNumber: "0690000032",
  recipientBankCode: "044"
};

describe("FinancialProductsService.requestWithdrawal", () => {
  let harness: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    harness = buildHarness();
  });

  it("on confirmed COMPLETED: releases the HOLD and books a DEBIT", async () => {
    const { service } = buildService(harness, () =>
      Promise.resolve({ providerReference: "swappr_ref_1", status: "COMPLETED" })
    );

    const result = (await service.requestWithdrawal(
      { userId: USER_ID, workspaceId: WORKSPACE_ID },
      dto
    )) as { status: string };

    expect(result.status).toBe("COMPLETED");
    expect(harness.walletWithdrawalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );

    const kinds = harness.ledgerEntryCreate.mock.calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data["kind"]
    );
    expect(kinds).toEqual(["HOLD", "RELEASE", "DEBIT"]);
    expect(harness.reconciliationUpsert).not.toHaveBeenCalled();
  });

  it("on confirmed FAILED: releases the HOLD, books no DEBIT", async () => {
    const { service } = buildService(harness, () =>
      Promise.resolve({ providerReference: "swappr_ref_2", status: "FAILED" })
    );

    const result = (await service.requestWithdrawal(
      { userId: USER_ID, workspaceId: WORKSPACE_ID },
      dto
    )) as { status: string };

    expect(result.status).toBe("FAILED");
    const kinds = harness.ledgerEntryCreate.mock.calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data["kind"]
    );
    expect(kinds).toEqual(["HOLD", "RELEASE"]);
    expect(harness.reconciliationUpsert).not.toHaveBeenCalled();
  });

  it("on an ambiguous/timeout provider error: leaves the HOLD in place and opens a reconciliation exception (never FAILED, never retried)", async () => {
    const { service, sendTransferMock } = buildService(harness, () =>
      Promise.reject(new Error("connect ETIMEDOUT 10.0.0.1:443"))
    );

    await expect(
      service.requestWithdrawal({ userId: USER_ID, workspaceId: WORKSPACE_ID }, dto)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendTransferMock).toHaveBeenCalledTimes(1);

    // Only the HOLD entry was created — no RELEASE, no DEBIT.
    const kinds = harness.ledgerEntryCreate.mock.calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data["kind"]
    );
    expect(kinds).toEqual(["HOLD"]);

    expect(harness.walletWithdrawalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }) })
    );
    expect(harness.walletWithdrawalUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );

    expect(harness.reconciliationUpsert).toHaveBeenCalledTimes(1);
    const upsertArgs = harness.reconciliationUpsert.mock.calls[0]?.[0] as {
      create: { kind: string; providerName: string };
    };
    expect(upsertArgs.create.kind).toBe("AMBIGUOUS_PROVIDER_RESULT");
    expect(upsertArgs.create.providerName).toBe("swappr");

    // Never a second provider call — no blind retry, no fallback provider.
    expect(sendTransferMock).toHaveBeenCalledTimes(1);
  });

  it("on a definitive pre-acceptance rejection (4xx): releases the HOLD and marks FAILED, no reconciliation exception", async () => {
    const rejectionError = Object.assign(new Error("Bad Request"), { status: 400 });
    const { service } = buildService(harness, () => Promise.reject(rejectionError));

    await expect(
      service.requestWithdrawal({ userId: USER_ID, workspaceId: WORKSPACE_ID }, dto)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(harness.walletWithdrawalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
    expect(harness.reconciliationUpsert).not.toHaveBeenCalled();

    const kinds = harness.ledgerEntryCreate.mock.calls.map(
      (call) => (call[0] as { data: Record<string, unknown> }).data["kind"]
    );
    expect(kinds).toEqual(["HOLD", "RELEASE"]);
  });

  it("reuses the same idempotencyKey for the debit step and the provider call", async () => {
    const { service, sendTransferMock } = buildService(harness, () =>
      Promise.resolve({ providerReference: "swappr_ref_3", status: "COMPLETED" })
    );

    await service.requestWithdrawal({ userId: USER_ID, workspaceId: WORKSPACE_ID }, dto);

    const holdCall = harness.ledgerEntryCreate.mock.calls.find(
      (call) => (call[0] as { data: Record<string, unknown> }).data["kind"] === "HOLD"
    );
    const holdIdempotencyKey = (holdCall?.[0] as { data: Record<string, unknown> }).data["idempotencyKey"];
    const sendTransferArgs = sendTransferMock.mock.calls[0]?.[0] as { idempotencyKey: string };

    expect(holdIdempotencyKey).toBeTruthy();
    expect(sendTransferArgs.idempotencyKey).toBe(holdIdempotencyKey);
  });

  it("rejects when neither beneficiaryId nor full inline recipient details are supplied", async () => {
    const { service } = buildService(harness, () =>
      Promise.resolve({ providerReference: "unused", status: "COMPLETED" })
    );

    await expect(
      service.requestWithdrawal(
        { userId: USER_ID, workspaceId: WORKSPACE_ID },
        { amountMinor: 0 }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
