import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const runnerPath = ["scripts", "managed-ads-phase-runner.ts"] as const;

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

function sourceMentionsPhase(source: string, phase: (typeof expectedPhases)[number]) {
  const phaseIdPattern = new RegExp(`\\b(?:phase\\s*[:=]?\\s*)?${phase.id}\\b`, "i");
  const rangeStart = formatTaskId(phase.taskStart);
  const rangeEnd = formatTaskId(phase.taskEnd);

  return (
    phaseIdPattern.test(source) &&
    (source.includes(phase.name) ||
      (source.includes(rangeStart) && source.includes(rangeEnd)) ||
      (source.includes(`taskStart: ${phase.taskStart}`) && source.includes(`taskEnd: ${phase.taskEnd}`)))
  );
}

function sourceCoversTaskInventory(source: string) {
  const explicitTaskIds = new Set(source.match(/OPS-\d{3}/g) ?? []);
  const explicitlyCoversAllTasks = expectedTaskIds.every((taskId) => explicitTaskIds.has(taskId));

  if (explicitlyCoversAllTasks) {
    return true;
  }

  return expectedPhases.every((phase) => {
    const start = formatTaskId(phase.taskStart);
    const end = formatTaskId(phase.taskEnd);

    return (
      (source.includes(start) && source.includes(end)) ||
      (source.includes(`taskStart: ${phase.taskStart}`) && source.includes(`taskEnd: ${phase.taskEnd}`))
    );
  });
}

describe("managed ads phase runner contracts", () => {
  it("exposes the root phase runner package script", async () => {
    const packageJson = parseRootPackageJson(await readRepoText("package.json"));

    expect(packageJson.scripts["ops:run-phases"]).toBeDefined();
    expect(packageJson.scripts["ops:run-phases"]).toMatch(/scripts[\\/]managed-ads-phase-runner\.ts/);
  });

  it("keeps the root managed ads phase runner source present", async () => {
    const runnerSource = await readRepoText(...runnerPath);

    expect(runnerSource.trim().length).toBeGreaterThan(0);
    expect(runnerSource).toMatch(/\bphase(?:Definitions|s)?\b/i);
  });

  it("keeps runner phase coverage aligned from phase 0 through phase 9", async () => {
    const runnerSource = await readRepoText(...runnerPath);

    for (const phase of expectedPhases) {
      expect(sourceMentionsPhase(runnerSource, phase)).toBe(true);
    }
  });

  it("keeps runner task coverage aligned from OPS-001 through OPS-110", async () => {
    const runnerSource = await readRepoText(...runnerPath);

    expect(sourceCoversTaskInventory(runnerSource)).toBe(true);
    expect(runnerSource).toMatch(/OPS-001/);
    expect(runnerSource).toMatch(/OPS-110/);
  });

  it("mentions grouped waves and parallel execution lanes", async () => {
    const runnerSource = await readRepoText(...runnerPath);

    expect(runnerSource).toMatch(/\bwave(?:s)?\b/i);
    expect(runnerSource).toMatch(/\bparallel\b/i);
    expect(runnerSource).toMatch(/\blane(?:s)?\b/i);
  });

  it("supports externally blocked phase status and CLI filters", async () => {
    const runnerSource = await readRepoText(...runnerPath);

    expect(runnerSource).toContain("external-blocked");
    expect(runnerSource).toContain("--json");
    expect(runnerSource).toContain("--phase");
  });
});
