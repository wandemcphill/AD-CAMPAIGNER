import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { FxService } from "./fx.service";

const DEFAULT_SPREAD_BPS = 150;
const DEFAULT_BUFFER_BPS = 100;

/**
 * @param manualRate the single active FxRate row, or null for none
 * @param cachedRate a VALID, fresh FxRateCache row, or null for a cache miss
 */
function buildDb(
  manualRate: { id: string; rateMicros: bigint; bufferBps: number; spreadBps?: number } | null,
  cachedRate: { providerRateMicros: bigint } | null = null
) {
  const created: Record<string, unknown>[] = [];

  const db = {
    fxRateCache: {
      findFirst: vi.fn(() =>
        Promise.resolve(
          cachedRate ? { ...cachedRate, lastUpdatedAt: new Date(), validationStatus: "VALID" } : null
        )
      )
    },
    fxRate: {
      findFirst: vi.fn(() =>
        Promise.resolve(manualRate ? { ...manualRate, effectiveFrom: new Date() } : null)
      )
    },
    fxQuote: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve({ id: "fxq_1", ...args.data });
      })
    }
  };

  return { created, db };
}

function buildService(db: unknown) {
  return new FxService({ client: db } as unknown as PrismaService);
}

describe("FxService.createQuote", () => {
  const quoteRequest = {
    baseCurrency: "USD",
    quoteCurrency: "NGN",
    sourceAmountMinor: 100_000
  };

  it("does not apply the manual rate's buffer twice", async () => {
    const rowBufferBps = 100;
    const rawRateMicros = 1_000_000_000n;
    const { db } = buildDb({ id: "fxr_1", rateMicros: rawRateMicros, bufferBps: rowBufferBps });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    // The two margins are applied in sequence, so they compound rather than sum:
    // getActiveRate applies the row's buffer, then createQuote applies only the
    // spread (the buffer having already been accounted for).
    const buffered = (rawRateMicros * BigInt(10_000 + rowBufferBps)) / 10_000n;
    const expected = (buffered * BigInt(10_000 + DEFAULT_SPREAD_BPS)) / 10_000n;

    expect(quote.customerRateMicros).toBe(expected);

    // Guard against the regression this test exists for: the buffer being
    // charged a second time on top of the already-buffered rate.
    const doubleBuffered =
      (buffered * BigInt(10_000 + DEFAULT_SPREAD_BPS + DEFAULT_BUFFER_BPS)) / 10_000n;

    expect(quote.customerRateMicros).toBeLessThan(doubleBuffered);
  });

  it("applies the full buffer when the rate carries none of its own", async () => {
    const rawRateMicros = 1_000_000_000n;
    const { db } = buildDb({ id: "fxr_1", rateMicros: rawRateMicros, bufferBps: 0 });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.customerRateMicros).toBe(
      (rawRateMicros * BigInt(10_000 + DEFAULT_SPREAD_BPS + DEFAULT_BUFFER_BPS)) / 10_000n
    );
  });

  it("marks a cached provider rate as live", async () => {
    const { db } = buildDb(null, { providerRateMicros: 1_500_000_000n });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.rateProvenance).toBe("live");
  });

  it("marks a manual admin rate as manual", async () => {
    const { db } = buildDb({ id: "fxr_1", rateMicros: 1_000_000_000n, bufferBps: 0 });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.rateProvenance).toBe("manual");
  });

  it("flags the hardcoded bootstrap rate so it is never mistaken for a real one", async () => {
    const { db } = buildDb(null, null);

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.rateProvenance).toBe("bootstrap");
  });

  it("uses the admin-configured spread instead of the code default", async () => {
    const rawRateMicros = 1_000_000_000n;
    const { db } = buildDb({ id: "fxr_1", rateMicros: rawRateMicros, bufferBps: 0, spreadBps: 400 });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.spreadBps).toBe(400);
    expect(quote.customerRateMicros).toBe(
      (rawRateMicros * BigInt(10_000 + 400 + DEFAULT_BUFFER_BPS)) / 10_000n
    );
  });

  it("falls back to the default spread when the rate row sets none", async () => {
    const { db } = buildDb({ id: "fxr_1", rateMicros: 1_000_000_000n, bufferBps: 0 });

    const quote = await buildService(db).createQuote({} as never, quoteRequest);

    expect(quote.spreadBps).toBe(DEFAULT_SPREAD_BPS);
  });

  it("stamps the quote with the requesting workspace", async () => {
    const { created, db } = buildDb({ id: "fxr_1", rateMicros: 1_000_000_000n, bufferBps: 0 });

    await buildService(db).createQuote({ workspaceId: "ws_1" } as never, quoteRequest);

    expect(created[0]?.["workspaceId"]).toBe("ws_1");
  });
});

describe("FxService.useQuote", () => {
  function buildQuoteDb(workspaceId: string | null) {
    const update = vi.fn(() => Promise.resolve({}));

    return {
      update,
      db: {
        fxQuote: {
          findUnique: vi.fn(() =>
            Promise.resolve({
              id: "fxq_1",
              workspaceId,
              status: "ACTIVE",
              expiresAt: new Date(Date.now() + 60_000)
            })
          ),
          update
        }
      }
    };
  }

  it("refuses a quote belonging to another workspace", async () => {
    const { db, update } = buildQuoteDb("ws_1");

    await expect(buildService(db).useQuote("fxq_1", "txn_1", "ws_2")).rejects.toThrow(
      /not found/i
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a quote belonging to the caller's workspace", async () => {
    const { db, update } = buildQuoteDb("ws_1");

    await buildService(db).useQuote("fxq_1", "txn_1", "ws_1");

    expect(update).toHaveBeenCalled();
  });

  it("still accepts legacy quotes that predate workspace scoping", async () => {
    const { db, update } = buildQuoteDb(null);

    await buildService(db).useQuote("fxq_1", "txn_1", "ws_1");

    expect(update).toHaveBeenCalled();
  });
});
