import { describe, expect, it, vi } from "vitest";

import { ManagedAdsService } from "./managed-ads.service";
import type { PrismaService } from "./prisma.service";
import type { NotificationsService } from "./notifications/notifications.service";

/**
 * F-08 (production audit): lockWallet/lockPaymentIntent guard their
 * `SELECT ... FOR UPDATE` with `if (tx.$queryRaw)`, which raised the
 * question of whether that guard could silently skip pessimistic locking.
 *
 * It cannot in production. `$queryRaw` is declared directly on Prisma's
 * generated client class (packages/database/generated/client/internal/class.ts)
 * and is present on every interactive-transaction client Prisma hands to a
 * `$transaction(async (tx) => ...)` callback — the only client type this
 * code ever actually receives outside a test. The guard exists solely so
 * lightweight unit-test doubles that omit `$queryRaw` (most of
 * managed-ads.service.spec.ts's shared `createService()` transaction mock
 * does stub it — see the `$queryRaw: vi.fn()` in its `$transaction` callback,
 * confirming the codebase's own tests already treat it as present) don't
 * crash calling a method their fake object never implemented.
 *
 * These tests pin the actual behavior directly, independent of that shared
 * fixture, so a future refactor can't quietly turn the guard into a real gap.
 */
function createServiceForLockTests() {
  const notifications = { send: vi.fn(() => Promise.resolve([])) } as unknown as NotificationsService;
  // lockWallet/lockPaymentIntent only ever touch the `tx` argument passed to
  // them directly, never `this.db` — an empty client is sufficient here.
  return new ManagedAdsService({ client: {} } as unknown as PrismaService, notifications);
}

describe("ManagedAdsService wallet/payment-intent row locking (F-08)", () => {
  it("lockWallet issues a SELECT ... FOR UPDATE on the Wallet row when $queryRaw is present", async () => {
    const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<void>>(
      () => Promise.resolve()
    );
    const service = createServiceForLockTests() as unknown as {
      lockWallet: (tx: { $queryRaw: typeof queryRaw }, walletId: string) => Promise<void>;
    };

    await service.lockWallet({ $queryRaw: queryRaw }, "wallet_123");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = queryRaw.mock.calls[0]!;
    const sql = strings.join("?");
    expect(sql).toContain('FROM "Wallet"');
    expect(sql).toContain("FOR UPDATE");
    expect(values).toContain("wallet_123");
  });

  it("lockPaymentIntent issues a SELECT ... FOR UPDATE on the PaymentIntent row when $queryRaw is present", async () => {
    const queryRaw = vi.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<void>>(
      () => Promise.resolve()
    );
    const service = createServiceForLockTests() as unknown as {
      lockPaymentIntent: (tx: { $queryRaw: typeof queryRaw }, intentId: string) => Promise<void>;
    };

    await service.lockPaymentIntent({ $queryRaw: queryRaw }, "intent_456");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = queryRaw.mock.calls[0]!;
    const sql = strings.join("?");
    expect(sql).toContain('FROM "PaymentIntent"');
    expect(sql).toContain("FOR UPDATE");
    expect(values).toContain("intent_456");
  });

  it("does not throw when $queryRaw is genuinely absent from the tx object (test-double accommodation only)", async () => {
    // This is the guard's only real effect: it lets a bare-bones test double
    // stand in for `tx` without implementing every Prisma client method.
    // Every real PrismaClient — including its transaction client — always
    // has $queryRaw, so this branch is unreachable in production.
    const service = createServiceForLockTests() as unknown as {
      lockWallet: (tx: Record<string, never>, walletId: string) => Promise<void>;
    };

    await expect(service.lockWallet({}, "wallet_123")).resolves.toBeUndefined();
  });
});
