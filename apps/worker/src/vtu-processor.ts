import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";
import {
  createMockVtuAdapter,
  createVtpassAdapter,
  createClubKonnectAdapter,
  createSwiftlinkAdapter,
  createEBillsFullAdapter,
  createTopupWizardAdapter,
  createSirpDataAdapter,
  createISquareDataAdapter,
  createInlomaxAdapter,
  createVTUGateAdapter,
  createIACafeAdapter,
  type VtuProviderAdapter
} from "@fliptrybe/providers";

import { VtuPricingSourceType } from "@fliptrybe/database";
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
        ...((process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"])
          ? { baseUrl: process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"] }
          : {}),
        ...(process.env["CLUBKONNECT_CALLBACK_URL"]
          ? { callbackUrl: process.env["CLUBKONNECT_CALLBACK_URL"] }
          : {})
      });
    case "swiftlink":
      return createSwiftlinkAdapter({
        apiKey: process.env["SWIFTLINK_API_KEY"] ?? "",
        ...(process.env["SWIFTLINK_BASE_URL"] ? { baseUrl: process.env["SWIFTLINK_BASE_URL"] } : {})
      });
    case "ebills":
      return createEBillsFullAdapter({
        apiKey: process.env["EBILLS_API_KEY"] ?? "",
        ...(process.env["EBILLS_BASE_URL"] ? { baseUrl: process.env["EBILLS_BASE_URL"] } : {})
      });
    case "topupwizard":
      return createTopupWizardAdapter({
        apiKey: process.env["TOPUPWIZARD_API_KEY"] ?? "",
        ...(process.env["TOPUPWIZARD_BASE_URL"] ? { baseUrl: process.env["TOPUPWIZARD_BASE_URL"] } : {})
      });
    // sirpdata and iacafe were missing here while present in the API's own
    // buildAdapter, so every background job for them — education_catalog_sync,
    // poll_status, reconcile — silently fell through to `default:` and was
    // served by a MOCK adapter. This switch must stay in step with
    // VtuService.buildAdapter; the two are the same table.
    case "sirpdata":
      return createSirpDataAdapter({
        apiKey: process.env["SIRPDATA_API_KEY"] ?? "",
        ...(process.env["SIRPDATA_BASE_URL"] ? { baseUrl: process.env["SIRPDATA_BASE_URL"] } : {})
      });
    case "iacafe":
      // LIVE credential — see the LIVE CREDENTIAL WARNING comment on
      // createIACafeAdapter in @fliptrybe/providers before enabling real traffic.
      return createIACafeAdapter({
        apiKey: process.env["IACAFE_API_KEY"] ?? "",
        ...(process.env["IACAFE_BASE_URL"] ? { baseUrl: process.env["IACAFE_BASE_URL"] } : {})
      });
    case "isquaredata":
      return createISquareDataAdapter({
        apiKey: process.env["ISQUAREDATA_API_KEY"] ?? "",
        ...(process.env["ISQUAREDATA_BASE_URL"] ? { baseUrl: process.env["ISQUAREDATA_BASE_URL"] } : {})
      });
    case "inlomax":
      return createInlomaxAdapter({
        apiKey: process.env["INLOMAX_API_KEY"] ?? "",
        ...(process.env["INLOMAX_BASE_URL"] ? { baseUrl: process.env["INLOMAX_BASE_URL"] } : {})
      });
    case "vtugate":
      return createVTUGateAdapter({
        apiKey: process.env["VTUGATE_API_KEY"] ?? "",
        ...(process.env["VTUGATE_BASE_URL"] ? { baseUrl: process.env["VTUGATE_BASE_URL"] } : {})
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
      const updateData: Record<string, unknown> = { status: "DELIVERED" };
      if (snapshot.token) updateData["token"] = snapshot.token;
      await db.vtuOrder.update({ where: { id: orderId }, data: updateData });
      return `poll_status: order ${orderId} DELIVERED${snapshot.token ? " (token received)" : ""}`;
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

// ─── cable_catalog_sync ────────────────────────────────────────────────────────
// Refreshes VtuCablePackage from a live provider adapter. Same stale-marking pattern
// as plan_catalog_sync: packages the provider no longer lists are deactivated, not
// deleted, since VtuOrder.metadata references packageCode and shouldn't dangle.

export async function processCableCatalogSync(job: Job<VtuFulfilmentJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "cable_catalog_sync skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  if (!adapter.listCablePackages) {
    return `cable_catalog_sync: ${providerName} does not support cable package discovery`;
  }

  const offers = await adapter.listCablePackages();
  const seenCodes = new Set<string>();

  for (const offer of offers) {
    seenCodes.add(offer.packageCode);

    await db.vtuCablePackage.upsert({
      where: {
        providerName_packageCode: {
          providerName,
          packageCode: offer.packageCode
        }
      },
      create: {
        providerName,
        cableProvider: offer.cableProvider,
        packageCode: offer.packageCode,
        displayName: offer.displayName,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        lastSyncedAt: new Date()
      },
      update: {
        cableProvider: offer.cableProvider,
        displayName: offer.displayName,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  const existing = await db.vtuCablePackage.findMany({
    where: { providerName, active: true },
    select: { id: true, packageCode: true }
  });
  const staleIds = existing
    .filter((p) => !seenCodes.has(p.packageCode))
    .map((p) => p.id);

  if (staleIds.length > 0) {
    await db.vtuCablePackage.updateMany({
      where: { id: { in: staleIds } },
      data: { active: false }
    });
  }

  return `cable_catalog_sync: ${providerName} synced ${offers.length} packages, ${staleIds.length} deactivated`;
}

// ─── betting_catalog_sync ────────────────────────────────────────────────────────
// Same pattern as cable_catalog_sync, for VtuBettingCompany.

export async function processBettingCatalogSync(job: Job<VtuFulfilmentJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "betting_catalog_sync skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  if (!adapter.listBettingCompanies) {
    return `betting_catalog_sync: ${providerName} does not support betting company discovery`;
  }

  const offers = await adapter.listBettingCompanies();
  const seenCodes = new Set<string>();

  for (const offer of offers) {
    seenCodes.add(offer.productCode);

    await db.vtuBettingCompany.upsert({
      where: {
        providerName_productCode: {
          providerName,
          productCode: offer.productCode
        }
      },
      create: {
        providerName,
        productCode: offer.productCode,
        displayName: offer.displayName,
        active: true,
        lastSyncedAt: new Date()
      },
      update: {
        displayName: offer.displayName,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  const existing = await db.vtuBettingCompany.findMany({
    where: { providerName, active: true },
    select: { id: true, productCode: true }
  });
  const staleIds = existing
    .filter((c) => !seenCodes.has(c.productCode))
    .map((c) => c.id);

  if (staleIds.length > 0) {
    await db.vtuBettingCompany.updateMany({
      where: { id: { in: staleIds } },
      data: { active: false }
    });
  }

  return `betting_catalog_sync: ${providerName} synced ${offers.length} companies, ${staleIds.length} deactivated`;
}

// ─── education_catalog_sync ──────────────────────────────────────────────────────
// Same pattern as cable_catalog_sync, for VtuEducationPlan.

export async function processEducationCatalogSync(job: Job<VtuFulfilmentJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "education_catalog_sync skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  if (!adapter.listEducationPlans) {
    // Expected for SirpData, which sells exam PINs but publishes no pricing
    // endpoint. Its plans are priced by an admin instead (PUT
    // /admin/vtu/education/plans) — this is not an error state.
    return (
      `education_catalog_sync: ${providerName} has no education catalog endpoint — ` +
      `its plans must be priced manually via /admin/vtu/education/plans`
    );
  }

  const offers = await adapter.listEducationPlans();
  const seenCodes = new Set<string>();

  // A MANUAL row was priced by an admin because the provider cannot price
  // itself (see VtuService.adminUpsertEducationPlan). The sync must never
  // reprice one or deactivate it as stale — doing either would silently undo an
  // operator's configuration on the next daily run.
  const manual = await db.vtuEducationPlan.findMany({
    where: { providerName, pricingSource: "MANUAL" },
    select: { productCode: true }
  });
  const manualCodes = new Set(manual.map((p) => p.productCode));

  let skippedManual = 0;

  for (const offer of offers) {
    seenCodes.add(offer.productCode);

    if (manualCodes.has(offer.productCode)) {
      skippedManual++;
      continue;
    }

    await db.vtuEducationPlan.upsert({
      where: {
        providerName_productCode: {
          providerName,
          productCode: offer.productCode
        }
      },
      create: {
        providerName,
        productCode: offer.productCode,
        displayName: offer.displayName,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        pricingSource: "SYNC",
        lastSyncedAt: new Date()
      },
      update: {
        displayName: offer.displayName,
        costMinor: offer.costMinor,
        currency: offer.currency,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  const existing = await db.vtuEducationPlan.findMany({
    where: { providerName, active: true, pricingSource: "SYNC" },
    select: { id: true, productCode: true }
  });
  const staleIds = existing
    .filter((p) => !seenCodes.has(p.productCode))
    .map((p) => p.id);

  if (staleIds.length > 0) {
    await db.vtuEducationPlan.updateMany({
      where: { id: { in: staleIds } },
      data: { active: false }
    });
  }

  return (
    `education_catalog_sync: ${providerName} synced ${offers.length} plans, ` +
    `${staleIds.length} deactivated, ${skippedManual} left to admin pricing`
  );
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

// ─── provider_balance_check ──────────────────────────────────────────────────
// Polls the balance for every ACTIVE or PRODUCTION_READY provider and upserts a
// VtuProviderBalance snapshot. If the balance falls below the VtuProviderConfig
// minBalanceMinor threshold the status flips to LOW_BALANCE so the router
// deprioritises (balanceWeight) or skips that provider.
// Run on a cron: every 30 minutes.

export async function processProviderBalanceCheck(job: Job<VtuFulfilmentJob>): Promise<string> {
  const db = getDb();

  const providerName = job.data.providerName;

  const configs = providerName
    ? await db.vtuProviderConfig.findMany({ where: { providerName } })
    : await db.vtuProviderConfig.findMany({
        where: { status: { in: ["ACTIVE", "PRODUCTION_READY", "CONFIGURED"] }, maintenanceMode: false }
      });

  const results: string[] = [];

  for (const cfg of configs) {
    try {
      const adapter = buildAdapter(cfg.providerName);
      if (!adapter.getBalance) {
        results.push(`${cfg.providerName}: no getBalance — skipped`);
        continue;
      }

      const balanceResult = await adapter.getBalance();
      const balanceMinor = balanceResult.balanceMinor;
      const status =
        balanceMinor <= 0
          ? "INSUFFICIENT"
          : cfg.minBalanceMinor > 0 && balanceMinor < cfg.minBalanceMinor
            ? "LOW_BALANCE"
            : "HEALTHY";

      await db.vtuProviderBalance.upsert({
        where: { providerName: cfg.providerName },
        create: {
          id: `vbal_${Math.random().toString(36).slice(2, 10)}`,
          providerName: cfg.providerName,
          balanceMinor,
          status,
          threshold: cfg.minBalanceMinor,
          checkedAt: new Date()
        },
        update: {
          balanceMinor,
          status,
          threshold: cfg.minBalanceMinor,
          checkedAt: new Date()
        }
      });

      results.push(`${cfg.providerName}: ₦${(balanceMinor / 100).toFixed(2)} [${status}]`);
    } catch (err) {
      results.push(`${cfg.providerName}: ERROR — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return `provider_balance_check: ${results.join("; ")}`;
}

// ─── price_sync ──────────────────────────────────────────────────────────────
// Refreshes live cost prices from ACTIVE providers that have listDataPlans().
// Diffs against existing VtuProviderSkuMapping rows: updates costMinor,
// writes a VtuProviderPricingHistory row for any change > 0.5%, and updates
// lastSyncedAt. This keeps the router's cost-comparison data fresh.
// Run on a cron: every 6 hours.

export async function processPriceSync(job: Job<VtuFulfilmentJob>): Promise<string> {
  const db = getDb();
  const providerName = job.data.providerName;

  const configs = providerName
    ? await db.vtuProviderConfig.findMany({ where: { providerName } })
    : await db.vtuProviderConfig.findMany({
        where: { status: { in: ["ACTIVE", "PRODUCTION_READY"] }, maintenanceMode: false }
      });

  let updated = 0;
  let unchanged = 0;
  const historyEntries: Array<{
    id: string; providerName: string; providerSku: string;
    oldCostMinor: number | null; newCostMinor: number; sourceType: VtuPricingSourceType;
  }> = [];

  for (const cfg of configs) {
    if (!cfg.enabledServices.includes("DATA")) continue;

    try {
      const adapter = buildAdapter(cfg.providerName);
      const plans = await adapter.listDataPlans();

      for (const plan of plans) {
        const mapping = await db.vtuProviderSkuMapping.findUnique({
          where: { providerName_providerSku: { providerName: cfg.providerName, providerSku: plan.providerPlanId } }
        });

        if (!mapping) continue; // only update existing admin-approved mappings

        const delta = Math.abs(plan.costMinor - mapping.costMinor);
        const changePct = mapping.costMinor > 0 ? delta / mapping.costMinor : 1;

        await db.vtuProviderSkuMapping.update({
          where: { id: mapping.id },
          data: {
            costMinor: plan.costMinor,
            pricingSourceType: "LIVE_PROVIDER",
            lastSyncedAt: new Date()
          }
        });

        if (changePct > 0.005 || mapping.pricingSourceType === "RESEARCHED_PUBLIC_PRICE") {
          historyEntries.push({
            id: `vph_${Math.random().toString(36).slice(2, 10)}`,
            providerName: cfg.providerName,
            providerSku: plan.providerPlanId,
            oldCostMinor: mapping.costMinor,
            newCostMinor: plan.costMinor,
            sourceType: VtuPricingSourceType.LIVE_PROVIDER
          });
          updated++;
        } else {
          unchanged++;
        }
      }
    } catch (err) {
      // Log but don't fail the whole job — other providers should still sync.
      console.error(`price_sync: ${cfg.providerName} error: ${String(err)}`);
    }
  }

  if (historyEntries.length > 0) {
    await db.vtuProviderPricingHistory.createMany({ data: historyEntries });
  }

  return `price_sync: ${updated} prices updated, ${unchanged} unchanged, ${historyEntries.length} history entries written`;
}

export async function processVtuFulfilmentJob(job: Job<VtuFulfilmentJob>): Promise<string> {
  switch (job.name) {
    case "poll_status":
      return processPollStatus(job);
    case "reconcile":
      return processReconcile();
    case "plan_catalog_sync":
      return processPlanCatalogSync(job);
    case "cable_catalog_sync":
      return processCableCatalogSync(job);
    case "betting_catalog_sync":
      return processBettingCatalogSync(job);
    case "education_catalog_sync":
      return processEducationCatalogSync(job);
    case "provider_health":
      return processProviderHealth(job);
    case "provider_balance_check":
      return processProviderBalanceCheck(job);
    case "price_sync":
      return processPriceSync(job);
    case "ops_review":
      return processOpsReview(job);
    default:
      return `vtu-fulfilment: unrecognized job name ${job.name}`;
  }
}
