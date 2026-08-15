import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

    service = new FinancialProductsService(prisma, providerRouter, reconciliation);
    // buildRemittanceAdapter switches on providerName via env-config factories;
    // stub it directly so the test exercises only the ambiguous-failure path,
    // not real HTTP adapter construction.
    (service as unknown as { buildRemittanceAdapter: () => unknown }).buildRemittanceAdapter =
      () => fakeProvider;
  });

  it("marks the transfer RECONCILIATION_REQUIRED — never FAILED — on a timeout", async () => {
    await expect(
      service.sendRemittance(
        { userId: USER_ID, workspaceId: WORKSPACE_ID },
        {
          quoteId: "q1",
          recipientName: "Test Recipient",
          recipientAccountNumber: "0690000032",
          recipientBankCode: "044",
          recipientCountry: "NG",
          sourceAmountMinor: 0, // 0 required >= available (0) so debit step passes
          sourceCurrency: "NGN",
          destinationAmountMinor: 0,
          destinationCurrency: "NGN",
          feeMinor: 0
        }
      )
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
      service.sendRemittance(
        { userId: USER_ID, workspaceId: WORKSPACE_ID },
        {
          quoteId: "q1",
          recipientName: "Test Recipient",
          recipientAccountNumber: "0690000032",
          recipientBankCode: "044",
          recipientCountry: "NG",
          sourceAmountMinor: 0,
          sourceCurrency: "NGN",
          destinationAmountMinor: 0,
          destinationCurrency: "NGN",
          feeMinor: 0
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(remittanceTransferUpdate).toHaveBeenCalledWith(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
    // A definitive rejection is provably a no-op — no reconciliation exception.
    expect(reconciliationUpsert).not.toHaveBeenCalled();
  });
});
