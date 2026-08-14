import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient, type CampaignStatus } from "@fliptrybe/database";

import { processQueueJob, type ProcessorResult } from "./processors";
import type { QueuePayloads } from "./queues";

// Real DB-backed handler for the "lifecycle_sweep" managed-ads-automation kind. Every
// other kind (request_submitted, status_changed, campaign_launch, performance_sync,
// budget_check) still delegates to processQueueJob's stub acknowledgement — those require
// real ad-platform integration or richer workspace context that don't belong in an
// unattended sweep, and Ad Campaigner's ad-buying is intentionally human-in-the-loop
// (docs/MANAGED_ADS_PRODUCTION_TASKS.md). lifecycle_sweep only needs the campaign's own
// endsAt, so it's safe to run unattended.

const LIVE_CAMPAIGN_STATUSES = ["ACTIVE", "RUNNING", "PAUSED"] as const;

let dbSingleton: DatabaseClient | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) {
    dbSingleton = createPrismaClient();
  }
  return dbSingleton;
}

export async function processManagedAdsAutomationJob(
  job: Job<QueuePayloads["managed-ads-automation"]>
): Promise<ProcessorResult> {
  const data = job.data;

  if (data.kind === "lifecycle_sweep") {
    return runLifecycleSweep();
  }

  return processQueueJob("managed-ads-automation", job);
}

async function runLifecycleSweep(): Promise<ProcessorResult> {
  const db = getDb();
  const processedAt = new Date().toISOString();

  const expired = await db.campaign.findMany({
    where: {
      status: { in: [...LIVE_CAMPAIGN_STATUSES] },
      endsAt: { lt: new Date() },
      deletedAt: null
    },
    select: { id: true, workspaceId: true, status: true }
  });

  let completed = 0;
  let holdsReleased = 0;

  for (const campaign of expired) {
    const result = await completeExpiredCampaign(db, campaign.id, campaign.workspaceId, campaign.status);
    if (result.completed) completed += 1;
    holdsReleased += result.holdsReleased;
  }

  return {
    queue: "managed-ads-automation",
    status: "processed",
    detail: `Lifecycle sweep completed ${completed} campaign(s), released ${holdsReleased} budget hold(s)`,
    details: { completed, holdsReleased, sideEffects: completed > 0 || holdsReleased > 0 },
    processedAt
  };
}

async function completeExpiredCampaign(
  db: DatabaseClient,
  campaignId: string,
  workspaceId: string,
  fromStatus: CampaignStatus
): Promise<{ completed: boolean; holdsReleased: number }> {
  return db.$transaction(async (tx) => {
    // Re-check inside the transaction: a concurrent sweep or an operator action may have
    // already moved the campaign off the statuses we swept for.
    const affected = await tx.$executeRaw`
      UPDATE "Campaign"
      SET "status" = 'COMPLETED', "updatedAt" = NOW()
      WHERE id = ${campaignId}
        AND "status" IN ('ACTIVE', 'RUNNING', 'PAUSED')
        AND "endsAt" < NOW()
    `;

    if (affected === 0) {
      return { completed: false, holdsReleased: 0 };
    }

    await tx.campaignStatusHistory.create({
      data: {
        campaignId,
        fromStatus,
        toStatus: "COMPLETED",
        actorType: "SYSTEM",
        reason: "Automated: campaign end date passed"
      }
    });

    const activeHolds = await tx.campaignBudgetHold.findMany({
      where: { campaignId, status: "ACTIVE" }
    });

    let holdsReleased = 0;
    for (const hold of activeHolds) {
      const releaseIdempotencyKey = `hold:${hold.id}:release`;
      const release = await tx.ledgerEntry.upsert({
        where: { idempotencyKey: releaseIdempotencyKey },
        update: {},
        create: {
          walletId: hold.walletId,
          kind: "RELEASE",
          amountMinor: hold.amountMinor,
          currency: hold.currency,
          reference: releaseIdempotencyKey,
          description: "Campaign budget hold released (automated: campaign completed)",
          idempotencyKey: releaseIdempotencyKey,
          sourceType: "CampaignBudgetHold",
          sourceId: hold.id
        }
      });

      await tx.campaignBudgetHold.update({
        where: { id: hold.id },
        data: { status: "RELEASED", releaseLedgerEntryId: release.id, releasedAt: new Date() }
      });

      holdsReleased += 1;
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: null,
        action: "campaign.auto_completed",
        entityType: "Campaign",
        entityId: campaignId,
        metadata: { reason: "endsAt_passed", fromStatus, holdsReleased }
      }
    });

    return { completed: true, holdsReleased };
  });
}
