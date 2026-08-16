import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FxService } from "../fx/fx.service";
import type { PrismaService } from "../prisma.service";
import type { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialProductsService } from "./financial-products.service";
import { FinancialReconciliationService } from "./financial-reconciliation.service";

/**
 * Deterministic integration test for the ambiguous-failure / no-blind-failover
 * invariant (financial governance §15/§16/§48/L):
 *
 *   request sent → response lost/timeout → outcome UNKNOWN
 *     → RECONCILIATION_REQUIRED (never FAILED)
 *     → reconciliation exception opened
 *     → NOT retried, NOT re-routed to a fallback provider
 *
 * A true provider-induced network timeout can't be reliably reproduced against
 * a live sandbox on demand, so this builds a deterministic fake at the
 * adapter/service boundary: `sendTransfer` throws a network-timeout-shaped
 * error, and we assert on exactly what the service does in response.
 */

const WORKSPACE_ID = "workspace_test";
const USER_ID = "user_test";

function buildFakeWallet() {
  return { id: "wallet_test", workspaceId: WORKSPACE_ID, currency: "NGN" };
}

// The quote row sendRemittance now reads its amounts from. Zeroed by default so
// the debit step passes against the empty fake ledger (0 required >= 0 available).
function buildFakeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    providerName: "fincra",
    providerQuoteId: "provider_q1",
    sourceCurrency: "NGN",
    sourceAmountMinor: 0,
    costMinor: 0,
    marginMinor: 0,
    destinationCurrency: "NGN",
    destinationAmountMinor: 0,
    feeMinor: 0,
    rate: 1,
    isLocked: true,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: null,
    transferId: null,
    ...overrides
  };
}

const SEND_INPUT = {
  quoteId: "q1",
  recipientName: "Test Recipient",
  recipientAccountNumber: "0690000032",
  recipientBankCode: "044",
  recipientCountry: "NG"
};

describe("FinancialProductsService.sendRemittance — ambiguous failure handling", () => {
  let remittanceTransferUpdate: ReturnType<typeof vi.fn>;
  let reconciliationUpsert: ReturnType<typeof vi.fn>;
  let sendTransferMock: ReturnType<typeof vi.fn>;
  let service: FinancialProductsService;

  beforeEach(() => {
    remittanceTransferUpdate = vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve({ id: "rt_test", ...args.data }));
    reconciliationUpsert = vi.fn((args: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: "exc_test", ...args.create })
    );

    const db = {
      $transaction: (fn: (tx: unknown) => unknown) => {
        const tx = {
          wallet: { findFirst: vi.fn(() => Promise.resolve(buildFakeWallet())) },
          ledgerEntry: {
            findMany: vi.fn(() => Promise.resolve([])), // empty ledger => 0 available...
            create: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: "ledger_debit", ...args.data })
            )
          },
          remittanceWalletCharge: {
            create: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: "charge_test", ...args.data })
            )
          },
          remittanceTransfer: {
            create: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({
                id: args.data["id"],
                chargeId: "charge_test",
                walletId: "wallet_test",
                sourceAmountMinor: args.data["sourceAmountMinor"],
                sourceCurrency: args.data["sourceCurrency"],
                ledgerEntryId: "ledger_debit"
              })
            )
          }
        };
        return fn(tx);
      },
      remittanceTransfer: { update: remittanceTransferUpdate },
      remittanceQuote: {
        findUnique: vi.fn(() => Promise.resolve(buildFakeQuote())),
        updateMany: vi.fn(() => Promise.resolve({ count: 1 }))
      },
      financialReconciliationException: { upsert: reconciliationUpsert },
      auditLog: { create: vi.fn() }
    };

    const prisma = { client: db } as unknown as PrismaService;
    const reconciliation = new FinancialReconciliationService(prisma);

    sendTransferMock = vi.fn(() => Promise.reject(new Error("connect ETIMEDOUT 10.0.0.1:443")));

    const fakeProvider = {
      name: "fincra",
      remittanceCapabilities: {
        supportsIndicativeRates: true,
        supportsLockedQuotes: true,
        supportsConversions: true,
        supportsPayouts: true,
        supportsBeneficiaries: true
      },
      sendTransfer: sendTransferMock,
      getQuote: vi.fn(),
      getTransferStatus: vi.fn()
    };

    const providerRouter = {
      // The name the router really returns is ProviderConfig.name, which the
      // seed writes with a domain suffix — not the bare vendor name. Stubbing
      // the bare name here is what let the resolution bug (config rows the
      // build*Adapter switches had no case for) pass CI; provider-name
      // resolution now has its own test in provider-name-resolution.test.ts.
      select: vi.fn(() => Promise.resolve({ providerName: "fincra-remittance" }))
    } as unknown as ProviderRouterService;

    service = new FinancialProductsService(prisma, providerRouter, reconciliation, {} as unknown as FxService);
    // buildRemittanceAdapter switches on providerName via env-config factories;
    // stub it directly so the test exercises only the ambiguous-failure path,
    // not real HTTP adapter construction.
    (service as unknown as { buildRemittanceAdapter: () => unknown }).buildRemittanceAdapter =
      () => fakeProvider;
  });

  it("marks the transfer RECONCILIATION_REQUIRED — never FAILED — on a timeout", async () => {
    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendTransferMock).toHaveBeenCalledTimes(1);

    // The transfer must land on RECONCILIATION_REQUIRED, not FAILED.
    expect(remittanceTransferUpdate).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }) })
    );
    expect(remittanceTransferUpdate).not.toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );

    // A reconciliation exception must be opened, keyed to this exact resource.
    expect(reconciliationUpsert).toHaveBeenCalledTimes(1);
    const upsertArgs = reconciliationUpsert.mock.calls[0]?.[0] as {
      create: { kind: string; providerName: string };
    };
    expect(upsertArgs.create.kind).toBe("AMBIGUOUS_PROVIDER_RESULT");
    expect(upsertArgs.create.providerName).toBe("fincra");

    // Critically: no second provider call, no fallback provider invoked.
    expect(sendTransferMock).toHaveBeenCalledTimes(1);
  });

  it("marks the transfer FAILED (not reconciliation) on a definitive pre-acceptance rejection", async () => {
    const rejectionError = Object.assign(new Error("Bad Request"), { status: 400 });
    sendTransferMock.mockRejectedValueOnce(rejectionError);

    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(remittanceTransferUpdate).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
    // A definitive rejection is provably a no-op — no reconciliation exception.
    expect(reconciliationUpsert).not.toHaveBeenCalled();
  });
});

/**
 * The send leg must take its amounts from the persisted quote, never from the
 * request body. Before this, SendRemittanceDto carried destinationAmountMinor,
 * feeMinor and rate straight through to the RemittanceTransfer row, so a client
 * could post any numbers it liked and have them recorded as what was quoted.
 */
describe("FinancialProductsService.sendRemittance — quote validation", () => {
  const OTHER_WORKSPACE = "workspace_other";

  function buildFundedLedger(balanceMinor: number) {
    if (balanceMinor <= 0) return [];
    const now = new Date();
    return [
      {
        id: "ledger_credit",
        walletId: "wallet_test",
        kind: "CREDIT",
        amountMinor: balanceMinor,
        currency: "NGN",
        reference: "topup",
        description: "Test float",
        idempotencyKey: "topup",
        sourceType: null,
        sourceId: null,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  function buildService(quoteRow: unknown, balanceMinor = 0) {
    const quoteFindUnique = vi.fn(() => Promise.resolve(quoteRow));
    const quoteUpdateMany = vi.fn(() => Promise.resolve({ count: 1 }));
    const transferCreate = vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: args.data["id"],
        chargeId: "charge_test",
        walletId: "wallet_test",
        sourceAmountMinor: args.data["sourceAmountMinor"],
        sourceCurrency: args.data["sourceCurrency"],
        ledgerEntryId: "ledger_debit",
        data: args.data
      })
    );

    const db = {
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({
          wallet: { findFirst: vi.fn(() => Promise.resolve(buildFakeWallet())) },
          ledgerEntry: {
            findMany: vi.fn(() => Promise.resolve(buildFundedLedger(balanceMinor))),
            create: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: "ledger_debit", ...args.data })
            )
          },
          remittanceWalletCharge: {
            create: vi.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({ id: "charge_test", ...args.data })
            )
          },
          remittanceTransfer: { create: transferCreate }
        }),
      remittanceTransfer: { update: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve(args.data)) },
      remittanceQuote: { findUnique: quoteFindUnique, updateMany: quoteUpdateMany },
      financialReconciliationException: { upsert: vi.fn() },
      auditLog: { create: vi.fn() }
    };

    const prisma = { client: db } as unknown as PrismaService;
    const sendTransfer = vi.fn((_input: Record<string, unknown>) =>
      Promise.resolve({ providerReference: "prov_ref", status: "PROCESSING" })
    );

    const service = new FinancialProductsService(
      prisma,
      { select: vi.fn() } as unknown as ProviderRouterService,
      new FinancialReconciliationService(prisma),
      {} as unknown as FxService
    );
    (service as unknown as { buildRemittanceAdapter: () => unknown }).buildRemittanceAdapter = () => ({
      name: "fincra",
      remittanceCapabilities: {
        supportsIndicativeRates: true,
        supportsLockedQuotes: true,
        supportsConversions: true,
        supportsPayouts: true,
        supportsBeneficiaries: true
      },
      sendTransfer,
      getQuote: vi.fn(),
      getTransferStatus: vi.fn()
    });

    return { service, sendTransfer, transferCreate, quoteUpdateMany };
  }

  it("persists the quote's amounts, not anything the client could have supplied", async () => {
    const { service, sendTransfer, transferCreate } = buildService(
      buildFakeQuote({
        sourceAmountMinor: 102_000,
        costMinor: 100_000,
        marginMinor: 2_000,
        destinationCurrency: "USD",
        destinationAmountMinor: 6_500,
        feeMinor: 500,
        rate: 1_540
      }),
      200_000
    );

    await service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT);

    const persisted = transferCreate.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(persisted["sourceAmountMinor"]).toBe(102_000);
    expect(persisted["destinationAmountMinor"]).toBe(6_500);
    expect(persisted["feeMinor"]).toBe(500);
    expect(persisted["quotedRate"]).toBe(1_540);
    expect(persisted["marginMinor"]).toBe(2_000);
    // quoteId is now our row; the provider's id is kept beside it.
    expect(persisted["quoteId"]).toBe("q1");
    expect(persisted["providerQuoteId"]).toBe("provider_q1");

    // The provider is instructed to send the cost leg only — the margin stays.
    const sent = sendTransfer.mock.calls[0]?.[0];
    expect(sent?.["amountMinor"]).toBe(100_000);
    expect(sent?.["quoteId"]).toBe("provider_q1");
  });

  it("rejects a quote belonging to another workspace as not-found", async () => {
    const { service, sendTransfer } = buildService(
      buildFakeQuote({ workspaceId: OTHER_WORKSPACE })
    );

    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(sendTransfer).not.toHaveBeenCalled();
  });

  it("rejects an expired quote", async () => {
    const { service, sendTransfer } = buildService(
      buildFakeQuote({ expiresAt: new Date(Date.now() - 1_000) })
    );

    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendTransfer).not.toHaveBeenCalled();
  });

  it("rejects a quote that has already been consumed", async () => {
    const { service, sendTransfer } = buildService(buildFakeQuote({ status: "USED" }));

    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendTransfer).not.toHaveBeenCalled();
  });

  it("rejects the loser when two sends race for the same quote", async () => {
    const { service, sendTransfer, quoteUpdateMany } = buildService(buildFakeQuote());
    // Both callers read an ACTIVE row; the conditional update is what separates
    // them, so the loser sees no rows affected.
    quoteUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.sendRemittance({ userId: USER_ID, workspaceId: WORKSPACE_ID }, SEND_INPUT)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendTransfer).not.toHaveBeenCalled();
  });
});
