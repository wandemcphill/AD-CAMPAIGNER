/* Hand-rolled Prisma stand-in below is untyped by design — same approach, and
   same disable block, as api-flow.test.ts in this directory. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { beforeEach, describe, expect, it } from "vitest";

import { AuthSessionService } from "../../../apps/api/src/modules/auth-session.service";
import { PlatformService } from "../../../apps/api/src/modules/platform.service";
import { PrismaService } from "../../../apps/api/src/modules/prisma.service";
import type { NotificationsService } from "../../../apps/api/src/modules/notifications/notifications.service";
import type { DatabaseClient } from "@fliptrybe/database";

/**
 * End-to-end customer account lifecycle against the real services: the exact
 * sequence a person performs in the browser — create an account, sign in, be
 * recognised, sign out — plus the recovery path that used to be a dead end
 * because registration hardcoded `email: null` and nothing could ever set it.
 *
 * Everything is in-process; vitest.config.ts sets a placeholder DATABASE_URL
 * that no real client could connect to.
 */
function createInMemoryClient() {
  const users: any[] = [];
  const organizations: any[] = [];
  const workspaces: any[] = [];
  const teamMembers: any[] = [];
  const sessions: any[] = [];
  const resetTokens: any[] = [];
  const auditLogs: any[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const activeMembers = (organizationId: string, userId: string) =>
    teamMembers.filter(
      (member) =>
        member.organizationId === organizationId &&
        member.userId === userId &&
        member.deletedAt === null
    );

  // Mirrors the nested organization/members include both workspace scope
  // resolvers ask for; returning a bare workspace would make membership checks
  // silently pass.
  const hydrateWorkspace = (workspace: any, include: any) => {
    if (!include?.organization) {
      return { ...workspace };
    }

    const organization = organizations.find(
      (candidate) => candidate.id === workspace.organizationId && candidate.deletedAt === null
    );
    const memberUserId = include.organization.include?.members?.where?.userId;

    return {
      ...workspace,
      organization: {
        id: organization?.id ?? "",
        name: organization?.name ?? "",
        slug: organization?.slug ?? "",
        members: memberUserId
          ? activeMembers(workspace.organizationId, memberUserId).map((member) => ({
              role: member.role,
              permissions: member.permissions
            }))
          : []
      }
    };
  };

  const db: Record<string, any> = {
    user: {
      findUnique: async ({ where }: any) =>
        users.find(
          (user) =>
            (where.id !== undefined && user.id === where.id) ||
            (where.username !== undefined && user.username === where.username)
        ) ?? null,
      findFirst: async ({ where }: any) =>
        users.find((user) => {
          if (where.id !== undefined && user.id !== where.id) return false;
          if (where.NOT?.id !== undefined && user.id === where.NOT.id) return false;
          if (where.status !== undefined && user.status !== where.status) return false;
          if (where.deletedAt === null && user.deletedAt !== null) return false;
          if (where.email !== undefined && user.email !== where.email) return false;
          if (where.OR) {
            const matched = where.OR.some(
              (clause: any) =>
                (clause.username !== undefined && user.username === clause.username) ||
                (clause.email !== undefined && user.email !== null && user.email === clause.email)
            );
            if (!matched) return false;
          }

          return true;
        }) ?? null,
      create: async ({ data }: any) => {
        const user = {
          id: nextId("user"),
          defaultWorkspaceId: null,
          dateOfBirth: null,
          emailVerifiedAt: null,
          totpSecretEncrypted: null,
          totpEnabledAt: null,
          deletedAt: null,
          ...data
        };
        users.push(user);

        return { ...user };
      },
      update: async ({ where, data }: any) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) {
          throw new Error(`No user ${where.id}`);
        }
        // The unique index the real database enforces on User.email.
        if (
          data.email !== undefined &&
          users.some((other) => other.id !== user.id && other.email === data.email)
        ) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        Object.assign(user, data);

        return { ...user };
      }
    },
    organization: {
      create: async ({ data }: any) => {
        const organization = { id: nextId("org"), deletedAt: null, ...data };
        organizations.push(organization);

        return { ...organization };
      }
    },
    workspace: {
      findFirst: async ({ where, include }: any) => {
        const workspace = workspaces.find((candidate) => {
          if (candidate.deletedAt !== null) return false;
          if (where.id !== undefined && candidate.id !== where.id) return false;
          if (where.organizationId !== undefined && candidate.organizationId !== where.organizationId) {
            return false;
          }

          const organization = organizations.find(
            (org) => org.id === candidate.organizationId && org.deletedAt === null
          );
          if (!organization) return false;

          const requiredMember = where.organization?.members?.some;
          if (requiredMember && activeMembers(candidate.organizationId, requiredMember.userId).length === 0) {
            return false;
          }

          return true;
        });

        return workspace ? hydrateWorkspace(workspace, include) : null;
      },
      create: async ({ data }: any) => {
        const workspace = {
          id: nextId("workspace"),
          defaultCurrency: "NGN",
          createdAt: new Date(),
          deletedAt: null,
          ...data
        };
        workspaces.push(workspace);

        return { ...workspace };
      }
    },
    teamMember: {
      findFirst: async ({ where }: any) => {
        const member = teamMembers.find(
          (candidate) => candidate.userId === where.userId && candidate.deletedAt === null
        );
        if (!member) return null;

        const organization = organizations.find((org) => org.id === member.organizationId);

        return {
          role: member.role,
          permissions: member.permissions,
          organization: {
            id: organization?.id ?? "",
            name: organization?.name ?? "",
            slug: organization?.slug ?? ""
          }
        };
      },
      create: async ({ data }: any) => {
        const member = { id: nextId("member"), createdAt: new Date(), deletedAt: null, ...data };
        teamMembers.push(member);

        return { ...member };
      }
    },
    session: {
      create: async ({ data }: any) => {
        const session = { revokedAt: null, createdAt: new Date(), ...data };
        sessions.push(session);

        return { ...session };
      },
      findFirst: async ({ where }: any) =>
        sessions.find(
          (session) =>
            session.id === where.id &&
            session.userId === where.userId &&
            session.revokedAt === null &&
            session.expiresAt.getTime() > where.expiresAt.gt.getTime()
        ) ?? null,
      updateMany: async ({ where, data }: any) => {
        const matched = sessions.filter(
          (session) =>
            (where.id === undefined || session.id === where.id) &&
            session.userId === where.userId &&
            (where.tokenHash === undefined || session.tokenHash === where.tokenHash) &&
            session.revokedAt === null
        );
        matched.forEach((session) => Object.assign(session, data));

        return { count: matched.length };
      }
    },
    passwordResetToken: {
      count: async ({ where }: any) =>
        resetTokens.filter(
          (token) =>
            token.userId === where.userId && token.createdAt.getTime() >= where.createdAt.gte.getTime()
        ).length,
      create: async ({ data }: any) => {
        const token = { id: nextId("prt"), createdAt: new Date(), usedAt: null, ...data };
        resetTokens.push(token);

        return { ...token };
      },
      findUnique: async ({ where }: any) =>
        resetTokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({ where, data }: any) => {
        const matched = resetTokens.filter(
          (token) =>
            (where.id === undefined || token.id === where.id) &&
            (where.userId === undefined || token.userId === where.userId) &&
            token.usedAt === null
        );
        matched.forEach((token) => Object.assign(token, data));

        return { count: matched.length };
      }
    },
    auditLog: {
      create: async ({ data }: any) => {
        const entry = { id: nextId("audit"), createdAt: new Date(), ...data };
        auditLogs.push(entry);

        return { ...entry };
      }
    },
    $transaction: async (callback: any) => callback(db)
  };

  return { db, users, sessions, resetTokens, auditLogs };
}

function createServices() {
  const store = createInMemoryClient();
  const prisma = new PrismaService(store.db as unknown as DatabaseClient);
  const sentNotifications: any[] = [];
  const notifications = {
    send: async (input: any) => {
      sentNotifications.push(input);

      return [];
    }
  } as unknown as NotificationsService;

  return {
    ...store,
    sentNotifications,
    auth: new AuthSessionService(prisma, notifications),
    platform: new PlatformService(prisma, notifications)
  };
}

describe("customer account lifecycle", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "integration-jwt-secret-long-enough-for-auth";
    process.env.NODE_ENV = "test";
  });

  it("runs signup → login → session → logout for a new customer", async () => {
    const { auth, sessions } = createServices();

    // ── Signup ──────────────────────────────────────────────────────────────
    const signup = await auth.register(
      {
        username: "tunde",
        password: "correct-horse-battery",
        confirmPassword: "correct-horse-battery",
        displayName: "Tunde Okoro",
        email: "Tunde@Example.com"
      },
      { "user-agent": "integration", "x-forwarded-for": "102.89.1.1" }
    );

    expect(signup.token).toBeTruthy();
    expect(signup.user).toMatchObject({
      username: "tunde",
      displayName: "Tunde Okoro",
      email: "tunde@example.com"
    });
    expect(signup.role).toBe("OWNER");
    expect(signup.workspace.name).toBe("Tunde Okoro's Workspace");

    // ── Login ───────────────────────────────────────────────────────────────
    const login = await auth.login(
      { username: "tunde", password: "correct-horse-battery" },
      { "user-agent": "integration" }
    );

    expect(login.token).toBeTruthy();
    expect(login.token).not.toBe(signup.token);
    expect(login.user.username).toBe("tunde");
    expect(login.workspace.id).toBe(signup.workspace.id);

    // ── Session ─────────────────────────────────────────────────────────────
    const session = await auth.getSession({ authorization: `Bearer ${login.token}` });

    expect(session).toMatchObject({
      user: { username: "tunde", email: "tunde@example.com" },
      role: "OWNER",
      isPlatformAdmin: false
    });

    // ── Logout ──────────────────────────────────────────────────────────────
    await expect(auth.logout({ authorization: `Bearer ${login.token}` })).resolves.toEqual({
      ok: true
    });

    // The token is now inert: a revoked session must not still resolve.
    await expect(
      auth.getSession({ authorization: `Bearer ${login.token}` })
    ).rejects.toThrow();

    // Logging out of one device leaves the other session alone.
    await expect(
      auth.getSession({ authorization: `Bearer ${signup.token}` })
    ).resolves.toMatchObject({ user: { username: "tunde" } });
    expect(sessions.filter((entry) => entry.revokedAt === null)).toHaveLength(1);
  });

  it("rejects a wrong password without revealing whether the username exists", async () => {
    const { auth } = createServices();

    await auth.register(
      { username: "tunde", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      {}
    );

    const wrongPassword = auth
      .login({ username: "tunde", password: "wrong-password" }, {})
      .catch((error: Error) => error.message);
    const unknownUser = auth
      .login({ username: "nobodyhere", password: "wrong-password" }, {})
      .catch((error: Error) => error.message);

    expect(await wrongPassword).toBe("Username or password is invalid.");
    expect(await unknownUser).toBe(await wrongPassword);
  });

  it("recovers an account that registered without an email, once one is added", async () => {
    const { auth, platform, sentNotifications, auditLogs } = createServices();

    // The state every existing customer is in today: no email on the account.
    const signup = await auth.register(
      { username: "legacy", password: "original-password", confirmPassword: "original-password" },
      {}
    );

    // Reset is a silent no-op — the acknowledgement is deliberately identical
    // either way, so the only observable difference is that no mail is sent.
    await auth.requestPasswordReset("legacy");
    expect(sentNotifications).toHaveLength(0);

    await expect(
      platform.setMyEmail({ userId: signup.user.id, workspaceId: signup.workspace.id }, "Legacy@Example.com")
    ).resolves.toEqual({ email: "legacy@example.com" });
    expect(auditLogs.map((entry) => entry.action)).toContain("user.email_changed");

    // Now the same request actually reaches the customer.
    await auth.requestPasswordReset("legacy");
    expect(sentNotifications).toHaveLength(1);
    expect(sentNotifications[0]).toMatchObject({ template: "password_reset", channels: ["EMAIL"] });

    const resetUrl = String(sentNotifications[0].vars.reference);
    const token = new URL(resetUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    await expect(auth.resetPassword(String(token), "brand-new-password")).resolves.toEqual({ ok: true });

    // The new password works, the old one does not, and the reset revoked every
    // session that existed before it.
    await expect(
      auth.login({ username: "legacy", password: "original-password" }, {})
    ).rejects.toThrow("Username or password is invalid.");
    await expect(
      auth.getSession({ authorization: `Bearer ${signup.token}` })
    ).rejects.toThrow();
    await expect(
      auth.login({ username: "legacy", password: "brand-new-password" }, {})
    ).resolves.toMatchObject({ user: { username: "legacy" } });

    // Single-use: replaying the link must not reset the password a second time.
    await expect(auth.resetPassword(String(token), "third-password")).rejects.toThrow();
  });

  it("refuses to move a recovery email onto a second account", async () => {
    const { auth, platform } = createServices();

    await auth.register(
      {
        username: "first",
        password: "correct-horse-battery",
        confirmPassword: "correct-horse-battery",
        email: "shared@example.com"
      },
      {}
    );
    const second = await auth.register(
      { username: "second", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      {}
    );

    await expect(
      platform.setMyEmail(
        { userId: second.user.id, workspaceId: second.workspace.id },
        "shared@example.com"
      )
    ).rejects.toThrow("already linked to another account");
  });
});
