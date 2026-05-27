const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
const path = require("node:path") as typeof import("node:path");

type TaskStatus =
  | "missing"
  | "in-progress"
  | "local-complete"
  | "external-blocked"
  | "evidence-captured"
  | "go"
  | "no-go";

type PhaseStatus =
  | "not-started"
  | "in-progress"
  | "local-complete"
  | "external-blocked"
  | "evidence-captured"
  | "go"
  | "no-go";

type LaneKind = "local" | "hybrid" | "external";

interface LocalCommand {
  label: string;
  command: string;
  required: boolean;
}

interface PhaseDefinition {
  id: number;
  name: string;
  taskStart: number;
  taskEnd: number;
  wave: string;
  lane: string;
  laneKind: LaneKind;
  ownerEnv: string[];
  localChecks: string[];
  externalChecks: string[];
  localCommands: LocalCommand[];
}

interface TaskEvidence {
  taskId: string;
  evidenceEnv: string;
  statusEnv: string;
  status: TaskStatus;
  evidence?: string;
}

interface CommandResult extends LocalCommand {
  status: "pass" | "fail";
  exitCode: number | null;
  output: string;
}

const taskStatuses: TaskStatus[] = [
  "missing",
  "in-progress",
  "local-complete",
  "external-blocked",
  "evidence-captured",
  "go",
  "no-go"
];

const phaseStatuses: PhaseStatus[] = [
  "not-started",
  "in-progress",
  "local-complete",
  "external-blocked",
  "evidence-captured",
  "go",
  "no-go"
];

const phaseDefinitions: PhaseDefinition[] = [
  {
    id: 0,
    name: "Access and ownership",
    taskStart: 1,
    taskEnd: 10,
    wave: "Wave 1 - Foundation",
    lane: "Ownership and access lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_DEPLOY_OWNER", "OPS_SUPPORT_OWNER", "OPS_CAMPAIGN_OWNER"],
    localChecks: [
      "Owner roster, backups, launch channel, incident channel, and permission notes exist.",
      "Admin route permission checks are captured without exposing credentials."
    ],
    externalChecks: [
      "Render access",
      "GitHub release access",
      "Korapay dashboard access",
      "Cloudinary dashboard access",
      "Support inbox access"
    ],
    localCommands: [
      { label: "Phase 0 readiness", command: "node scripts/ops-readiness.ts --phase=0", required: false },
      { label: "Phase 0 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=0", required: true }
    ]
  },
  {
    id: 1,
    name: "Production environment",
    taskStart: 11,
    taskEnd: 25,
    wave: "Wave 1 - Foundation",
    lane: "Production deploy lane",
    laneKind: "hybrid",
    ownerEnv: [
      "OPS_DEPLOY_OWNER",
      "OPS_API_OWNER",
      "OPS_WORKER_OWNER",
      "OPS_MEDIA_OWNER",
      "OPS_PAYMENTS_OWNER"
    ],
    localChecks: [
      "Strict rollout checks pass for API, worker, web, and admin.",
      "Production env review has no demo, mock, or localhost flags.",
      "Backup and migration dry-run evidence is captured."
    ],
    externalChecks: [
      "Render service and env access",
      "Production Postgres and Redis access",
      "GitHub deploy provenance",
      "Korapay live env values",
      "Cloudinary live env values"
    ],
    localCommands: [
      { label: "Phase 1 readiness", command: "node scripts/ops-readiness.ts --phase=1", required: false },
      {
        label: "API rollout check",
        command: "node scripts/rollout-check.ts --stage=managed-ads-mvp --target=api",
        required: false
      },
      {
        label: "Worker rollout check",
        command: "node scripts/rollout-check.ts --stage=managed-ads-mvp --target=worker",
        required: false
      },
      {
        label: "Web rollout check",
        command: "node scripts/rollout-check.ts --stage=managed-ads-mvp --target=web",
        required: false
      },
      {
        label: "Admin rollout check",
        command: "node scripts/rollout-check.ts --stage=managed-ads-mvp --target=admin",
        required: false
      },
      { label: "Phase 1 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=1", required: true }
    ]
  },
  {
    id: 2,
    name: "Admin operations setup",
    taskStart: 26,
    taskEnd: 40,
    wave: "Wave 2 - Product proof",
    lane: "Admin operations lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_CAMPAIGN_OWNER", "OPS_API_OWNER"],
    localChecks: [
      "Admin queue, assignments, notes, status matrix, audit log, empty states, and mobile fallback are verified.",
      "Operator roster and SLA rules are posted."
    ],
    externalChecks: [
      "Production admin credentials for named operators",
      "Launch roster approval from operations lead"
    ],
    localCommands: [
      { label: "Phase 2 readiness", command: "node scripts/ops-readiness.ts --target=admin --phase=2", required: false },
      { label: "Phase 2 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=2", required: true }
    ]
  },
  {
    id: 3,
    name: "Client flow setup",
    taskStart: 41,
    taskEnd: 50,
    wave: "Wave 2 - Product proof",
    lane: "Client journey lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_API_OWNER", "OPS_SUPPORT_OWNER", "OPS_PAYMENTS_OWNER"],
    localChecks: [
      "Signup, profile, intake, campaign detail, reports visibility, billing, and mobile checks are recorded.",
      "Client-facing screens do not expose internal IDs or raw operational terms."
    ],
    externalChecks: [
      "Approved launch client account",
      "Verified contact details",
      "Production billing contact"
    ],
    localCommands: [
      { label: "Phase 3 readiness", command: "node scripts/ops-readiness.ts --target=web --phase=3", required: false },
      { label: "Phase 3 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=3", required: true }
    ]
  },
  {
    id: 4,
    name: "Manual launch accounts",
    taskStart: 51,
    taskEnd: 60,
    wave: "Wave 3 - External operations",
    lane: "External ads lane",
    laneKind: "external",
    ownerEnv: ["OPS_CAMPAIGN_OWNER", "OPS_PAYMENTS_OWNER", "OPS_MEDIA_OWNER"],
    localChecks: [
      "Naming, UTM, spend cap, proof, placement, and live-before-proof policies are posted."
    ],
    externalChecks: [
      "Meta Business/Ads Manager access",
      "TikTok Ads Manager access",
      "Instagram/Facebook page access",
      "Ad policy escalation path"
    ],
    localCommands: [
      { label: "Phase 4 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=4", required: true }
    ]
  },
  {
    id: 5,
    name: "Payments and reconciliation",
    taskStart: 61,
    taskEnd: 70,
    wave: "Wave 3 - External operations",
    lane: "Payments lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_PAYMENTS_OWNER"],
    localChecks: [
      "Payment intent, webhook idempotency, invoice link, budget holds, captures, releases, and reversal playbook are captured."
    ],
    externalChecks: [
      "Korapay live or approved sandbox access",
      "Webhook endpoint access",
      "Treasury or bank details",
      "Finance approver availability"
    ],
    localCommands: [
      { label: "Phase 5 readiness", command: "node scripts/ops-readiness.ts --target=api --phase=5", required: false },
      { label: "Phase 5 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=5", required: true }
    ]
  },
  {
    id: 6,
    name: "Media and report evidence",
    taskStart: 71,
    taskEnd: 80,
    wave: "Wave 2 - Product proof",
    lane: "Media and reports lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_MEDIA_OWNER", "OPS_CAMPAIGN_OWNER", "OPS_API_OWNER", "OPS_SUPPORT_OWNER"],
    localChecks: [
      "Image/video upload paths, rejected uploads, proof visibility, report draft, preview, publish, and notification evidence are captured."
    ],
    externalChecks: [
      "Cloudinary dashboard access",
      "Upload preset and secrets",
      "Proof assets from real external launches when required"
    ],
    localCommands: [
      { label: "Phase 6 readiness", command: "node scripts/ops-readiness.ts --target=web --phase=6", required: false },
      { label: "Phase 6 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=6", required: true }
    ]
  },
  {
    id: 7,
    name: "Notifications and support",
    taskStart: 81,
    taskEnd: 90,
    wave: "Wave 3 - External operations",
    lane: "Support lane",
    laneKind: "hybrid",
    ownerEnv: ["OPS_SUPPORT_OWNER"],
    localChecks: [
      "Notification routes, support macros, incident templates, and disabled-provider behavior are captured."
    ],
    externalChecks: [
      "Support inbox access",
      "Customer comms approval",
      "WhatsApp or notification provider access when enabled"
    ],
    localCommands: [
      { label: "Phase 7 readiness", command: "node scripts/ops-readiness.ts --phase=7", required: false },
      { label: "Phase 7 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=7", required: true }
    ]
  },
  {
    id: 8,
    name: "Monitoring and alerts",
    taskStart: 91,
    taskEnd: 100,
    wave: "Wave 3 - External operations",
    lane: "Monitoring lane",
    laneKind: "external",
    ownerEnv: [
      "OPS_API_OWNER",
      "OPS_WORKER_OWNER",
      "OPS_DEPLOY_OWNER",
      "OPS_PAYMENTS_OWNER",
      "OPS_MEDIA_OWNER",
      "OPS_SUPPORT_OWNER"
    ],
    localChecks: [
      "Alert names or manual review cadences, queue/payment/media cadence, deploy notification test, and owner contact path are captured."
    ],
    externalChecks: [
      "Render alert configuration",
      "Postgres and Redis dashboard access",
      "Korapay/payment alert source",
      "Cloudinary usage and error views"
    ],
    localCommands: [
      { label: "Phase 8 readiness", command: "node scripts/ops-readiness.ts --phase=8", required: false },
      { label: "Phase 8 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=8", required: true }
    ]
  },
  {
    id: 9,
    name: "Go/no-go and rollback",
    taskStart: 101,
    taskEnd: 110,
    wave: "Wave 4 - Launch decision",
    lane: "Go/no-go lane",
    laneKind: "hybrid",
    ownerEnv: [
      "OPS_DEPLOY_OWNER",
      "OPS_ROLLBACK_OWNER",
      "OPS_PAYMENTS_OWNER",
      "OPS_SUPPORT_OWNER",
      "OPS_CAMPAIGN_OWNER"
    ],
    localChecks: [
      "Smoke campaign IDs, UI audit screenshots, rollback target/order, reconciliation plan, customer messaging, signoff, and freeze notice are captured."
    ],
    externalChecks: [
      "Render rollback permissions",
      "GitHub deploy provenance",
      "Payment reconciliation approval",
      "Customer comms approval"
    ],
    localCommands: [
      { label: "Phase 9 readiness", command: "node scripts/ops-readiness.ts --phase=9", required: false },
      { label: "Local smoke", command: "tsx scripts/smoke.ts", required: false },
      { label: "Phase 9 evidence status", command: "node scripts/managed-ads-evidence.ts --phase=9", required: true }
    ]
  }
];

const localCommandTimeoutMs = 120_000;

function arg(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=", 2)[1];
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function formatTaskId(taskNumber: number) {
  return `OPS-${String(taskNumber).padStart(3, "0")}`;
}

function formatEvidenceEnv(taskNumber: number) {
  return `OPS_${String(taskNumber).padStart(3, "0")}_EVIDENCE`;
}

function formatStatusEnv(taskNumber: number) {
  return `OPS_${String(taskNumber).padStart(3, "0")}_STATUS`;
}

function formatPhaseStatusEnv(phaseId: number) {
  return `OPS_PHASE_${phaseId}_STATUS`;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function normalizeTaskStatus(raw: string | undefined, evidence: string | undefined): TaskStatus {
  if (!raw) {
    return evidence ? "evidence-captured" : "missing";
  }

  const normalized = raw.trim().toLowerCase();

  if (!taskStatuses.includes(normalized as TaskStatus)) {
    throw new Error(`${raw} is not a valid task status. Use ${taskStatuses.join(", ")}.`);
  }

  return normalized as TaskStatus;
}

function normalizePhaseStatus(raw: string | undefined): PhaseStatus | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();

  if (!phaseStatuses.includes(normalized as PhaseStatus)) {
    throw new Error(`${raw} is not a valid phase status. Use ${phaseStatuses.join(", ")}.`);
  }

  return normalized as PhaseStatus;
}

function taskNumbersForPhase(phase: PhaseDefinition) {
  return Array.from({ length: phase.taskEnd - phase.taskStart + 1 }, (_, index) => {
    return phase.taskStart + index;
  });
}

function taskEvidence(taskNumber: number): TaskEvidence {
  const evidenceEnv = formatEvidenceEnv(taskNumber);
  const statusEnv = formatStatusEnv(taskNumber);
  const evidence = readEnv(evidenceEnv);

  return {
    taskId: formatTaskId(taskNumber),
    evidenceEnv,
    statusEnv,
    status: normalizeTaskStatus(readEnv(statusEnv), evidence),
    evidence
  };
}

function statusCounts(tasks: TaskEvidence[]) {
  return {
    total: tasks.length,
    complete: tasks.filter((task) =>
      ["local-complete", "evidence-captured", "go"].includes(task.status)
    ).length,
    missing: tasks.filter((task) => task.status === "missing").length,
    inProgress: tasks.filter((task) => task.status === "in-progress").length,
    blocked: tasks.filter((task) => task.status === "external-blocked").length,
    noGo: tasks.filter((task) => task.status === "no-go").length
  };
}

function derivedPhaseStatus(phase: PhaseDefinition, tasks: TaskEvidence[]): PhaseStatus {
  const override = normalizePhaseStatus(readEnv(formatPhaseStatusEnv(phase.id)));

  if (override) {
    return override;
  }

  const counts = statusCounts(tasks);

  if (counts.noGo > 0) {
    return "no-go";
  }

  if (counts.complete === counts.total) {
    return phase.id === 9 ? "go" : "evidence-captured";
  }

  if (counts.blocked > 0) {
    return "external-blocked";
  }

  if (counts.complete > 0 || counts.inProgress > 0) {
    return "in-progress";
  }

  return "not-started";
}

function selectedPhases() {
  const rawPhase = arg("phase");

  if (!rawPhase) {
    return phaseDefinitions;
  }

  const phaseId = Number(rawPhase);

  if (!Number.isInteger(phaseId)) {
    throw new Error("--phase must be an integer from 0 to 9.");
  }

  const phase = phaseDefinitions.find((entry) => entry.id === phaseId);

  if (!phase) {
    throw new Error("--phase must be an integer from 0 to 9.");
  }

  return [phase];
}

function validatePhaseDefinitions() {
  const errors: string[] = [];
  const coveredTasks = phaseDefinitions.flatMap(taskNumbersForPhase);

  phaseDefinitions.forEach((phase, index) => {
    if (phase.id !== index) {
      errors.push(`Phase index ${index} has id ${phase.id}.`);
    }
    if (phase.taskStart > phase.taskEnd) {
      errors.push(`Phase ${phase.id} has an invalid task range.`);
    }
    if (index > 0 && phaseDefinitions[index - 1]?.taskEnd + 1 !== phase.taskStart) {
      errors.push(`Phase ${phase.id} does not continue the OPS task sequence.`);
    }
    if (phase.localCommands.length === 0) {
      errors.push(`Phase ${phase.id} has no local commands.`);
    }
  });

  for (let taskNumber = 1; taskNumber <= 110; taskNumber += 1) {
    if (coveredTasks[taskNumber - 1] !== taskNumber) {
      errors.push(`Expected ${formatTaskId(taskNumber)} at position ${taskNumber}.`);
    }
  }

  if (coveredTasks.length !== 110) {
    errors.push("Phase runner must cover exactly OPS-001 through OPS-110.");
  }

  return errors;
}

function workerPrompt(phase: PhaseDefinition) {
  const taskRange = `${formatTaskId(phase.taskStart)} - ${formatTaskId(phase.taskEnd)}`;

  return [
    `You are the phase ${phase.id} worker for ${phase.name}.`,
    "You are not alone in the codebase; do not revert changes made by others.",
    `Scope: ${taskRange}. Owners: ${phase.ownerEnv.join(", ")}.`,
    `Lane: ${phase.lane} (${phase.laneKind}).`,
    "Capture real evidence in launch notes or set OPS_NNN_EVIDENCE and OPS_NNN_STATUS.",
    "Use external-blocked for provider/dashboard/human approval work that cannot be proven locally.",
    `Local checks: ${phase.localChecks.join(" ")}`,
    `External blockers: ${phase.externalChecks.join("; ")}.`
  ].join(" ");
}

function phasePayload(phase: PhaseDefinition, commandResults: CommandResult[] = []) {
  const tasks = taskNumbersForPhase(phase).map(taskEvidence);

  return {
    id: phase.id,
    name: phase.name,
    taskRange: `${formatTaskId(phase.taskStart)} - ${formatTaskId(phase.taskEnd)}`,
    status: derivedPhaseStatus(phase, tasks),
    statusEnv: formatPhaseStatusEnv(phase.id),
    wave: phase.wave,
    lane: phase.lane,
    laneKind: phase.laneKind,
    owners: phase.ownerEnv,
    counts: statusCounts(tasks),
    tasks,
    localChecks: phase.localChecks,
    externalChecks: phase.externalChecks,
    localCommands: phase.localCommands,
    commandResults,
    workerPrompt: workerPrompt(phase)
  };
}

function groupedWaves(phases: PhaseDefinition[]) {
  const waves = new Map<string, PhaseDefinition[]>();

  for (const phase of phases) {
    waves.set(phase.wave, [...(waves.get(phase.wave) ?? []), phase]);
  }

  return Array.from(waves.entries()).map(([wave, entries]) => ({ wave, phases: entries }));
}

function runCommand(localCommand: LocalCommand): CommandResult {
  const [program, ...rawArgs] = localCommand.command.split(" ");
  const tsxExecutable = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx"
  );
  const executable = program === "node" ? process.execPath : program === "tsx" ? tsxExecutable : program;
  const usesShell = program === "tsx";
  const commandExecutable = usesShell ? localCommand.command : executable;
  const commandArgs = usesShell ? [] : rawArgs;
  const result = spawnSync(commandExecutable, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: usesShell,
    timeout: localCommandTimeoutMs,
    windowsHide: true
  });
  const output = [
    result.stdout,
    result.stderr,
    result.error ? `error: ${result.error.message}` : undefined,
    result.signal ? `signal: ${result.signal}` : undefined
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  const exitCode = result.status;

  return {
    ...localCommand,
    status: exitCode === 0 ? "pass" : "fail",
    exitCode,
    output
  };
}

function runLocalCommands(phases: PhaseDefinition[]) {
  const results = new Map<number, CommandResult[]>();

  for (const phase of phases) {
    const phaseResults = phase.localCommands.map(runCommand);
    results.set(phase.id, phaseResults);
  }

  return results;
}

function printHelp() {
  console.log(`Managed ads phase runner

Usage:
  pnpm ops:run-phases
  pnpm ops:run-phases -- --phase=5
  pnpm ops:run-phases -- --json
  pnpm ops:run-phases -- --run-local
  pnpm ops:run-phases -- --run-local --strict

Modes:
  default      Group OPS-001..OPS-110 into sequential waves and parallel lanes.
  --json       Emit machine-readable waves, phase status, commands, and worker prompts.
  --run-local  Execute safe local commands for selected phases.
  --strict     Exit non-zero when a required local command fails.

Evidence:
  OPS_001_EVIDENCE=launch-notes#phase-0-owner-roster
  OPS_001_STATUS=evidence-captured
  OPS_PHASE_0_STATUS=external-blocked

Statuses:
  ${taskStatuses.join(", ")}
`);
}

function printTextReport(payload: ReturnType<typeof phasePayload>[]) {
  console.log("Managed ads phase execution plan");
  console.log("");
  console.log("Run order:");
  console.log("- Wave 1 runs phases 0 and 1 first.");
  console.log("- Wave 2 runs phases 2, 3, and 6 in parallel after foundation checks begin.");
  console.log("- Wave 3 runs phases 4, 5, 7, and 8 in parallel while evidence is collected.");
  console.log("- Wave 4 runs phase 9 only after every prior phase is evidence-captured or explicitly accepted as risk.");
  console.log("");

  const phasesByWave = new Map<string, typeof payload>();

  for (const phase of payload) {
    phasesByWave.set(phase.wave, [...(phasesByWave.get(phase.wave) ?? []), phase]);
  }

  for (const [wave, phases] of phasesByWave.entries()) {
    console.log(wave);
    for (const phase of phases) {
      const { counts } = phase;
      console.log(`  Phase ${phase.id}: ${phase.name}`);
      console.log(`    Lane: ${phase.lane} (${phase.laneKind})`);
      console.log(`    Tasks: ${phase.taskRange}`);
      console.log(`    Status: ${phase.status} (${phase.statusEnv})`);
      console.log(
        `    Counts: ${counts.complete}/${counts.total} complete, ${counts.missing} missing, ${counts.inProgress} in progress, ${counts.blocked} blocked, ${counts.noGo} no-go`
      );
      console.log(`    Owners: ${phase.owners.join(", ")}`);
      console.log(`    Local checks: ${phase.localChecks.join(" ")}`);
      console.log(`    External blockers: ${phase.externalChecks.join("; ")}`);
      console.log("    Local commands:");
      for (const command of phase.localCommands) {
        console.log(`      - ${command.command}`);
      }
      if (phase.commandResults.length > 0) {
        console.log("    Command results:");
        for (const result of phase.commandResults) {
          console.log(`      - ${result.label}: ${result.status} (exit ${result.exitCode ?? "null"})`);
        }
      }
      console.log(`    Worker prompt: ${phase.workerPrompt}`);
    }
    console.log("");
  }
}

function main() {
  if (hasFlag("help") || process.argv.includes("-h")) {
    printHelp();

    return;
  }

  const errors = validatePhaseDefinitions();

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    process.exitCode = 1;

    return;
  }

  const phases = selectedPhases();
  const commandResults = hasFlag("run-local") ? runLocalCommands(phases) : new Map<number, CommandResult[]>();
  const payload = phases.map((phase) => phasePayload(phase, commandResults.get(phase.id) ?? []));
  const waves = groupedWaves(phases).map((wave) => ({
    wave: wave.wave,
    phases: payload.filter((phase) => phase.wave === wave.wave)
  }));

  if (hasFlag("json")) {
    console.log(JSON.stringify({ waves, phases: payload }, null, 2));
  } else {
    printTextReport(payload);
  }

  if (hasFlag("strict")) {
    const failedRequiredCommand = payload.some((phase) =>
      phase.commandResults.some((result) => result.required && result.status === "fail")
    );

    if (failedRequiredCommand) {
      process.exitCode = 1;
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Managed ads phase runner failed.");
  process.exitCode = 1;
}
