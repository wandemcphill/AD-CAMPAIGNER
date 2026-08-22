import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "./prisma.service";
import type { NotificationsService } from "./notifications/notifications.service";
import { AuthSessionService } from "./auth-session.service";

/**
 * Password reset is the one unauthenticated path that can hand over an account,
 * so the invariants pinned here are the security properties, not the happy path:
 *
 *   - the response never reveals whether an account exists
 *   - only the token HASH is persisted
 *   - a token works exactly once
 *   - expired tokens are refused
 *   - issuing a new token kills outstanding ones
 *   - a successful reset revokes every existing session
 */

const USER = {
  id: "user_1",
  username: "operator",
  email: "operator@example.com",
  name: "Operator",
  displayName: "Operator"
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createHarness({
  user = USER,
  recentCount = 0
}: { user?: typeof USER | null; recentCount?: number } = {}) {
  const tokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }> = [];

  const sessionUpdateMany = vi.fn((_args: { where: { userId: string; revokedAt: null } }) =>
    Promise.resolve({ count: 2 })
  );
  const userUpdate = vi.fn((_args: { where: { id: string }; data: { passwordHash: string } }) =>
    Promise.resolve(
      user ? { id: user.id, email: user.email, name: user.name, displayName: user.displayName } : {}
    )
  );
  const invalidateMany = vi.fn((args: { where: { userId: string } }) => {
    for (const t of tokens) {
      if (t.userId === args.where.userId && !t.usedAt) t.usedAt = new Date();
    }
    return Promise.resolve({ count: 0 });
  });

  const passwordResetToken = {
    count: vi.fn(() => Promise.resolve(recentCount)),
    updateMany: vi.fn((args: { where: { id?: string; userId?: string; usedAt: null }; data: { usedAt: Date } }) => {
      if (args.where.id) {
        const row = tokens.find((t) => t.id === args.where.id && !t.usedAt);
        if (!row) return Promise.resolve({ count: 0 });
        row.usedAt = args.data.usedAt;
        return Promise.resolve({ count: 1 });
      }
      return invalidateMany(args as { where: { userId: string } });
    }),
    create: vi.fn((args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
      const row = { id: `prt_${tokens.length + 1}`, usedAt: null, ...args.data };
      tokens.push(row);
      return Promise.resolve(row);
    }),
    findUnique: vi.fn((args: { where: { tokenHash: string } }) =>
      Promise.resolve(tokens.find((t) => t.tokenHash === args.where.tokenHash) ?? null)
    )
  };

  const db = {
    user: { findFirst: vi.fn(() => Promise.resolve(user)), update: userUpdate },
    passwordResetToken,
    session: { updateMany: sessionUpdateMany },
    $transaction: (fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({ passwordResetToken, user: { update: userUpdate }, session: { updateMany: sessionUpdateMany } })
      )
  };

  // Broad enough to cover both calls this harness observes: the reset-request
  // email (template "password_reset", vars.reference) and the post-reset
  // confirmation (template "security_alert", userId + idempotencyKey).
  const send = vi.fn(
    (_input: {
      template: string;
      channels: string[];
      userId?: string;
      idempotencyKey?: string;
      vars: Record<string, string>;
    }) => Promise.resolve([])
  );
  const notifications = { send } as unknown as NotificationsService;
  const service = new AuthSessionService({ client: db } as unknown as PrismaService, notifications);

  return { service, tokens, send, sessionUpdateMany, userUpdate, passwordResetToken };
}

function sentResetToken(send: ReturnType<typeof vi.fn>) {
  const call = send.mock.calls[0]?.[0] as { vars: { reference: string } } | undefined;
  const url = call?.vars.reference ?? "";
  return decodeURIComponent(url.split("token=")[1] ?? "");
}

describe("password reset — request", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://app.fliptrybe.com";
  });

  it("returns the same acknowledgement whether or not the account exists", async () => {
    const found = createHarness();
    const missing = createHarness({ user: null });

    const a = await found.service.requestPasswordReset("operator");
    const b = await missing.service.requestPasswordReset("ghost");

    expect(a).toEqual(b);
    expect(missing.send).not.toHaveBeenCalled();
  });

  it("sends nothing for an account with no email address", async () => {
    const h = createHarness({ user: { ...USER, email: null } as unknown as typeof USER });
    await h.service.requestPasswordReset("operator");
    expect(h.send).not.toHaveBeenCalled();
  });

  it("stores only the hash of the token, never the token itself", async () => {
    const h = createHarness();
    await h.service.requestPasswordReset("operator");

    const token = sentResetToken(h.send);
    expect(token).not.toHaveLength(0);
    expect(h.tokens[0]?.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(h.tokens)).not.toContain(token);
  });

  it("emails a link pointing at APP_URL/reset-password", async () => {
    const h = createHarness();
    await h.service.requestPasswordReset("operator");

    const call = h.send.mock.calls[0]?.[0] as { template: string; channels: string[]; vars: { reference: string } };
    expect(call.template).toBe("password_reset");
    expect(call.channels).toEqual(["EMAIL"]);
    expect(call.vars.reference).toContain("https://app.fliptrybe.com/reset-password?token=");
  });

  it("silently stops issuing once the per-user window limit is hit", async () => {
    const h = createHarness({ recentCount: 3 });
    const result = await h.service.requestPasswordReset("operator");

    expect(h.send).not.toHaveBeenCalled();
    expect(result.ok).toBe(true); // still indistinguishable to the caller
  });

  it("invalidates outstanding tokens when a new one is issued", async () => {
    const h = createHarness();
    await h.service.requestPasswordReset("operator");
    const first = sentResetToken(h.send);

    await h.service.requestPasswordReset("operator");

    expect(h.tokens.find((t) => t.tokenHash === sha256(first))?.usedAt).not.toBeNull();
  });

  it("rejects an empty identifier", async () => {
    const h = createHarness();
    await expect(h.service.requestPasswordReset("   ")).rejects.toThrow(BadRequestException);
  });
});

describe("password reset — confirm", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://app.fliptrybe.com";
  });

  async function issued() {
    const h = createHarness();
    await h.service.requestPasswordReset("operator");
    return { h, token: sentResetToken(h.send) };
  }

  it("sets the new password and revokes every existing session", async () => {
    const { h, token } = await issued();

    const result: { ok: true } = await h.service.resetPassword(token, "brand-new-password");

    expect(result).toEqual({ ok: true });
    expect(h.userUpdate).toHaveBeenCalled();

    const revoke = h.sessionUpdateMany.mock.calls[0]?.[0] as
      | { where: { userId: string; revokedAt: null } }
      | undefined;
    expect(revoke?.where.userId).toBe(USER.id);
    expect(revoke?.where.revokedAt).toBeNull();
  });

  it("sends a security_alert confirmation after a successful reset, keyed on the consumed token row", async () => {
    const { h, token } = await issued();
    // issued() already triggered one send() for the reset-request email —
    // this asserts on the second call, the post-reset confirmation.
    expect(h.send).toHaveBeenCalledTimes(1);

    await h.service.resetPassword(token, "brand-new-password");

    expect(h.send).toHaveBeenCalledTimes(2);
    const confirmation = h.send.mock.calls[1]?.[0] as {
      template: string;
      channels: string[];
      userId: string;
      idempotencyKey: string;
      vars: Record<string, string>;
    };
    expect(confirmation.template).toBe("security_alert");
    expect(confirmation.channels).toEqual(["EMAIL"]);
    expect(confirmation.userId).toBe(USER.id);
    expect(confirmation.idempotencyKey).toBe(`password_reset_completed:${h.tokens[0]!.id}`);
    expect(confirmation.vars.status).toMatch(/password was changed/i);
  });

  it("does not send a confirmation notification when the reset is rejected (reused token)", async () => {
    const { h, token } = await issued();
    await h.service.resetPassword(token, "brand-new-password");
    expect(h.send).toHaveBeenCalledTimes(2);

    await expect(h.service.resetPassword(token, "another-password")).rejects.toThrow(BadRequestException);

    // The rejected second attempt must not add a third send() call.
    expect(h.send).toHaveBeenCalledTimes(2);
  });

  it("never stores the new password in clear text", async () => {
    const { h, token } = await issued();
    await h.service.resetPassword(token, "brand-new-password");

    const data = (h.userUpdate.mock.calls[0]?.[0] as { data: { passwordHash: string } }).data;
    expect(data.passwordHash).not.toContain("brand-new-password");
    expect(data.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("refuses a second use of the same token", async () => {
    const { h, token } = await issued();
    await h.service.resetPassword(token, "brand-new-password");

    await expect(h.service.resetPassword(token, "another-password")).rejects.toThrow(BadRequestException);
  });

  it("refuses an expired token", async () => {
    const { h, token } = await issued();
    h.tokens[0]!.expiresAt = new Date(Date.now() - 1000);

    await expect(h.service.resetPassword(token, "brand-new-password")).rejects.toThrow(BadRequestException);
  });

  it("refuses an unknown token", async () => {
    const h = createHarness();
    await expect(h.service.resetPassword("not-a-real-token", "brand-new-password")).rejects.toThrow(
      BadRequestException
    );
  });

  it("enforces the existing 8-128 character password policy", async () => {
    const { h, token } = await issued();
    await expect(h.service.resetPassword(token, "short")).rejects.toThrow(BadRequestException);
  });
});
