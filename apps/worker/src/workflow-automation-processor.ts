import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";

import type { WorkflowAutomationJob } from "./queues";

// Structured config stored in AutomationWorkflow.config for each triggerKind.
// All fields are optional — workflows without proper config are skipped gracefully.
interface WorkflowConfig {
  cronExpression?: string;           // SCHEDULE — cron string, e.g. "0 9 * * 1" (Mon 9am)
  budgetThresholdPct?: number;       // BUDGET_THRESHOLD — fire when spend >= X% of budget
  walletThresholdMinor?: number;     // WALLET_BALANCE — fire when balance <= X minor units
  performanceThresholdRoas?: number; // PERFORMANCE_THRESHOLD — fire when ROAS < X
  creativeAgeDays?: number;          // CREATIVE_AGE — fire when oldest active creative > X days
  action?: "pause_campaign" | "notify" | "log";
  campaignId?: string;
}

interface AutomationWorkflowRecord {
  id: string;
  workspaceId: string;
  triggerKind: string;
  config: unknown;
}

interface CampaignSpendEntry {
  spendMinor?: number | string | null;
}

interface CampaignWithSpend {
  id: string;
  budgetMinor: number;
  spendEntries?: CampaignSpendEntry[];
}

interface WalletRecord {
  id: string;
  balanceMinor?: number | string | null;
}

interface CampaignCreativeRecord {
  id: string;
  createdAt: string | Date;
}

// Prisma delegates for models that may not yet be generated into the base
// DatabaseClient type. Cast the client through this shape at the boundary so
// call sites stay fully typed.
interface AutomationDb {
  automationWorkflow: {
    update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
    findFirst: (args: { where: unknown }) => Promise<AutomationWorkflowRecord | null>;
    findMany: (args: { where: unknown }) => Promise<AutomationWorkflowRecord[]>;
  };
  campaign: {
    findFirst: (args: { where: unknown; include?: unknown }) => Promise<CampaignWithSpend | null>;
    update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
  };
  wallet: {
    findFirst: (args: { where: unknown }) => Promise<WalletRecord | null>;
  };
  campaignCreative: {
    findFirst: (args: { where: unknown; orderBy?: unknown }) => Promise<CampaignCreativeRecord | null>;
  };
  notification: {
    create: (args: { data: unknown }) => Promise<unknown>;
  };
}

let dbSingleton: DatabaseClient | undefined;

function getDb(): AutomationDb {
  if (!dbSingleton) dbSingleton = createPrismaClient();
  return dbSingleton as unknown as AutomationDb;
}

function readConfig(raw: unknown): WorkflowConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const action = r.action;
  return {
    ...(typeof r.cronExpression === "string" ? { cronExpression: r.cronExpression } : {}),
    ...(typeof r.budgetThresholdPct === "number" ? { budgetThresholdPct: r.budgetThresholdPct } : {}),
    ...(typeof r.walletThresholdMinor === "number"
      ? { walletThresholdMinor: r.walletThresholdMinor }
      : {}),
    ...(typeof r.performanceThresholdRoas === "number"
      ? { performanceThresholdRoas: r.performanceThresholdRoas }
      : {}),
    ...(typeof r.creativeAgeDays === "number" ? { creativeAgeDays: r.creativeAgeDays } : {}),
    ...(action === "pause_campaign" || action === "notify" || action === "log"
      ? { action }
      : {}),
    ...(typeof r.campaignId === "string" ? { campaignId: r.campaignId } : {})
  };
}

function matchesCron(expression: string, now: Date): boolean {
  // Simple hourly/daily/weekly check — avoids adding a cron-parser dep.
  // Full cron parsing can be added later; for now we interpret common patterns:
  // "* * * * *"      — every minute (dev/test)
  // "0 * * * *"      — every hour
  // "0 9 * * *"      — every day at 9am
  // "0 9 * * 1"      — every Monday at 9am
  // Anything else falls through as "matches" to avoid silently skipping.
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return true;
  const [minute, hour, , , weekday] = parts;
  const h = now.getHours();
  const m = now.getMinutes();
  const wd = now.getDay(); // 0=Sun … 6=Sat

  if (hour !== "*" && Number(hour) !== h) return false;
  if (minute !== "*" && Number(minute) !== m) return false;
  if (weekday !== "*" && Number(weekday) !== wd) return false;
  return true;
}

async function recordRun(db: AutomationDb, workflowId: string): Promise<void> {
  await db.automationWorkflow.update({
    where: { id: workflowId },
    data: { runCount: { increment: 1 }, lastRunAt: new Date() }
  });
}

async function executeAction(
  db: AutomationDb,
  workflow: AutomationWorkflowRecord,
  config: WorkflowConfig,
  outcome: string
): Promise<string> {
  switch (config.action) {
    case "pause_campaign": {
      if (!config.campaignId) return `${outcome}:action_skipped:no_campaign_id`;
      const campaign = await db.campaign.findFirst({
        where: { id: config.campaignId, workspaceId: workflow.workspaceId, deletedAt: null }
      });
      if (!campaign) return `${outcome}:action_skipped:campaign_not_found`;
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "PAUSED" }
      });
      return `${outcome}:action_applied:pause_campaign`;
    }

    case "notify": {
      await db.notification.create({
        data: {
          workspaceId: workflow.workspaceId,
          channel: "IN_APP",
          title: `Automation triggered: ${workflow.triggerKind}`,
          body: `Workflow "${workflow.id}" fired (${outcome}).`
        }
      });
      return `${outcome}:action_applied:notify`;
    }

    case "log":
    case undefined:
      return outcome;

    default:
      return `${outcome}:action_skipped:unknown_action`;
  }
}

async function evaluateWorkflow(
  db: AutomationDb,
  workflow: AutomationWorkflowRecord,
  now: Date
): Promise<string> {
  const config = readConfig(workflow.config);

  switch (workflow.triggerKind) {
    case "SCHEDULE": {
      const expr = config.cronExpression;
      if (!expr) return "skipped:no_cron_expression";
      if (!matchesCron(expr, now)) return "skipped:cron_not_matched";
      await recordRun(db, workflow.id);
      return executeAction(db, workflow, config, "fired:schedule");
    }

    case "BUDGET_THRESHOLD": {
      const thresholdPct = config.budgetThresholdPct ?? 80;
      if (!config.campaignId) return "skipped:no_campaign_id";
      const campaign = await db.campaign.findFirst({
        where: { id: config.campaignId, workspaceId: workflow.workspaceId, deletedAt: null },
        include: { spendEntries: true }
      });
      if (!campaign) return "skipped:campaign_not_found";
      const totalSpend = (campaign.spendEntries ?? []).reduce(
        (sum, e) => sum + Number(e.spendMinor ?? 0), 0
      );
      const spendPct = campaign.budgetMinor > 0 ? (totalSpend / campaign.budgetMinor) * 100 : 0;
      if (spendPct < thresholdPct) return `skipped:spend_${Math.round(spendPct)}pct_below_threshold`;
      await recordRun(db, workflow.id);
      return executeAction(db, workflow, config, `fired:budget_threshold_${Math.round(spendPct)}pct`);
    }

    case "WALLET_BALANCE": {
      const threshold = config.walletThresholdMinor ?? 100_000;
      const wallet = await db.wallet.findFirst({
        where: { workspaceId: workflow.workspaceId, deletedAt: null }
      });
      if (!wallet) return "skipped:no_wallet";
      const balance = Number(wallet.balanceMinor ?? 0);
      if (balance > threshold) return `skipped:balance_${balance}_above_threshold`;
      await recordRun(db, workflow.id);
      return executeAction(db, workflow, config, `fired:wallet_balance_${balance}`);
    }

    case "CREATIVE_AGE": {
      const maxDays = config.creativeAgeDays ?? 30;
      if (!config.campaignId) return "skipped:no_campaign_id";
      const oldestCreative = await db.campaignCreative.findFirst({
        where: { campaignId: config.campaignId, deletedAt: null },
        orderBy: { createdAt: "asc" }
      });
      if (!oldestCreative) return "skipped:no_creatives";
      const ageDays = (now.getTime() - new Date(oldestCreative.createdAt).getTime()) / 86_400_000;
      if (ageDays < maxDays) return `skipped:creative_age_${Math.round(ageDays)}d_below_threshold`;
      await recordRun(db, workflow.id);
      return executeAction(db, workflow, config, `fired:creative_age_${Math.round(ageDays)}d`);
    }

    case "PERFORMANCE_THRESHOLD": {
      // ROAS evaluation requires analytics data — record as fired if configured, log otherwise.
      await recordRun(db, workflow.id);
      return executeAction(db, workflow, config, "fired:performance_threshold_check");
    }

    default:
      return "skipped:unknown_trigger_kind";
  }
}

export async function processWorkflowAutomationJob(
  job: Job<WorkflowAutomationJob>
): Promise<{ processed: number; results: string[] }> {
  const db = getDb();
  const now = new Date();
  const results: string[] = [];

  // If a specific workflowId is given, evaluate only that workflow.
  if (job.data.workflowId) {
    const wf = await db.automationWorkflow.findFirst({
      where: { id: job.data.workflowId, status: "ACTIVE", deletedAt: null }
    });
    if (!wf) {
      results.push(`${job.data.workflowId}:skipped:not_found_or_inactive`);
    } else {
      const outcome = await evaluateWorkflow(db, wf, now);
      results.push(`${wf.id}:${outcome}`);
    }
    return { processed: 1, results };
  }

  // Otherwise sweep all ACTIVE workflows (optionally scoped to a workspace).
  const where: Record<string, unknown> = { status: "ACTIVE", deletedAt: null };
  if (job.data.workspaceId) where.workspaceId = job.data.workspaceId;

  const workflows = await db.automationWorkflow.findMany({ where });

  for (const wf of workflows) {
    try {
      const outcome = await evaluateWorkflow(db, wf, now);
      results.push(`${wf.id}:${outcome}`);
    } catch (err) {
      results.push(`${wf.id}:error:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed: workflows.length, results };
}
