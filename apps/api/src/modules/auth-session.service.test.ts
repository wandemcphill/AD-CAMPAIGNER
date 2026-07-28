import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "./prisma.service";
import { AuthSessionService } from "./auth-session.service";

type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
}

interface StoredOrganization {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  deletedAt: Date | null;
}

interface StoredWorkspace {
  id: string;
  organizationId: string;
  name: string;
  defaultCurrency: string;
  createdAt: Date;
  deletedAt: Date | null;
}

interface StoredTeamMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  deletedAt: Date | null;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface UserFindUniqueArgs {
  where: { email: string };
}

interface UserFindFirstArgs {
  where: { id?: string; status?: UserStatus; deletedAt?: null };
}

interface UserCreateArgs {
  data: {
    email: string;
    name: string;
    status: UserStatus;
    passwordHash: string;
    emailVerifiedAt: Date;
  };
}

interface OrganizationCreateArgs {
  data: {
    name: string;
    slug: string;
    ownerUserId: string;
  };
}

interface WorkspaceFindFirstArgs {
  where: {
    id?: string;
    organizationId?: string;
    deletedAt?: null;
    organization?: {
      deletedAt?: null;
      members?: { some: { userId: string; deletedAt?: null } };
    };
  };
  include?: {
    organization?: {
      include?: {
        members?: {
          where: { userId: string; deletedAt?: null };
          take?: number;
        };
      };
    };
  };
}

interface WorkspaceCreateArgs {
  data: {
    organizationId: string;
    name: string;
  };
}

interface TeamMemberFindFirstArgs {
  where: {
    userId: string;
    deletedAt?: null;
    organization?: { deletedAt?: null };
  };
}

interface TeamMemberCreateArgs {
  data: {
    userId: string;
    organizationId: string;
    role: string;
    permissions: string[];
  };
}

interface SessionCreateArgs {
  data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
}

interface SessionFindFirstArgs {
  where: {
    id: string;
    userId: string;
  };
}

interface SessionUpdateManyArgs {
  where: {
    id: string;
    userId: string;
    tokenHash: string;
    revokedAt: null;
  };
  data: { revokedAt: Date };
}

interface FakeClient {
  user: {
    findUnique: (args: UserFindUniqueArgs) => Promise<StoredUser | null>;
    findFirst: (args: UserFindFirstArgs) => Promise<Pick<StoredUser, "id" | "email" | "name" | "status"> | null>;
    create: (args: UserCreateArgs) => Promise<Pick<StoredUser, "id" | "email" | "name">>;
  };
  organization: {
    create: (args: OrganizationCreateArgs) => Promise<Pick<StoredOrganization, "id" | "name" | "slug">>;
  };
  workspace: {
    findFirst: (
      args: WorkspaceFindFirstArgs
    ) => Promise<
      | (Pick<StoredWorkspace, "id" | "name" | "defaultCurrency"> & {
          organization: Pick<StoredOrganization, "id" | "name" | "slug"> & {
            members: Pick<StoredTeamMember, "role" | "permissions">[];
          };
        })
      | Pick<StoredWorkspace, "id" | "name" | "defaultCurrency">
      | null
    >;
    create: (args: WorkspaceCreateArgs) => Promise<Pick<StoredWorkspace, "id" | "name" | "defaultCurrency">>;
  };
  teamMember: {
    findFirst: (
      args: TeamMemberFindFirstArgs
    ) => Promise<
      | (Pick<StoredTeamMember, "role" | "permissions"> & {
          organization: Pick<StoredOrganization, "id" | "name" | "slug">;
        })
      | null
    >;
    create: (args: TeamMemberCreateArgs) => Promise<Pick<StoredTeamMember, "role" | "permissions">>;
  };
  session: {
    create: (args: SessionCreateArgs) => Promise<StoredSession>;
    findFirst: (args: SessionFindFirstArgs) => Promise<Pick<StoredSession, "tokenHash"> | null>;
    updateMany: (args: SessionUpdateManyArgs) => Promise<{ count: number }>;
  };
  $transaction: <Result>(callback: (transaction: FakeClient) => Promise<Result>) => Promise<Result>;
}

function createPrisma({ seedDefault = true }: { seedDefault?: boolean } = {}) {
  const users = new Map<string, StoredUser>();
  const organizations = new Map<string, StoredOrganization>();
  const workspaces = new Map<string, StoredWorkspace>();
  const teamMembers = new Map<string, StoredTeamMember>();
  const sessions = new Map<string, StoredSession>();
  const now = new Date();

  if (seedDefault) {
    users.set("user_123", {
      id: "user_123",
      email: "operator@fliptrybe.test",
      name: "Operator",
      status: "ACTIVE",
      passwordHash: null,
      emailVerifiedAt: now,
      deletedAt: null
    });
    organizations.set("org_123", {
      id: "org_123",
      name: "FlipTrybe",
      slug: "fliptrybe",
      ownerUserId: "user_123",
      deletedAt: null
    });
    workspaces.set("workspace_123", {
      id: "workspace_123",
      organizationId: "org_123",
      name: "FlipTrybe Growth HQ",
      defaultCurrency: "NGN",
      createdAt: now,
      deletedAt: null
    });
    teamMembers.set("member_123", {
      id: "member_123",
      userId: "user_123",
      organizationId: "org_123",
      role: "OWNER",
      permissions: ["admin:access"],
      createdAt: now,
      deletedAt: null
    });
  }

  function activeOrganization(id: string) {
    const organization = organizations.get(id);

    return organization && !organization.deletedAt ? organization : undefined;
  }

  function activeMembers(organizationId: string, userId: string) {
    return [...teamMembers.values()].filter(
      (member) =>
        member.organizationId === organizationId &&
        member.userId === userId &&
        !member.deletedAt
    );
  }

  const client: FakeClient = {
    user: {
      findUnique: ({ where }: UserFindUniqueArgs) =>
        Promise.resolve([...users.values()].find((user) => user.email === where.email) ?? null),
      findFirst: ({ where }: UserFindFirstArgs) => {
        const user = [...users.values()].find(
          (storedUser) =>
            (where.id === undefined || storedUser.id === where.id) &&
            (where.status === undefined || storedUser.status === where.status) &&
            (where.deletedAt !== null || storedUser.deletedAt === null)
        );

        return Promise.resolve(
          user
            ? { id: user.id, email: user.email, name: user.name, status: user.status }
            : null
        );
      },
      create: ({ data }: UserCreateArgs) => {
        const user: StoredUser = {
          id: `user_${users.size + 1}`,
          email: data.email,
          name: data.name,
          status: data.status,
          passwordHash: data.passwordHash,
          emailVerifiedAt: data.emailVerifiedAt,
          deletedAt: null
        };

        users.set(user.id, user);

        return Promise.resolve({ id: user.id, email: user.email, name: user.name });
      }
    },
    organization: {
      create: ({ data }: OrganizationCreateArgs) => {
        const organization: StoredOrganization = {
          id: `org_${organizations.size + 1}`,
          name: data.name,
          slug: data.slug,
          ownerUserId: data.ownerUserId,
          deletedAt: null
        };

        organizations.set(organization.id, organization);

        return Promise.resolve({
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        });
      }
    },
    workspace: {
      findFirst: ({ where, include }: WorkspaceFindFirstArgs) => {
        const workspace = [...workspaces.values()].find((candidate) => {
          const organization = activeOrganization(candidate.organizationId);

          if (!organization) {
            return false;
          }
          if (where.id !== undefined && candidate.id !== where.id) {
            return false;
          }
          if (where.organizationId !== undefined && candidate.organizationId !== where.organizationId) {
            return false;
          }
          if (where.deletedAt === null && candidate.deletedAt !== null) {
            return false;
          }

          const requiredMember = where.organization?.members?.some;

          return requiredMember
            ? activeMembers(organization.id, requiredMember.userId).length > 0
            : true;
        });

        if (!workspace) {
          return Promise.resolve(null);
        }

        if (include?.organization) {
          const organization = activeOrganization(workspace.organizationId);
          const memberUserId = include.organization.include?.members?.where.userId;
          const members = memberUserId
            ? activeMembers(workspace.organizationId, memberUserId).map((member) => ({
                role: member.role,
                permissions: member.permissions
              }))
            : [];

          return Promise.resolve({
            id: workspace.id,
            name: workspace.name,
            defaultCurrency: workspace.defaultCurrency,
            organization: {
              id: organization?.id ?? "",
              name: organization?.name ?? "",
              slug: organization?.slug ?? "",
              members
            }
          });
        }

        return Promise.resolve({
          id: workspace.id,
          name: workspace.name,
          defaultCurrency: workspace.defaultCurrency
        });
      },
      create: ({ data }: WorkspaceCreateArgs) => {
        const workspace: StoredWorkspace = {
          id: `workspace_${workspaces.size + 1}`,
          organizationId: data.organizationId,
          name: data.name,
          defaultCurrency: "NGN",
          createdAt: new Date(),
          deletedAt: null
        };

        workspaces.set(workspace.id, workspace);

        return Promise.resolve({
          id: workspace.id,
          name: workspace.name,
          defaultCurrency: workspace.defaultCurrency
        });
      }
    },
    teamMember: {
      findFirst: ({ where }: TeamMemberFindFirstArgs) => {
        const member = [...teamMembers.values()].find((candidate) => {
          const organization = activeOrganization(candidate.organizationId);

          return (
            candidate.userId === where.userId &&
            (!where.deletedAt || candidate.deletedAt === null) &&
            Boolean(organization)
          );
        });
        const organization = member ? activeOrganization(member.organizationId) : undefined;

        return Promise.resolve(
          member && organization
            ? {
                role: member.role,
                permissions: member.permissions,
                organization: {
                  id: organization.id,
                  name: organization.name,
                  slug: organization.slug
                }
              }
            : null
        );
      },
      create: ({ data }: TeamMemberCreateArgs) => {
        const member: StoredTeamMember = {
          id: `member_${teamMembers.size + 1}`,
          userId: data.userId,
          organizationId: data.organizationId,
          role: data.role,
          permissions: data.permissions,
          createdAt: new Date(),
          deletedAt: null
        };

        teamMembers.set(member.id, member);

        return Promise.resolve({ role: member.role, permissions: member.permissions });
      }
    },
    session: {
      create: ({ data }: SessionCreateArgs) => {
        const session: StoredSession = {
          id: data.id,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          revokedAt: null
        };

        sessions.set(session.id, session);

        return Promise.resolve(session);
      },
      findFirst: ({ where }: SessionFindFirstArgs) => {
        const session = sessions.get(where.id);

        if (
          !session ||
          session.userId !== where.userId ||
          session.revokedAt ||
          session.expiresAt <= new Date()
        ) {
          return Promise.resolve(null);
        }

        return Promise.resolve({ tokenHash: session.tokenHash });
      },
      updateMany: ({ where, data }: SessionUpdateManyArgs) => {
        const session = sessions.get(where.id);

        if (
          !session ||
          session.userId !== where.userId ||
          session.tokenHash !== where.tokenHash ||
          session.revokedAt !== null
        ) {
          return Promise.resolve({ count: 0 });
        }

        sessions.set(session.id, { ...session, revokedAt: data.revokedAt });

        return Promise.resolve({ count: 1 });
      }
    },
    $transaction: (callback) => callback(client)
  };

  return {
    prisma: { client } as unknown as PrismaService,
    users,
    organizations,
    workspaces,
    teamMembers,
    sessions
  };
}

describe("AuthSessionService", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-long-enough-for-auth";
    process.env.NODE_ENV = "test";
  });

  it("keeps trusted scoped auth headers available for a signed workspace session", async () => {
    const { prisma, sessions } = createPrisma();
    const service = new AuthSessionService(prisma);

    const issued = await service.login(undefined, {
      "x-user-id": "user_123",
      "x-workspace-id": "workspace_123",
      "x-organization-id": "org_123",
      "x-device-id": "test-device",
      "user-agent": "vitest"
    });

    expect(issued.token).toBeTruthy();
    expect(sessions.size).toBe(1);
    expect(issued.workspace.id).toBe("workspace_123");

    const session = await service.getSession({ authorization: `Bearer ${issued.token}` });
    const context = await service.getWorkspaceContext({ authorization: `Bearer ${issued.token}` });

    expect(session.user.id).toBe("user_123");
    expect(session.role).toBe("OWNER");
    expect(context.workspaceId).toBe("workspace_123");
    expect(context.organizationId).toBe("org_123");
  });

  it("resolves a default workspace when the authenticated user header is present without workspace scope", async () => {
    const { prisma } = createPrisma();
    const service = new AuthSessionService(prisma);

    const issued = await service.issueSession({
      "x-user-id": "user_123",
      "x-device-id": "fallback-device"
    });

    expect(issued.token).toBeTruthy();
    expect(issued.workspace.id).toBe("workspace_123");

    await expect(
      service.getWorkspaceContext({ authorization: `Bearer ${issued.token}` })
    ).resolves.toMatchObject({
      userId: "user_123",
      workspaceId: "workspace_123",
      organizationId: "org_123"
    });
  });

  it("registers a user, organization, workspace, owner membership, and signed session", async () => {
    const { prisma, users, organizations, workspaces, teamMembers, sessions } = createPrisma({
      seedDefault: false
    });
    const service = new AuthSessionService(prisma);

    const registered = await service.register(
      {
        email: "Founder@Example.com",
        password: "correct-password",
        name: "Ada Founder",
        organizationName: "Ada Growth",
        workspaceName: "Ada Launch Desk"
      },
      { "user-agent": "vitest" }
    );
    const user = [...users.values()][0];
    const organization = [...organizations.values()][0];
    const workspace = [...workspaces.values()][0];
    const member = [...teamMembers.values()][0];

    expect(user?.email).toBe("founder@example.com");
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(organization?.ownerUserId).toBe(user?.id);
    expect(workspace?.organizationId).toBe(organization?.id);
    expect(member?.role).toBe("OWNER");
    expect(member?.userId).toBe(user?.id);
    expect(registered.token).toBeTruthy();
    expect(registered.user.email).toBe("founder@example.com");
    expect(registered.workspace.name).toBe("Ada Launch Desk");
    expect(sessions.size).toBe(1);

    await expect(
      service.getSession({ authorization: `Bearer ${registered.token}` })
    ).resolves.toMatchObject({
      user: { email: "founder@example.com" },
      organization: { name: "Ada Growth" },
      role: "OWNER"
    });
  });

  it("rejects duplicate registration emails", async () => {
    const { prisma } = createPrisma({ seedDefault: false });
    const service = new AuthSessionService(prisma);
    const body = {
      email: "owner@example.com",
      password: "correct-password",
      name: "Owner Example"
    };

    await service.register(body, {});

    await expect(service.register(body, {})).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in active members with email and password", async () => {
    const { prisma, sessions } = createPrisma({ seedDefault: false });
    const service = new AuthSessionService(prisma);

    const registered = await service.register(
      {
        email: "owner@example.com",
        password: "correct-password",
        name: "Owner Example",
        organizationName: "Owner Ops"
      },
      {}
    );
    const loggedIn = await service.login(
      {
        email: "OWNER@example.com",
        password: "correct-password",
        workspaceId: registered.workspace.id
      },
      { "x-device-id": "browser" }
    );

    expect(loggedIn.token).toBeTruthy();
    expect(loggedIn.token).not.toBe(registered.token);
    expect(loggedIn.workspace.id).toBe(registered.workspace.id);
    expect(loggedIn.role).toBe("OWNER");
    expect(sessions.size).toBe(2);
  });

  it("rejects invalid login passwords", async () => {
    const { prisma } = createPrisma({ seedDefault: false });
    const service = new AuthSessionService(prisma);

    await service.register(
      {
        email: "owner@example.com",
        password: "correct-password",
        name: "Owner Example"
      },
      {}
    );

    await expect(
      service.login({ email: "owner@example.com", password: "wrong-password" }, {})
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("logs out by revoking the active stored session", async () => {
    const { prisma } = createPrisma({ seedDefault: false });
    const service = new AuthSessionService(prisma);

    const registered = await service.register(
      {
        email: "owner@example.com",
        password: "correct-password",
        name: "Owner Example"
      },
      {}
    );

    await expect(
      service.logout({ authorization: `Bearer ${registered.token}` })
    ).resolves.toMatchObject({ ok: true });
    await expect(
      service.getWorkspaceContext({ authorization: `Bearer ${registered.token}` })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects revoked stored sessions for protected workspace context", async () => {
    const { prisma, sessions } = createPrisma();
    const service = new AuthSessionService(prisma);

    const issued = await service.issueSession({
      "x-user-id": "user_123",
      "x-workspace-id": "workspace_123",
      "x-organization-id": "org_123"
    });

    const [session] = sessions.values();

    if (session) {
      sessions.set(session.id, { ...session, revokedAt: new Date() });
    }

    await expect(
      service.getWorkspaceContext({ authorization: `Bearer ${issued.token}` })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
