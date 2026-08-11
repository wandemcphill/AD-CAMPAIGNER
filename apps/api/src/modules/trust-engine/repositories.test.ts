import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { TrustEngineRepositories } from "./repositories";

// Mirrors the mocking pattern used by sibling *.service.test.ts files (e.g.
// digital-access.service.test.ts): build a fake PrismaService.client with just the
// model methods the code under test touches, and assert on both the returned shape
// and which mocked calls fired.

function buildPrisma(overrides: {
  assetSubmission?: Partial<Record<string, ReturnType<typeof vi.fn>>>;
  moderationQueue?: Partial<Record<string, ReturnType<typeof vi.fn>>>;
  validationRun?: Partial<Record<string, ReturnType<typeof vi.fn>>>;
}) {
  const client = {
    assetSubmission: {
      findUnique: vi.fn(),
      update: vi.fn(),
      ...overrides.assetSubmission
    },
    moderationQueue: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      upsert: vi.fn(),
      ...overrides.moderationQueue
    },
    validationRun: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      ...overrides.validationRun
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
  };

  return { client, prisma: { client } as unknown as PrismaService };
}

describe("TrustEngineRepositories.decideModeration", () => {
  let repos: TrustEngineRepositories;

  beforeEach(() => {
    // Constructing TrustEngineRepositories also builds submissionRepo/validationRunRepo/
    // stageResultRepo off the same db handle in the constructor, but decideModeration
    // doesn't go through those — only through this.prismaService.client directly.
  });

  it("approves a REVIEW submission: moves it to ACCEPTED and records the decision", async () => {
    const { client, prisma } = buildPrisma({
      assetSubmission: {
        findUnique: vi.fn(() => Promise.resolve({ id: "sub_1", status: "REVIEW" })),
        update: vi.fn(({ data }: { data: { status: string } }) =>
          Promise.resolve({ id: "sub_1", status: data.status })
        )
      },
      moderationQueue: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        upsert: vi.fn(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: "mq_1" })
        )
      }
    });
    repos = new TrustEngineRepositories(prisma);

    const result = await repos.decideModeration({
      submissionId: "sub_1",
      decision: "APPROVE",
      reviewerUserId: "user_reviewer",
      decisionReason: "Looks legitimate"
    });

    expect(result.status).toBe("ACCEPTED");
    expect(result.moderation.decision).toBe("APPROVE");
    expect(result.moderation.reviewerUserId).toBe("user_reviewer");
    expect(client.assetSubmission.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { status: "ACCEPTED" }
    });
    expect(client.moderationQueue.upsert).toHaveBeenCalled();
  });

  it("rejects a REVIEW submission: moves it to REJECTED and records the decision", async () => {
    const { client, prisma } = buildPrisma({
      assetSubmission: {
        findUnique: vi.fn(() => Promise.resolve({ id: "sub_2", status: "REVIEW" })),
        update: vi.fn(({ data }: { data: { status: string } }) =>
          Promise.resolve({ id: "sub_2", status: data.status })
        )
      },
      moderationQueue: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        upsert: vi.fn(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: "mq_2" })
        )
      }
    });
    repos = new TrustEngineRepositories(prisma);

    const result = await repos.decideModeration({
      submissionId: "sub_2",
      decision: "REJECT",
      reviewerUserId: "user_reviewer",
      decisionReason: "Suspected duplicate"
    });

    expect(result.status).toBe("REJECTED");
    expect(result.moderation.decision).toBe("REJECT");
    expect(client.assetSubmission.update).toHaveBeenCalledWith({
      where: { id: "sub_2" },
      data: { status: "REJECTED" }
    });
  });

  it("rejects deciding a submission that is not in REVIEW status", async () => {
    const { prisma } = buildPrisma({
      assetSubmission: {
        findUnique: vi.fn(() => Promise.resolve({ id: "sub_3", status: "PENDING" }))
      }
    });
    repos = new TrustEngineRepositories(prisma);

    await expect(
      repos.decideModeration({
        submissionId: "sub_3",
        decision: "APPROVE",
        reviewerUserId: "user_reviewer"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s when the submission does not exist", async () => {
    const { prisma } = buildPrisma({
      assetSubmission: { findUnique: vi.fn(() => Promise.resolve(null)) }
    });
    repos = new TrustEngineRepositories(prisma);

    await expect(
      repos.decideModeration({
        submissionId: "sub_missing",
        decision: "APPROVE",
        reviewerUserId: "user_reviewer"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("guards against double-deciding an already-decided ModerationQueue row", async () => {
    const { prisma } = buildPrisma({
      assetSubmission: {
        findUnique: vi.fn(() => Promise.resolve({ id: "sub_4", status: "REVIEW" }))
      },
      moderationQueue: {
        findUnique: vi.fn(() =>
          Promise.resolve({ id: "mq_4", submissionId: "sub_4", decision: "APPROVE", status: "APPROVED" })
        )
      }
    });
    repos = new TrustEngineRepositories(prisma);

    await expect(
      repos.decideModeration({
        submissionId: "sub_4",
        decision: "REJECT",
        reviewerUserId: "user_reviewer"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
