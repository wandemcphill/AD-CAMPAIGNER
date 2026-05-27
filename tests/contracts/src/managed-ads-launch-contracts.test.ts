import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const expectedPhases = [
  { id: 0, name: "Access and ownership", taskStart: 1, taskEnd: 10 },
  { id: 1, name: "Production environment", taskStart: 11, taskEnd: 25 },
  { id: 2, name: "Admin operations setup", taskStart: 26, taskEnd: 40 },
  { id: 3, name: "Client flow setup", taskStart: 41, taskEnd: 50 },
  { id: 4, name: "Manual launch accounts", taskStart: 51, taskEnd: 60 },
  { id: 5, name: "Payments and reconciliation", taskStart: 61, taskEnd: 70 },
  { id: 6, name: "Media and report evidence", taskStart: 71, taskEnd: 80 },
  { id: 7, name: "Notifications and support", taskStart: 81, taskEnd: 90 },
  { id: 8, name: "Monitoring and alerts", taskStart: 91, taskEnd: 100 },
  { id: 9, name: "Go/no-go and rollback", taskStart: 101, taskEnd: 110 }
] as const;

const expectedTaskIds = Array.from({ length: 110 }, (_, index) => formatTaskId(index + 1));

interface RootPackageJson {
  scripts: Record<string, string>;
}

function repoPath(...segments: string[]) {
  return path.join(repoRoot, ...segments);
}

function readRepoText(...segments: string[]) {
  return readFile(repoPath(...segments), "utf8");
}

function formatTaskId(value: number) {
  return `OPS-${String(value).padStart(3, "0")}`;
}

function phaseRange(phase: (typeof expectedPhases)[number]) {
  return `${formatTaskId(phase.taskStart)} - ${formatTaskId(phase.taskEnd)}`;
}

function parseRootPackageJson(source: string): RootPackageJson {
  const value: unknown = JSON.parse(source);

  if (!value || typeof value !== "object" || !("scripts" in value)) {
    throw new Error("Root package.json must expose scripts.");
  }

  const scripts = value.scripts;

  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
    throw new Error("Root package.json scripts must be an object.");
  }

  return scriptsObject(scripts);
}

function scriptsObject(value: object): RootPackageJson {
  const scripts: Record<string, string> = {};

  for (const [key, script] of Object.entries(value)) {
    if (typeof script !== "string") {
      throw new Error(`Root package.json script ${key} must be a string.`);
    }

    scripts[key] = script;
  }

  return { scripts };
}

function extractInventoryTaskIds(source: string) {
  return Array.from(source.matchAll(/^\| (OPS-\d{3}) \|/gm), (match) => match[1]);
}

function extractPhaseRows(source: string) {
  return Array.from(
    source.matchAll(
      /id:\s*(\d+),\s*name:\s*"([^"]+)",\s*taskStart:\s*(\d+),\s*taskEnd:\s*(\d+)/g
    ),
    (match) => ({
      id: Number(match[1]),
      name: match[2] ?? "",
      taskStart: Number(match[3]),
      taskEnd: Number(match[4])
    })
  );
}

describe("managed ads launch tooling contracts", () => {
  it("keeps the production task inventory contiguous from OPS-001 through OPS-110", async () => {
    const taskInventory = await readRepoText("docs", "MANAGED_ADS_PRODUCTION_TASKS.md");
    const taskIds = extractInventoryTaskIds(taskInventory);

    expect(taskIds).toEqual(expectedTaskIds);
    expect(new Set(taskIds).size).toBe(expectedTaskIds.length);
  });

  it("keeps the phase script aligned to the managed ads task sequence", async () => {
    const phaseScript = await readRepoText("scripts", "managed-ads-phases.ts");
    const phaseRows = extractPhaseRows(phaseScript);
    const coveredTaskIds = phaseRows.flatMap((phase) =>
      Array.from({ length: phase.taskEnd - phase.taskStart + 1 }, (_, index) =>
        formatTaskId(phase.taskStart + index)
      )
    );

    expect(phaseRows).toEqual(expectedPhases);
    expect(coveredTaskIds).toEqual(expectedTaskIds);
    expect(phaseScript).toContain("Phase definitions must cover OPS-001 through OPS-110.");
  });

  it("exposes root launch scripts for phase reporting and readiness checks", async () => {
    const packageJson = parseRootPackageJson(await readRepoText("package.json"));

    expect(packageJson.scripts["ops:phases"]).toBe("node scripts/managed-ads-phases.ts");
    expect(packageJson.scripts["ops:evidence"]).toBe("node scripts/managed-ads-evidence.ts");
    expect(packageJson.scripts["ops:readiness"]).toBe("tsx scripts/ops-readiness.ts");
  });

  it("keeps the evidence packet complete for every launch phase", async () => {
    const evidencePacket = await readRepoText("docs", "MANAGED_ADS_EVIDENCE_PACKET.md");
    const normalizedEvidencePacket = evidencePacket.toLowerCase();

    for (const phase of expectedPhases) {
      expect(normalizedEvidencePacket).toContain(
        `## phase ${phase.id} - ${phase.name} (${phaseRange(phase)})`.toLowerCase()
      );
      expect(evidencePacket).toContain(`Phase ${phase.id} - ${phase.name}:`);
      expect(evidencePacket).toContain(`Phase ${phase.id} evidence`);

      if (phase.id === 9) {
        expect(evidencePacket).toContain("- Final decision: Go / Go with risk / No-go");
      } else {
        expect(evidencePacket).toContain("- Phase decision: Go / Go with risk / No-go");
      }
    }

    for (const launchIndexField of [
      "Launch date:",
      "Launch commander:",
      "Backup commander:",
      "Launch channel:",
      "Incident channel:",
      "Customer support channel:",
      "Target commit:",
      "Rollback commit:",
      "Open risks:",
      "Final decision:"
    ]) {
      expect(evidencePacket).toContain(launchIndexField);
    }

    for (const templateName of [
      "Owner Signoff Template",
      "Final Go/No-Go Template",
      "Rollback Template",
      "Payment Mismatch Incident Template",
      "External Ad Rejection Incident Template",
      "Support Macro - Brief Received",
      "Support Macro - Invoice Ready",
      "Support Macro - Campaign Live",
      "Support Macro - Report Published",
      "Support Macro - Incident Active",
      "Support Macro - Incident Resolved"
    ]) {
      expect(evidencePacket).toContain(`### ${templateName}`);
    }
  });

  it("keeps tracker links, phase rows, and external credential coverage present", async () => {
    const tracker = await readRepoText("docs", "MANAGED_ADS_LAUNCH_TRACKER.md");

    expect(tracker).toContain("`docs/MANAGED_ADS_PRODUCTION_TASKS.md`");
    expect(tracker).toContain("`docs/MANAGED_ADS_EVIDENCE_PACKET.md`");
    expect(tracker).toContain("`corepack pnpm ops:phases`");
    expect(tracker).toContain("`corepack pnpm ops:phases -- --json`");
    expect(tracker).toContain("`corepack pnpm ops:evidence`");
    expect(tracker).toContain("`docs/MANAGED_ADS_MONITORING_RUNBOOK.md`");

    for (const phase of expectedPhases) {
      expect(tracker).toContain(`| ${phase.id}. ${phase.name} | ${phaseRange(phase)} |`);
    }

    for (const externalSystem of [
      "Render",
      "GitHub auth/repo access",
      "Korapay",
      "Cloudinary",
      "Meta Business/Ads Manager",
      "TikTok Ads Manager",
      "Support inbox/channel"
    ]) {
      expect(tracker).toContain(`| ${externalSystem} |`);
    }
  });
});
