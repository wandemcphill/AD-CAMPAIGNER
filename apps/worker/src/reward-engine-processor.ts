import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";

import type { RewardEngineJob } from "./queues";

let dbSingleton: DatabaseClient | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) {
    dbSingleton = createPrismaClient();
  }
  return dbSingleton;
}

export async function processRewardEngineJob(job: Job<RewardEngineJob>): Promise<void> {
  switch (job.name) {
    case "verify_task":
      return handleVerifyTask(job.data);
    case "fulfill":
      return handleFulfill(job.data);
    case "campaign_lifecycle":
      return handleCampaignLifecycle(job.data);
    case "leaderboard_refresh":
      return handleLeaderboardRefresh(job.data);
    case "ops_review":
      return handleOpsReview(job.data);
    default:
      console.warn(`[reward-engine] Unknown job name: ${job.name}`);
  }
}

async function handleVerifyTask(data: RewardEngineJob): Promise<void> {
  if (!data.completionId) return;

  const db = getDb();
  const completion = await db.taskCompletion.findUnique({
    where: { id: data.completionId },
    include: { task: { include: { campaign: true } } }
  });

  if (!completion || completion.status !== "PENDING_VERIFICATION") return;

  // Webhook-based verification: check if external verification has arrived
  const verificationEvents = await db.verificationEvent.findMany({
    where: { completionId: data.completionId, success: true },
    orderBy: { createdAt: "desc" },
    take: 1
  });

  if (verificationEvents.length > 0) {
    await db.taskCompletion.update({
      where: { id: data.completionId },
      data: { status: "VERIFIED", verifiedAt: new Date() }
    });

    await checkQualificationAndReserve(db, completion.participantId, completion.task.campaignId);
  }
}

async function handleFulfill(data: RewardEngineJob): Promise<void> {
  if (!data.entitlementId) return;

  const db = getDb();
  const entitlement = await db.rewardEntitlement.findUnique({
    where: { id: data.entitlementId },
    include: { rewardProduct: true, campaign: true }
  });

  if (!entitlement) return;
  if (entitlement.status !== "RESERVED" && entitlement.status !== "FULFILLMENT_PENDING") return;

  await db.rewardEntitlement.update({
    where: { id: data.entitlementId },
    data: { status: "FULFILLMENT_PENDING" }
  });

  const handler = entitlement.rewardProduct.handler;

  try {
    if (handler === "WALLET_CREDIT") {
      const idemKey = `reward_credit_${entitlement.id}`;

      await db.$transaction(async (tx) => {
        const wallet = await tx.wallet.findFirst({
          where: { workspaceId: entitlement.campaign.workspaceId, currency: entitlement.currency }
        });

        if (!wallet) {
          throw new Error(`No wallet found for workspace ${entitlement.campaign.workspaceId}`);
        }

        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            kind: "CREDIT",
            amountMinor: entitlement.rewardValueMinor,
            currency: entitlement.currency,
            reference: idemKey,
            description: `Reward: ${entitlement.campaign.name}`,
            idempotencyKey: idemKey,
            sourceType: "RewardFulfillment",
            sourceId: entitlement.id
          }
        });

        await tx.rewardFulfillment.create({
          data: {
            entitlementId: entitlement.id,
            handler: "WALLET_CREDIT",
            ledgerEntryId: ledgerEntry.id,
            status: "SUCCESS",
            idempotencyKey: idemKey
          }
        });

        await tx.rewardEntitlement.update({
          where: { id: entitlement.id },
          data: { status: "FULFILLED", fulfilledAt: new Date() }
        });
      });

      console.log(`[reward-engine] Wallet credit fulfilled for entitlement ${entitlement.id}`);
    } else {
      console.warn(`[reward-engine] Handler ${handler} not yet implemented for worker fulfillment`);
      await markAmbiguous(db, entitlement.id, `Handler ${handler} not implemented in worker`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[reward-engine] Fulfillment failed for ${entitlement.id}:`, reason);
    await markAmbiguous(db, entitlement.id, reason);
  }
}

async function handleCampaignLifecycle(data: RewardEngineJob): Promise<void> {
  if (!data.campaignId) return;

  const db = getDb();
  const campaign = await db.rewardCampaign.findUnique({ where: { id: data.campaignId } });
  if (!campaign) return;

  if (campaign.status === "ACTIVE") {
    if (campaign.endsAt && campaign.endsAt < new Date()) {
      await db.rewardCampaign.update({
        where: { id: data.campaignId },
        data: { status: "COMPLETED" }
      });
      console.log(`[reward-engine] Campaign ${data.campaignId} auto-completed (past end date)`);
    }

    if (campaign.claimedSlots >= campaign.totalSlots) {
      await db.rewardCampaign.update({
        where: { id: data.campaignId, status: "ACTIVE" },
        data: { status: "COMPLETED" }
      });
      console.log(`[reward-engine] Campaign ${data.campaignId} auto-completed (all slots claimed)`);
    }
  }
}

async function handleLeaderboardRefresh(data: RewardEngineJob): Promise<void> {
  if (!data.campaignId) return;

  const db = getDb();

  const participants = await db.rewardParticipant.findMany({
    where: { campaignId: data.campaignId },
    include: {
      user: { select: { displayName: true, name: true } },
      completions: { where: { status: "VERIFIED" } }
    }
  });

  const ranked = participants
    .map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName ?? p.user.name,
      tasksCompleted: p.completions.length,
      completedAt: p.completedAt
    }))
    .sort((a, b) => {
      if (b.tasksCompleted !== a.tasksCompleted) return b.tasksCompleted - a.tasksCompleted;
      if (a.completedAt && b.completedAt) return a.completedAt.getTime() - b.completedAt.getTime();
      return 0;
    });

  for (let i = 0; i < ranked.length; i++) {
    const entry = ranked[i];
    if (!entry) continue;
    await db.rewardLeaderboardEntry.upsert({
      where: {
        campaignId_userId: { campaignId: data.campaignId, userId: entry.userId }
      },
      create: {
        campaignId: data.campaignId,
        userId: entry.userId,
        displayName: entry.displayName,
        tasksCompleted: entry.tasksCompleted,
        rank: i + 1
      },
      update: {
        displayName: entry.displayName,
        tasksCompleted: entry.tasksCompleted,
        rank: i + 1
      }
    });
  }

  console.log(`[reward-engine] Leaderboard refreshed for campaign ${data.campaignId}: ${ranked.length} entries`);
}

async function handleOpsReview(data: RewardEngineJob): Promise<void> {
  if (!data.entitlementId) return;
  console.log(`[reward-engine] Ops review required for entitlement ${data.entitlementId}`);
}

async function checkQualificationAndReserve(
  db: DatabaseClient,
  participantId: string,
  campaignId: string
): Promise<void> {
  const requiredTasks = await db.rewardTask.findMany({
    where: { campaignId, required: true }
  });

  const completedTasks = await db.taskCompletion.findMany({
    where: {
      participantId,
      status: "VERIFIED",
      taskId: { in: requiredTasks.map((t) => t.id) }
    }
  });

  if (completedTasks.length < requiredTasks.length) return;

  await db.rewardParticipant.update({
    where: { id: participantId },
    data: { completedAt: new Date() }
  });

  const existingEntitlement = await db.rewardEntitlement.findFirst({
    where: { campaignId, participantId }
  });
  if (existingEntitlement) return;

  const affected = await db.$executeRaw`
    UPDATE "RewardCampaign"
    SET "claimedSlots" = "claimedSlots" + 1, "updatedAt" = NOW()
    WHERE id = ${campaignId}
      AND "claimedSlots" < "totalSlots"
      AND status = 'ACTIVE'
  `;

  if (affected === 0) return;

  const campaign = await db.rewardCampaign.findUniqueOrThrow({ where: { id: campaignId } });

  await db.rewardEntitlement.create({
    data: {
      campaignId,
      participantId,
      rewardProductId: campaign.rewardProductId,
      rewardValueMinor: campaign.rewardValueMinor,
      currency: campaign.currency,
      idempotencyKey: `reward_ent_${campaignId}_${participantId}`
    }
  });

  if (campaign.claimedSlots + 1 >= campaign.totalSlots) {
    await db.rewardCampaign.update({
      where: { id: campaignId, status: "ACTIVE" },
      data: { status: "COMPLETED" }
    });
  }
}

async function markAmbiguous(db: DatabaseClient, entitlementId: string, reason: string) {
  const existing = await db.rewardFulfillment.findFirst({ where: { entitlementId } });

  if (existing) {
    await db.rewardFulfillment.update({
      where: { id: existing.id },
      data: { status: "AMBIGUOUS", failureReason: reason }
    });
  } else {
    await db.rewardFulfillment.create({
      data: {
        entitlementId,
        handler: "WALLET_CREDIT",
        status: "AMBIGUOUS",
        failureReason: reason,
        idempotencyKey: `reward_ambiguous_${entitlementId}`
      }
    });
  }

  await db.rewardEntitlement.update({
    where: { id: entitlementId },
    data: { status: "FAILED" }
  });
}
