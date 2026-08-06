import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { ApprovalsService } from "./approvals.service";

function buildDb(overrides: Record<string, unknown> = {}) {
  return {
    approvalRequest: {
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "appr_1", status: "PENDING", ...args.data })
      ),
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: "appr_1",
          status: "PENDING",
          requestedByUserId: "user_requester",
          workspaceId: "workspace_test",
          payload: {}
        })
      ),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "appr_1", requestedByUserId: "user_requester", ...args.data })
      ),
      ...overrides
    },
    auditLog: { create: vi.fn(() => Promise.resolve({})) }
  };
}

describe("ApprovalsService", () => {
  it("rejects a decision made by the same user who requested it", async () => {
    const db = buildDb();
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await expect(
      service.decide("appr_1", { decidedByUserId: "user_requester", approve: true })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a different user to approve", async () => {
    const db = buildDb();
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    const result = await service.decide("appr_1", { decidedByUserId: "user_approver", approve: true });
    expect(result).toMatchObject({ status: "APPROVED", decidedByUserId: "user_approver" });
  });

  it("refuses to decide a request that isn't PENDING", async () => {
    const db = buildDb({
      findUnique: vi.fn(() =>
        Promise.resolve({ id: "appr_1", status: "APPROVED", requestedByUserId: "user_requester" })
      )
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await expect(
      service.decide("appr_1", { decidedByUserId: "user_approver", approve: true })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses to execute a request that isn't APPROVED", async () => {
    const db = buildDb();
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await expect(service.execute("appr_1", () => Promise.resolve("done"))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("marks EXECUTED on success and EXECUTION_FAILED on failure", async () => {
    const update = vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "appr_1", ...args.data })
    );
    const db = buildDb({
      findUnique: vi.fn(() => Promise.resolve({ id: "appr_1", status: "APPROVED" })),
      update
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await service.execute("appr_1", () => Promise.resolve("ok"));
    const executedCall = update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(executedCall.data["status"]).toBe("EXECUTED");

    await expect(
      service.execute("appr_1", () => Promise.reject(new Error("provider down")))
    ).rejects.toThrow("provider down");
    const failedCall = update.mock.calls[1]?.[0] as { data: Record<string, unknown> };
    expect(failedCall.data["status"]).toBe("EXECUTION_FAILED");
    expect(failedCall.data["executionError"]).toBe("provider down");
  });
});
