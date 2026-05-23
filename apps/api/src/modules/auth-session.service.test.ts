import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "./prisma.service";
import { AuthSessionService } from "./auth-session.service";

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}

function createPrisma() {
  const sessions = new Map<string, StoredSession>();
  const client = {
    workspace: {
      findFirst: () => Promise.resolve({
        id: "workspace_123",
        name: "FlipTrybe Growth HQ",
        defaultCurrency: "NGN",
        organization: {
          id: "org_123",
          name: "FlipTrybe",
          slug: "fliptrybe",
          members: [{ role: "OWNER", permissions: ["admin:access"] }]
        }
      })
    },
    user: {
      findFirst: () => Promise.resolve({
        id: "user_123",
        email: "operator@fliptrybe.test",
        name: "Operator",
        status: "ACTIVE"
      })
    },
    session: {
      create: ({ data }: { data: StoredSession }) => {
        sessions.set(data.id, data);

        return Promise.resolve(data);
      },
      findFirst: ({ where }: { where: { id: string; userId: string } }) => {
        const session = sessions.get(where.id);

        if (!session || session.userId !== where.userId) {
          return Promise.resolve(null);
        }

        return Promise.resolve({ tokenHash: session.tokenHash });
      }
    }
  };

  return { prisma: { client } as unknown as PrismaService, sessions };
}

describe("AuthSessionService", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-long-enough-for-auth";
    process.env.NODE_ENV = "test";
  });

  it("exchanges trusted scoped auth headers for a signed workspace session", async () => {
    const { prisma, sessions } = createPrisma();
    const service = new AuthSessionService(prisma);

    const issued = await service.issueSession({
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

    expect(session.user.id).toBe("user_123");
    expect(session.role).toBe("OWNER");
  });
});
