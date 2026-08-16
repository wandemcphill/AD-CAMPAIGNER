import { describe, expect, it, vi } from "vitest";

import type { FxService } from "../fx/fx.service";
import type { PrismaService } from "../prisma.service";
import type { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialProductsService } from "./financial-products.service";
import type { FinancialReconciliationService } from "./financial-reconciliation.service";

/**
 * A USD card is funded from an NGN wallet, so the load has to be converted
 * before the wallet is touched.
 *
 * Before this, issueCard compared the USD cents figure straight against the NGN
 * balance and wrote a DEBIT of that figure tagged `currency: "USD"` onto the NGN
 * wallet — a $50 card was charged as ₦50. Nothing caught it because no test
 * asserted the debit's amount or currency, only that a card came back.
 */

const WORKSPACE_ID = "workspace_test";
const RATE = 1_600; // ₦1,600 per $1

function buildHarness(opts: { balanceMinor: number; cardCurrency: string }) {
  const ledgerCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "ledger_1", ...args.data })
  );
  const chargeCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "charge_1", ...args.data })
  );
  const cardCreate = vi.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: args.data["id"],
      chargeId: "charge_1",
      walletId: "wallet_1",
      ledgerEntryId: "ledger_1",
      currency: args.data["currency"]
    })
  );

  const now = new Date();
  const ledgerRows =
    opts.balanceMinor > 0
      ? [
          {
            id: "credit_1",
            walletId: "wallet_1",
            kind: "CREDIT",
            amountMinor: opts.balanceMinor,
            currency: "NGN",
            reference: "float",
            description: "float",
            idempotencyKey: "float",
            sourceType: null,
            sourceId: null,
            createdAt: now,
            updatedAt: now
          }
        ]
      : [];

  const tx = {
    wallet: {
      findFirst: vi.fn(() =>
        Promise.resolve({ id: "wallet_1", workspaceId: WORKSPACE_ID, currency: "NGN" })
      )
    },
    ledgerEntry: { findMany: vi.fn(() => Promise.resolve(ledgerRows)), create: ledgerCreate },
    virtualCardWalletCharge: { create: chargeCreate }
  };

  const db = {
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    providerCustomer: {
      findUnique: vi.fn(() =>
        Promise.resolve({ providerCustomerId: "cus_1", status: "ACTIVE", tier: "2" })
      )
    },
    virtualCard: { create: cardCreate, update: vi.fn((a: unknown) => Promise.resolve(a)) },
    pricingRule: { findMany: vi.fn(() => Promise.resolve([])) }
  };

  // Converts USD cents -> NGN kobo at RATE, mirroring FxService.createQuote's
  // contract (resultAmountMinor in the quote currency).
  const createQuote = vi.fn((_ctx: unknown, dto: { sourceAmountMinor: number }) =>
    Promise.resolve({
      quoteId: "fxq_1",
      resultAmountMinor: dto.sourceAmountMinor * RATE,
      customerRateMicros: BigInt(RATE) * 1_000_000n,
      rateProvenance: "live"
    })
  );
  const useQuote = vi.fn(() => Promise.resolve());

  const service = new FinancialProductsService(
    { client: db } as unknown as PrismaService,
    {
      select: vi.fn(() => Promise.resolve({ providerName: "payscribe-virtual-card" }))
    } as unknown as ProviderRouterService,
    {} as unknown as FinancialReconciliationService,
    { createQuote, useQuote } as unknown as FxService
  );

  const issueCardMock = vi.fn((_input: Record<string, unknown>) =>
    Promise.resolve({
      providerCardId: "card_1",
      last4: "4242",
      expiryMonth: 12,
      expiryYear: 2030,
      brand: "VISA",
      currency: opts.cardCurrency,
      status: "ACTIVE" as const
    })
  );

  (service as unknown as { buildCardAdapter: () => unknown }).buildCardAdapter = () => ({
    name: "payscribe",
    issueCard: issueCardMock,
    enrollCustomer: vi.fn()
  });

  return { service, ledgerCreate, chargeCreate, createQuote, useQuote, issueCardMock };
}

describe("USD card funded from an NGN wallet", () => {
  const ctx = { userId: "u1", workspaceId: WORKSPACE_ID };

  it("debits the converted naira cost, not the raw USD figure", async () => {
    // $50 requested; wallet holds ₦100,000 — far more than 5,000 kobo but far
    // less than the ₦80,000 the card actually costs.
    const h = buildHarness({ balanceMinor: 100_000_00, cardCurrency: "USD" });

    await h.service.issueCard(ctx, {
      cardholderName: "Jane Doe",
      currency: "USD",
      fundingAmountMinor: 5_000
    });

    const debit = h.ledgerCreate.mock.calls[0]?.[0].data as Record<string, unknown>;
    // 5,000 cents * 1,600 = 8,000,000 kobo = ₦80,000.
    expect(debit["amountMinor"]).toBe(8_000_000);
    // The wallet is NGN — tagging this entry USD made the ledger unreconcilable.
    expect(debit["currency"]).toBe("NGN");
  });

  it("tells the provider the USD amount, not the naira one", async () => {
    const h = buildHarness({ balanceMinor: 100_000_00, cardCurrency: "USD" });

    await h.service.issueCard(ctx, {
      cardholderName: "Jane Doe",
      currency: "USD",
      fundingAmountMinor: 5_000
    });

    const sent = h.issueCardMock.mock.calls[0]?.[0];
    expect(sent?.["fundingAmountMinor"]).toBe(5_000);
    expect(sent?.["currency"]).toBe("USD");
  });

  it("rejects when the naira balance cannot cover the converted cost", async () => {
    // ₦10,000 looks like plenty against "5000" but cannot buy $50.
    const h = buildHarness({ balanceMinor: 10_000_00, cardCurrency: "USD" });

    await expect(
      h.service.issueCard(ctx, {
        cardholderName: "Jane Doe",
        currency: "USD",
        fundingAmountMinor: 5_000
      })
    ).rejects.toThrow(/Insufficient balance/);
  });

  it("marks the FX quote used once the card is issued", async () => {
    const h = buildHarness({ balanceMinor: 100_000_00, cardCurrency: "USD" });

    await h.service.issueCard(ctx, {
      cardholderName: "Jane Doe",
      currency: "USD",
      fundingAmountMinor: 5_000
    });

    expect(h.useQuote).toHaveBeenCalledWith("fxq_1", expect.any(String), WORKSPACE_ID);
  });

  it("does not create an FX quote for an NGN card", async () => {
    const h = buildHarness({ balanceMinor: 100_000_00, cardCurrency: "NGN" });

    await h.service.issueCard(ctx, {
      cardholderName: "Jane Doe",
      currency: "NGN",
      fundingAmountMinor: 500_000
    });

    expect(h.createQuote).not.toHaveBeenCalled();
    const debit = h.ledgerCreate.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(debit["amountMinor"]).toBe(500_000);
    expect(debit["currency"]).toBe("NGN");
  });

  it("refuses to price a card off a bootstrap rate", async () => {
    const h = buildHarness({ balanceMinor: 100_000_00, cardCurrency: "USD" });
    // A bootstrap rate is a hardcoded constant, not a market rate — charging
    // real naira against it would invent a price.
    h.createQuote.mockResolvedValueOnce({
      quoteId: "fxq_boot",
      resultAmountMinor: 8_000_000,
      customerRateMicros: BigInt(RATE) * 1_000_000n,
      rateProvenance: "bootstrap"
    });

    await expect(
      h.service.issueCard(ctx, {
        cardholderName: "Jane Doe",
        currency: "USD",
        fundingAmountMinor: 5_000
      })
    ).rejects.toThrow(/cannot be priced/);
  });
});
