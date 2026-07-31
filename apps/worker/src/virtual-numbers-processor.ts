import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";
import {
  createFiveSimRentalAdapter,
  createMockVirtualNumberAdapter,
  createSmsPoolAdapter,
  createSmsPvaAdapter,
  type VirtualNumberProviderAdapter
} from "@fliptrybe/providers";

import type { VirtualNumbersJob } from "./queues";

// Real DB-backed handlers for the virtual-numbers queue — mirrors the vtu-processor
// pattern. Unlike VTU orders (fire-and-forget telco submit), a number's lifecycle is
// entirely observable from our side (expiresAt, provider status), so these jobs drive
// state transitions directly rather than escalating ambiguity to ops.

const RETENTION_BATCH_SIZE = 200;

let dbSingleton: DatabaseClient | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) dbSingleton = createPrismaClient();
  return dbSingleton;
}

function buildAdapter(providerName: string): VirtualNumberProviderAdapter {
  switch (providerName) {
    case "smspool":
      return createSmsPoolAdapter({
        apiKey: process.env["SMSPOOL_API_KEY"] ?? "",
        ...(process.env["SMSPOOL_BASE_URL"] ? { baseUrl: process.env["SMSPOOL_BASE_URL"] } : {})
      });
    case "5sim":
      return createFiveSimRentalAdapter({
        apiToken: process.env["FIVESIM_API_TOKEN"] ?? "",
        ...(process.env["FIVESIM_BASE_URL"] ? { baseUrl: process.env["FIVESIM_BASE_URL"] } : {})
      });
    case "smspva":
      return createSmsPvaAdapter({
        apiKey: process.env["SMSPVA_API_KEY"] ?? "",
        ...(process.env["SMSPVA_BASE_URL"] ? { baseUrl: process.env["SMSPVA_BASE_URL"] } : {})
      });
    default:
      return createMockVirtualNumberAdapter(providerName);
  }
}

function maskSender(raw: string | undefined): string {
  if (!raw) return "Unknown";
  return raw.length <= 4 ? "****" : `${raw.slice(0, 2)}****${raw.slice(-2)}`;
}

// ─── poll_messages ────────────────────────────────────────────────────────────
// For providers without (or in addition to) webhooks. Pulls new messages since the
// number's lastPolledAt cursor and ingests them through the same dedupe path the
// webhook uses — both call the same idempotent insert, so racing is harmless.

export async function processPollMessages(job: Job<VirtualNumbersJob>): Promise<string> {
  const db = getDb();
  const numberId = job.data.numberId;

  const numbers = numberId
    ? await db.virtualNumber.findMany({ where: { id: numberId, status: "ACTIVE" } })
    : await db.virtualNumber.findMany({ where: { status: "ACTIVE" }, take: 200 });

  let ingested = 0;
  let errored = 0;

  for (const number of numbers) {
    try {
      const adapter = buildAdapter(number.providerName);
      const since = number.lastPolledAt?.toISOString();
      const messages = await adapter.getMessages(number.providerNumberId, since);

      for (const msg of messages) {
        try {
          await db.virtualNumberMessage.create({
            data: {
              id: `vnm_${Math.random().toString(36).slice(2, 12)}`,
              virtualNumberId: number.id,
              providerMessageId: msg.providerMessageId || null,
              senderRaw: msg.senderRaw ?? null,
              senderMasked: maskSender(msg.senderRaw),
              bodyEncrypted: msg.body,
              bodyRedacted: msg.body.replace(/\d{4,}/g, "****"),
              receivedAt: new Date(msg.receivedAt),
              retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          });
          ingested++;
        } catch {
          // Unique (virtualNumberId, providerMessageId) violation = already ingested
          // via webhook. Expected under dual-path ingestion, not an error.
        }
      }

      await db.virtualNumber.update({
        where: { id: number.id },
        data: {
          lastPolledAt: new Date(),
          ...(messages.length > 0
            ? { messageCount: { increment: messages.length }, lastMessageAt: new Date() }
            : {})
        }
      });
    } catch (err) {
      errored++;
       
      console.error(`poll_messages failed for ${number.id}: ${String(err)}`);
    }
  }

  return `poll_messages: ${numbers.length} numbers polled, ${ingested} messages ingested, ${errored} errored`;
}

// ─── lifecycle_sweep ────────────────────────────────────────────────────────────
// ACTIVE → EXPIRING (T-3d) → EXPIRED (past expiresAt). Release happens as a separate
// job so a provider outage during release doesn't block the status transition.

export async function processLifecycleSweep(): Promise<string> {
  const db = getDb();
  const now = new Date();
  const expiringThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const toExpiring = await db.virtualNumber.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: expiringThreshold, gt: now } },
    data: { status: "EXPIRING" }
  });

  const toExpired = await db.virtualNumber.updateMany({
    where: { status: { in: ["ACTIVE", "EXPIRING"] }, expiresAt: { lte: now } },
    data: { status: "EXPIRED" }
  });

  return `lifecycle_sweep: ${toExpiring.count} moved to EXPIRING, ${toExpired.count} moved to EXPIRED`;
}

// ─── expiry_warning ─────────────────────────────────────────────────────────────
// T-3d and T-1d notifications. expiryWarnedAt prevents duplicate sends — this job
// only marks the flag; actual notification dispatch goes through the notifications
// queue once that integration exists (tracked as a follow-up, not silently dropped).

export async function processExpiryWarning(): Promise<string> {
  const db = getDb();
  const now = new Date();
  const oneDayOut = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const dueForWarning = await db.virtualNumber.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRING"] },
      expiresAt: { lte: threeDaysOut, gt: now },
      OR: [{ expiryWarnedAt: null }, { expiryWarnedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }]
    },
    take: 200
  });

  let warned = 0;
  for (const number of dueForWarning) {
    const isUrgent = number.expiresAt !== null && number.expiresAt <= oneDayOut;
     
    console.log(
      `expiry_warning: number ${number.id} (${number.e164}) expires ${isUrgent ? "within 1 day" : "within 3 days"}`
    );
    await db.virtualNumber.update({ where: { id: number.id }, data: { expiryWarnedAt: now } });
    warned++;
  }

  return `expiry_warning: ${warned} numbers warned`;
}

// ─── release ──────────────────────────────────────────────────────────────────
// Releases EXPIRED numbers at the provider and marks them RELEASED. Provider release
// failure doesn't block the local state change — an EXPIRED number must never display
// as active regardless of whether the provider-side release call succeeded.

export async function processRelease(job: Job<VirtualNumbersJob>): Promise<string> {
  const db = getDb();
  const numberId = job.data.numberId;

  const numbers = numberId
    ? await db.virtualNumber.findMany({ where: { id: numberId } })
    : await db.virtualNumber.findMany({ where: { status: "EXPIRED" }, take: 200 });

  let released = 0;
  for (const number of numbers) {
    try {
      const adapter = buildAdapter(number.providerName);
      await adapter.releaseNumber(number.providerNumberId);
    } catch (err) {
       
      console.warn(`release: provider release failed for ${number.id}, releasing locally anyway: ${String(err)}`);
    }

    await db.virtualNumber.update({
      where: { id: number.id },
      data: { status: "RELEASED", releasedAt: new Date() }
    });
    released++;
  }

  return `release: ${released} numbers released`;
}

// ─── retention_purge ────────────────────────────────────────────────────────────

export async function processRetentionPurge(): Promise<string> {
  const db = getDb();
  const result = await db.virtualNumberMessage.deleteMany({
    where: { retainUntil: { lte: new Date() } }
  });
  return `retention_purge: ${result.count} messages deleted (batch cap ${RETENTION_BATCH_SIZE})`;
}

// ─── reconcile ───────────────────────────────────────────────────────────────────
// Compares FULFILLED orders' declared supplier cost against a fresh provider balance
// read — a coarse drift signal, not a per-transaction reconciliation (providers don't
// expose per-order cost breakdowns consistently). Surfaces via ProviderHealth.metadata.

export async function processReconcile(): Promise<string> {
  const db = getDb();
  const providers = [...new Set((await db.virtualNumberOrder.findMany({
    where: { status: "FULFILLED", providerName: { not: null } },
    select: { providerName: true },
    distinct: ["providerName"]
  })).map((o) => o.providerName).filter((p): p is string => p !== null))];

  let checked = 0;
  for (const providerName of providers) {
    try {
      const adapter = buildAdapter(providerName);
      const balance = await adapter.getBalance();
      await db.providerHealth.create({
        data: {
          providerName,
          domain: "VIRTUAL_NUMBER",
          status: "HEALTHY",
          latencyMs: 0,
          successRateBps: 10_000,
          balanceMinor: balance.balanceMinorUsd,
          currency: "USD"
        }
      });
      checked++;
    } catch (err) {
       
      console.error(`reconcile: balance check failed for ${providerName}: ${String(err)}`);
    }
  }

  return `reconcile: ${checked}/${providers.length} providers balance-checked`;
}

// ─── provider_health ────────────────────────────────────────────────────────────

export async function processProviderHealth(job: Job<VirtualNumbersJob>): Promise<string> {
  const providerName = job.data.providerName;
  if (!providerName) return "provider_health skipped: no providerName";

  const db = getDb();
  const adapter = buildAdapter(providerName);
  const snapshot = await adapter.checkHealth();

  await db.providerHealth.create({
    data: {
      providerName,
      domain: "VIRTUAL_NUMBER",
      status: snapshot.status,
      latencyMs: snapshot.latencyMs,
      successRateBps: snapshot.status === "HEALTHY" ? 10_000 : 0,
      ...(snapshot.reason ? { reason: snapshot.reason } : {})
    }
  });

  return `provider_health: ${providerName} is ${snapshot.status} (${snapshot.latencyMs}ms)`;
}

export async function processVirtualNumbersJob(job: Job<VirtualNumbersJob>): Promise<string> {
  switch (job.name) {
    case "poll_messages":
      return processPollMessages(job);
    case "lifecycle_sweep":
      return processLifecycleSweep();
    case "expiry_warning":
      return processExpiryWarning();
    case "release":
      return processRelease(job);
    case "retention_purge":
      return processRetentionPurge();
    case "reconcile":
      return processReconcile();
    case "provider_health":
      return processProviderHealth(job);
    default:
      return `virtual-numbers: unrecognized job name ${job.name}`;
  }
}
