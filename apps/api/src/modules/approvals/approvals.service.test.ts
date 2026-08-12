/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
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
      findMany: vi.fn(() => Promise.resolve([])),
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

describe("ApprovalsService.list", () => {
  function record(overrides: Partial<{ id: string; status: string; entityType: string; createdAt: Date }>) {
    return {
      id: "appr_default",
      status: "PENDING",
      entityType: "digital_access_refund",
      workspaceId: "workspace_test",
      createdAt: new Date(),
      ...overrides
    };
  }

  it("filters by entityType when a type other than 'all' is requested", async () => {
    const findMany = vi.fn((_args: { where: Record<string, unknown> }) =>
      Promise.resolve([record({ id: "appr_kyc", entityType: "kyc" })])
    );
    const db = buildDb({ findMany });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await service.list({ type: "kyc" });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { entityType: "kyc" } });
  });

  it("only returns PENDING requests older than the flagged threshold when status is 'flagged'", async () => {
    const stale = record({ id: "appr_stale", createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) });
    const fresh = record({ id: "appr_fresh", createdAt: new Date() });
    const findMany = vi.fn((_args: { where: Record<string, unknown> }) =>
      Promise.resolve([stale, fresh])
    );
    const db = buildDb({ findMany });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    const result = await service.list({ status: "flagged" });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { status: "PENDING" } });
    expect(result.map((r) => r.id)).toEqual(["appr_stale"]);
  });

  it("does not filter by status at all when 'all' is requested", async () => {
    const findMany = vi.fn((_args: { where: Record<string, unknown> }) => Promise.resolve([]));
    const db = buildDb({ findMany });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    await service.list({ status: "all" });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: {} });
  });
});

describe("ApprovalsService.decideAndExecute", () => {
  // Mimics Prisma's real read-your-writes behavior: `findUnique` reflects whatever the
  // most recent `update` wrote, instead of a static fixture. decideAndExecute re-fetches
  // via `get()` between `decide()` and `execute()`, so a static mock would make every
  // read after the first `update` look stale (still PENDING) and mask real bugs.
  function buildStatefulDb(initial: Record<string, unknown>) {
    let state = { ...initial };
    const findUnique = vi.fn(() => Promise.resolve(state));
    const update = vi.fn((args: { data: Record<string, unknown> }) => {
      state = { ...state, ...args.data };
      return Promise.resolve(state);
    });
    return { db: buildDb({ findUnique, update }), findUnique, update };
  }

  it("runs the registered executor for the entityType when approved", async () => {
    const { db, update } = buildStatefulDb({
      id: "appr_1",
      status: "PENDING",
      entityType: "ads",
      requestedByUserId: "user_requester",
      workspaceId: "workspace_test",
      payload: { campaignId: "campaign_1" }
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);
    const onApprove = vi.fn(() => Promise.resolve("approved-campaign"));
    service.registerExecutor("ads", { onApprove });

    await service.decideAndExecute("appr_1", { decidedByUserId: "user_approver", approve: true });

    expect(onApprove).toHaveBeenCalledTimes(1);
    const statuses = update.mock.calls.map((call) => (call[0] as { data: Record<string, unknown> }).data["status"]);
    expect(statuses).toContain("APPROVED");
    expect(statuses).toContain("EXECUTED");
  });

  it("does not run onApprove when the decision is a rejection", async () => {
    const { db } = buildStatefulDb({
      id: "appr_1",
      status: "PENDING",
      entityType: "kyc",
      requestedByUserId: "user_requester",
      workspaceId: "workspace_test",
      payload: { adAccountId: "acct_1" }
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);
    const onApprove = vi.fn(() => Promise.resolve("verified"));
    service.registerExecutor("kyc", { onApprove });

    await service.decideAndExecute("appr_1", { decidedByUserId: "user_approver", approve: false });

    expect(onApprove).not.toHaveBeenCalled();
  });

  it("runs onReject when the decision is a rejection and onReject is registered", async () => {
    const { db } = buildStatefulDb({
      id: "appr_1",
      status: "PENDING",
      entityType: "kyc",
      requestedByUserId: "user_requester",
      workspaceId: "workspace_test",
      payload: { adAccountId: "acct_1" }
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);
    const onApprove = vi.fn(() => Promise.resolve("verified"));
    const onReject = vi.fn(() => Promise.resolve("suspended"));
    service.registerExecutor("kyc", { onApprove, onReject });

    const result = await service.decideAndExecute("appr_1", { decidedByUserId: "user_approver", approve: false });

    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("REJECTED");
  });

  it("leaves the request decided but un-executed when no executor is registered for the entityType", async () => {
    const db = buildDb({
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: "appr_1",
          status: "PENDING",
          entityType: "digital_access_refund",
          requestedByUserId: "user_requester",
          workspaceId: "workspace_test",
          payload: {}
        })
      )
    });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    const result = await service.decideAndExecute("appr_1", { decidedByUserId: "user_approver", approve: true });

    expect(result.status).toBe("APPROVED");
  });
});

describe("ApprovalsService.syncExternalDecision", () => {
  it("marks a PENDING request EXECUTED when the underlying action was approved elsewhere", async () => {
    const findFirst = vi.fn(() =>
      Promise.resolve({ id: "appr_1", status: "PENDING", workspaceId: "workspace_test" })
    );
    const update = vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "appr_1", ...args.data })
    );
    const db = buildDb({ findFirst, update });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    const result = await service.syncExternalDecision({
      entityType: "ads",
      entityId: "campaign_1",
      approve: true,
      decidedByUserId: "admin_1"
    });

    expect(result).toMatchObject({ status: "EXECUTED" });
  });

  it("is a no-op when there is no PENDING request for the entity", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const update = vi.fn();
    const db = buildDb({ findFirst, update });
    const service = new ApprovalsService({ client: db } as unknown as PrismaService);

    const result = await service.syncExternalDecision({
      entityType: "kyc",
      entityId: "acct_missing",
      approve: true,
      decidedByUserId: "admin_1"
    });

    expect(result).toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
});
