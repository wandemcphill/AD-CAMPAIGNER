import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";
import {
  createMockVtuAdapter,
  createVtpassAdapter,
  createClubKonnectAdapter,
  type VtuProviderAdapter
} from "@fliptrybe/providers";

import type { VtuFulfilmentJob } from "./queues";

// Real DB-backed handlers for the vtu-fulfilment queue. Unlike the other queues in
// processors.ts (which are stub simulations with no side effects), these jobs read and
// write VtuOrder / VtuDataPlan / ProviderHealth directly — this is the closed loop that
// resolves orders left in SUBMITTED after the API's synchronous purchase call returns.

const POLL_MAX_ATTEMPTS = 8;

let dbSingleton: DatabaseClient | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) {
    dbSingleton = createPrismaClient();
  }
  return dbSingleton;
}

function buildAdapter(providerName: string): VtuProviderAdapter {
  switch (providerName) {
    case "vtpass":
      return createVtpassAdapter({
        baseUrl: process.env["VTPASS_BASE_URL"] ?? "https://sandbox.vtpass.com/api",
        apiKey: process.env["VTPASS_API_KEY"] ?? "",
        publicKey: process.env["VTPASS_PUBLIC_KEY"] ?? "",
        secretKey: process.env["VTPASS_SECRET_KEY"] ?? ""
      });
    case "clubkonnect":
      return createClubKonnectAdapter({
        userId: process.env["CLUBKONNECT_USER_ID"] ?? "",
        apiKey: process.env["CLUBKONNECT_API_KEY"] ?? "",
        ...(process.env["CLUBKONNECT_CALLBACK_URL"]
          ? { callbackUrl: process.env["CLUBKONNECT_CALLBACK_URL"] }
          : {})
      });
    default:
      return createMockVtuAdapter(providerName);
  }
}

async function markAmbiguousForOps(db: DatabaseClient, orderId: string, reason: string) {
  await db.vtuOrder.update({
    where: { id: orderId },
    data: { status: "AMBIGUOUS", failureReason: reason }
  });
}

// ─── poll_status ───────────────────────────────────────────────────────────────
// Enqueued right after a purchase submit returns SUBMITTED (async delivery). Re-queries
// the provider until it reports a terminal state, or gives up after POLL_MAX_ATTEMPTS
// and hands the order to ops as AMBIGUOUS rather than guessing.

export async function processPollStatus(job: Job<VtuFulfilmentJob>): Promise<string> {
  const { orderId } = job.data;
  if (!orderId) return "poll_status skipped: no orderId";

  const db = getDb();
  const order = await db.vtuOrder.findUnique({ where: { id: orderId } });

  if (!order) return `poll_status: order ${orderId} not found`;
  if (order.status !== "SUBMITTED") {
    return `poll_status: order ${orderId} already resolved as ${order.status}`;
  }
  if (!order.providerName || !order.providerReference) {
    await markAmbiguousForOps(db, orderId, "Missing provider reference for status poll");
    return `poll_status: order ${orderId} missing provider reference, marked AMBIGUOUS`;
  }

  const adapter = buildAdapter(order.providerName);
  const attemptsMade = job.attemptsMade ?? 0;

  try {
    const snapshot = await adapter.getOrderStatus(order.providerReference);

    if (snapshot.status === "DELIVERED") {
      await db.vtuOrder.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
      return `poll_status: order ${orderId} DELIVERED`;
    }

    if (snapshot.status === "FAILED") {
      await markAmbiguousForOps(
        db,
        orderId,
        snapshot.failureReason ?? "Provider reported failure on status poll"
      );
      return `poll_status: order ${orderId} FAILED at provider, marked AMBIGUOUS for ops`;
    }

    // Still pending at the provider. Give up after the retry budget instead of polling
    // forever — this becomes an ops review case, not an auto-reversal.
    if (attemptsMade + 1 >= POLL_MAX_ATTEMPTS) {
      await markAmbiguousForOps(
        db,
        orderId,
        `Still SUBMITTED after ${POLL_MAX_ATTEMPTS} poll attempts`
      );
      return `poll_status: order ${orderId} exhausted poll attempts, marked AMBIGUOUS for ops`;
    }

    // Throw to trigger BullMQ's built-in retry/backoff for this job.
    throw new Error(`Order ${orderId} still ${snapshot.status} at provider`);
  } catch (err) {
    if (attemptsMade + 1 >= POLL_MAX_ATTEMPTS) {
      await markAmbiguousForOps(
        db,
        orderId,
        err instanceof Error ? err.message : "Status poll failed after max attempts"
      );
      return `poll_status: order ${orderId} poll errored at max attempts, marked AMBIGUOUS`;
    }
    throw err;
  }
}

// ─── reconcile ───────────────────────────────────────────────────────────────────
// Periodic sweep over orders still SUBMITTED or AMBIGUOUS past a staleness window.
// Re-checks each with the provider; resolves what it can, leaves the rest for ops.
// Never auto-reverses — only DELIVERED/FAILED confirmations from the provider move
// an order out of AMBIGUOUS here.

export async function processReconcile(): Promise<string> {
  const db = getDb();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes

  const staleOrders = await db.vtuOrder.findMany({
    where: {
      status: { in: ["SUBMITTED", "AMBIGUOUS"] },
      updatedAt: { lt: staleBefore },
      providerReference: { not: null }
    },
    take: 100
  });

  let resolved = 0;
  let stillPending = 0;
  let errored = 0;

  for (const order of staleOrders) {
    if (!order.providerName || !order.providerReference) continue;

    try {
      const adapter = buildAdapter(order.providerName);
      const snapshot = await adapter.getOrderStatus(order.providerReference);

      if (snapshot.status === "DELIVERED") {
        await db.vtuOrder.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
        resolved++;
      } else if (snapshot.status === "FAILED" && order.status === "SUBMITTED") {
        await markAmbiguousForOps(
          db,
          order.id,
          snapshot.failureReason ?? "Provider reported failure during reconcile"
        );
        resolved++;
      } else {
        stillPending++;
      }
    } catch {
      errored++;
    }
  }

  return `reconcile: ${staleOrders.length} stale orders scanned, ${resolved} resolved, ${stillPending} still pending, ${errored} errored`;
}

// ─── plan_catalog_sync ─────────────────────────────────────────────────────────
// Refreshes VtuDataPlan from a live provider adapter. Marks plans the provider no
// longer returns as inactive rather than deleting them (order history references
// providerPlanId and shouldn't dangle).

export async function processPlanCatalogSync(job: Job<VtuFulfilmentJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "plan_catalog_sync skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  const offers = await adapter.listDataPlans();

  const seenPlanIds = new Set<string>();

  for (const offer of offers) {
    seenPlanIds.add(offer.providerPlanId);

    await db.vtuDataPlan.upsert({
      where: {
        providerName_providerPlanId: {
          providerName,
          providerPlanId: offer.providerPlanId
        }
      },
      create: {
        providerName,
        providerPlanId: offer.providerPlanId,
        network: offer.network,
        planType: offer.planType,
        displayName: offer.displayName,
        sizeMb: offer.sizeMb,
        validityDays: offer.validityDays,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        lastSyncedAt: new Date()
      },
      update: {
        network: offer.network,
        planType: offer.planType,
        displayName: offer.displayName,
        sizeMb: offer.sizeMb,
        validityDays: offer.validityDays,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  const existing = await db.vtuDataPlan.findMany({
    where: { providerName, active: true },
    select: { id: true, providerPlanId: true }
  });
  const staleIds = existing
    .filter((p) => !seenPlanIds.has(p.providerPlanId))
    .map((p) => p.id);

  if (staleIds.length > 0) {
    await db.vtuDataPlan.updateMany({
      where: { id: { in: staleIds } },
      data: { active: false }
    });
  }

  return `plan_catalog_sync: ${providerName} synced ${offers.length} plans, ${staleIds.length} deactivated`;
}

// ─── provider_health ───────────────────────────────────────────────────────────

export async function processProviderHealth(job: Job<VtuFulfilmentJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "provider_health skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  const snapshot = await adapter.checkHealth();

  await db.providerHealth.create({
    data: {
      providerName,
      domain: "VTU",
      status: snapshot.status,
      latencyMs: snapshot.latencyMs,
      successRateBps: snapshot.status === "HEALTHY" ? 10_000 : 0,
      ...(snapshot.reason ? { reason: snapshot.reason } : {})
    }
  });

  return `provider_health: ${providerName} is ${snapshot.status} (${snapshot.latencyMs}ms)`;
}

// ─── ops_review ─────────────────────────────────────────────────────────────────
// Marker job enqueued when an order needs human attention. No automated action —
// resolution happens via admin/vtu/orders/:id/resolve. This just makes the job
// visible in BullMQ so ops tooling can alert on the queue depth.

export function processOpsReview(job: Job<VtuFulfilmentJob>): string {
  return `ops_review: order ${job.data.orderId ?? "unknown"} flagged for manual resolution`;
}

export async function processVtuFulfilmentJob(job: Job<VtuFulfilmentJob>): Promise<string> {
  switch (job.name) {
    case "poll_status":
      return processPollStatus(job);
    case "reconcile":
      return processReconcile();
    case "plan_catalog_sync":
      return processPlanCatalogSync(job);
    case "provider_health":
      return processProviderHealth(job);
    case "ops_review":
      return processOpsReview(job);
    default:
      return `vtu-fulfilment: unrecognized job name ${job.name}`;
  }
}
