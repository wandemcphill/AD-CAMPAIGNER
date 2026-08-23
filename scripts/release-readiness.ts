import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface CheckResult {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number;
  output: string;
  reason?: string;
}

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "artifacts", "release-readiness");
const strict = process.argv.includes("--strict");
const includeSmoke = process.argv.includes("--smoke");
const startedAt = new Date().toISOString();

mkdirSync(outDir, { recursive: true });

function run(name: string, command: string, args: string[], options: { skip?: boolean; reason?: string } = {}): CheckResult {
  if (options.skip) {
    return {
      name,
      command: [command, ...args].join(" "),
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      output: "",
      reason: options.reason
    };
  }

  const started = Date.now();

  try {
    const output = execFileSync(command, args, {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    return {
      name,
      command: [command, ...args].join(" "),
      status: "passed",
      exitCode: 0,
      durationMs: Date.now() - started,
      output: output.slice(-12000)
    };
  } catch (error) {
    const candidate = error as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
    };
    const stdout = candidate.stdout?.toString() ?? "";
    const stderr = candidate.stderr?.toString() ?? candidate.message ?? "";

    return {
      name,
      command: [command, ...args].join(" "),
      status: "failed",
      exitCode: candidate.status ?? 1,
      durationMs: Date.now() - started,
      output: `${stdout}\n${stderr}`.slice(-16000)
    };
  }
}

const results: CheckResult[] = [];

results.push(run("repository verification", "pnpm", ["verify"]));
results.push(run("production Blueprint safety", "pnpm", ["ops:seal"]));

const readinessConfigured = [
  "OPS_DEPLOY_OWNER",
  "OPS_API_OWNER",
  "OPS_SUPPORT_OWNER",
  "OPS_INCIDENT_COMMANDER",
  "OPS_ROLLBACK_OWNER",
  "OPS_LAUNCH_CHANNEL",
  "OPS_INCIDENT_CHANNEL",
  "OPS_SUPPORT_CHANNEL",
  "OPS_OWNER_ROSTER_URL",
  "OPS_LAUNCH_NOTES_URL",
  "OPS_INCIDENT_RUNBOOK_URL",
  "OPS_ROLLBACK_PLAN_URL"
].every((name) => Boolean(process.env[name]?.trim()));

results.push(
  run(
    "operational readiness",
    "pnpm",
    ["ops:readiness", "--", "--target=all", "--phase=all"],
    readinessConfigured
      ? {}
      : {
          skip: !strict,
          reason: "Owner, channel and launch-evidence environment is not configured. Use --strict for a production go/no-go check."
        }
  )
);

if (includeSmoke) {
  results.push(
    run("deployed smoke", "pnpm", ["smoke:deployed"], {
      skip: !process.env.APP_URL,
      reason: "APP_URL is not configured."
    })
  );
}

const failed = results.filter((result) => result.status === "failed");
const finishedAt = new Date().toISOString();
const report = {
  schemaVersion: 1,
  startedAt,
  finishedAt,
  strict,
  includeSmoke,
  go: failed.length === 0,
  failedChecks: failed.map((result) => result.name),
  checks: results
};

const reportPath = resolve(outDir, "release-readiness.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

const markdown = [
  "# Release Readiness Packet",
  "",
  `- Started: ${startedAt}`,
  `- Finished: ${finishedAt}`,
  `- Strict: ${strict ? "yes" : "no"}`,
  `- Deployed smoke: ${includeSmoke ? "requested" : "not requested"}`,
  `- Go / No-Go: ${report.go ? "GO" : "NO-GO"}`,
  "",
  "| Check | Status | Duration |",
  "| --- | --- | ---: |",
  ...results.map((result) => `| ${result.name} | ${result.status.toUpperCase()} | ${result.durationMs} ms |`),
  "",
  failed.length === 0
    ? "All executed release gates passed."
    : `Failed gates: ${failed.map((result) => result.name).join(", ")}`,
  ""
].join("\n");

writeFileSync(resolve(outDir, "release-readiness.md"), markdown, "utf8");

console.log(markdown);
console.log(`Evidence written to ${reportPath}`);

if (failed.length > 0) {
  process.exitCode = 1;
}
