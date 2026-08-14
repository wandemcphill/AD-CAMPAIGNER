import type { Job } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const campaignFindMany = vi.fn();
const campaignStatusHistoryCreate = vi.fn();
const campaignBudgetHoldFindMany = vi.fn();
const campaignBudgetHoldUpdate = vi.fn();
const ledgerEntryUpsert = vi.fn<(args: { where: unknown; update: unknown; create: Record<string, unknown> }) => Promise<Record<string, unknown>>>(
  (args) => Promise.resolve({ id: "ledger_release_1", ...args.create })
);
const auditLogCreate = vi.fn();
const executeRaw = vi.fn(() => Promise.resolve(1));

function fakeTx() {
  return {
    $executeRaw: executeRaw,
    campaignStatusHistory: { create: campaignStatusHistoryCreate },
    campaignBudgetHold: { findMany: campaignBudgetHoldFindMany, update: campaignBudgetHoldUpdate },
    ledgerEntry: { upsert: ledgerEntryUpsert },
    auditLog: { create: auditLogCreate }
  };
}

vi.mock("@fliptrybe/database", () => ({
  createPrismaClient: () => ({
    campaign: { findMany: campaignFindMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx())
  })
}));

function fakeJob(kind: string, campaignId?: string): Job<never> {
  return {
    data: { kind, workspaceId: "workspace_1", requestId: "req_1", campaignId }
  } as unknown as Job<never>;
}

describe("processManagedAdsAutomationJob", () => {
  beforeEach(() => {
    vi.resetModules();
    campaignFindMany.mockReset();
    campaignStatusHistoryCreate.mockReset();
    campaignBudgetHoldFindMany.mockReset();
    campaignBudgetHoldUpdate.mockReset();
    ledgerEntryUpsert.mockClear();
    auditLogCreate.mockReset();
    executeRaw.mockClear();
    executeRaw.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("completes an expired campaign, releases its active budget hold, and writes an audit entry", async () => {
    const { processManagedAdsAutomationJob } = await import("./managed-ads-automation-processor");

    campaignFindMany.mockResolvedValue([{ id: "camp_1", workspaceId: "workspace_1", status: "ACTIVE" }]);
    campaignBudgetHoldFindMany.mockResolvedValue([
      { id: "hold_1", walletId: "wallet_1", amountMinor: 5000, currency: "NGN", status: "ACTIVE" }
    ]);

    const result = await processManagedAdsAutomationJob(fakeJob("lifecycle_sweep"));

    expect(result.status).toBe("processed");
    expect(result.details).toMatchObject({ completed: 1, holdsReleased: 1, sideEffects: true });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(campaignStatusHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "camp_1",
        fromStatus: "ACTIVE",
        toStatus: "COMPLETED",
        actorType: "SYSTEM"
      })
    });

    expect(ledgerEntryUpsert).toHaveBeenCalledTimes(1);
    expect(ledgerEntryUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { idempotencyKey: "hold:hold_1:release" },
      create: expect.objectContaining({ kind: "RELEASE", amountMinor: 5000, walletId: "wallet_1" })
    });

    expect(campaignBudgetHoldUpdate).toHaveBeenCalledWith({
      where: { id: "hold_1" },
      data: expect.objectContaining({ status: "RELEASED", releaseLedgerEntryId: "ledger_release_1" })
    });

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace_1",
        actorUserId: null,
        action: "campaign.auto_completed",
        entityType: "Campaign",
        entityId: "camp_1"
      })
    });
  });

  it("is idempotent: skips a campaign the guarded UPDATE no longer matches (already completed by a prior sweep)", async () => {
    const { processManagedAdsAutomationJob } = await import("./managed-ads-automation-processor");

    campaignFindMany.mockResolvedValue([{ id: "camp_2", workspaceId: "workspace_1", status: "ACTIVE" }]);
    executeRaw.mockResolvedValueOnce(0);

    const result = await processManagedAdsAutomationJob(fakeJob("lifecycle_sweep"));

    expect(result.details).toMatchObject({ completed: 0, holdsReleased: 0, sideEffects: false });
    expect(campaignStatusHistoryCreate).not.toHaveBeenCalled();
    expect(campaignBudgetHoldFindMany).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it("does nothing when no campaigns are past endsAt", async () => {
    const { processManagedAdsAutomationJob } = await import("./managed-ads-automation-processor");

    campaignFindMany.mockResolvedValue([]);

    const result = await processManagedAdsAutomationJob(fakeJob("lifecycle_sweep"));

    expect(result.details).toMatchObject({ completed: 0, holdsReleased: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("delegates non-lifecycle kinds to the existing stub acknowledgement", async () => {
    process.env.MANAGED_ADS_WORKER_ENABLED = "true";
    process.env.MANAGED_ADS_AUTOMATION_WORKER_ENABLED = "true";
    try {
      const { processManagedAdsAutomationJob } = await import("./managed-ads-automation-processor");

      const job = {
        data: {
          kind: "status_changed",
          workspaceId: "workspace_1",
          requestId: "req_2",
          campaignId: "camp_3"
        }
      } as unknown as Job<never>;

      const result = await processManagedAdsAutomationJob(job);

      expect(result.status).toBe("processed");
      expect(result.detail).toContain("status_changed");
      expect(campaignFindMany).not.toHaveBeenCalled();
    } finally {
      delete process.env.MANAGED_ADS_WORKER_ENABLED;
      delete process.env.MANAGED_ADS_AUTOMATION_WORKER_ENABLED;
    }
  });
});
