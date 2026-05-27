type TaskStatus =
  | "missing"
  | "in-progress"
  | "local-complete"
  | "external-blocked"
  | "evidence-captured"
  | "go"
  | "no-go";

interface PhaseDefinition {
  id: number;
  name: string;
  taskStart: number;
  taskEnd: number;
}

interface TaskEvidence {
  taskId: string;
  evidenceEnv: string;
  statusEnv: string;
  status: TaskStatus;
  evidence?: string;
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

const phases: PhaseDefinition[] = [
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
];

function readArg(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=", 2)[1];
}

function formatTaskId(value: number) {
  return `OPS-${String(value).padStart(3, "0")}`;
}

function formatEvidenceEnv(taskNumber: number) {
  return `OPS_${String(taskNumber).padStart(3, "0")}_EVIDENCE`;
}

function formatStatusEnv(taskNumber: number) {
  return `OPS_${String(taskNumber).padStart(3, "0")}_STATUS`;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();

  return value ? value : undefined;
}

function normalizeStatus(raw: string | undefined, evidence: string | undefined): TaskStatus {
  if (!raw) {
    return evidence ? "evidence-captured" : "missing";
  }

  const normalized = raw.trim().toLowerCase();

  if (!taskStatuses.includes(normalized as TaskStatus)) {
    throw new Error(`${raw} is not a valid task status. Use ${taskStatuses.join(", ")}.`);
  }

  return normalized as TaskStatus;
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
    status: normalizeStatus(readEnv(statusEnv), evidence),
    evidence
  };
}

function selectedPhases() {
  const rawPhase = readArg("phase");

  if (!rawPhase) {
    return phases;
  }

  const phaseId = Number(rawPhase);

  if (!Number.isInteger(phaseId)) {
    throw new Error("--phase must be an integer from 0 to 9.");
  }

  const phase = phases.find((entry) => entry.id === phaseId);

  if (!phase) {
    throw new Error("--phase must be an integer from 0 to 9.");
  }

  return [phase];
}

function validatePhaseDefinitions() {
  const errors: string[] = [];
  const coveredTasks = phases.flatMap(taskNumbersForPhase);

  phases.forEach((phase, index) => {
    if (phase.id !== index) {
      errors.push(`Phase index ${index} has id ${phase.id}.`);
    }
    if (phase.taskStart > phase.taskEnd) {
      errors.push(`Phase ${phase.id} has an invalid task range.`);
    }
    if (index > 0 && phases[index - 1]?.taskEnd + 1 !== phase.taskStart) {
      errors.push(`Phase ${phase.id} does not continue the OPS task sequence.`);
    }
  });

  for (let taskNumber = 1; taskNumber <= 110; taskNumber += 1) {
    if (coveredTasks[taskNumber - 1] !== taskNumber) {
      errors.push(`Expected ${formatTaskId(taskNumber)} at position ${taskNumber}.`);
    }
  }

  if (coveredTasks.length !== 110) {
    errors.push("Evidence phases must cover exactly OPS-001 through OPS-110.");
  }

  return errors;
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

function phasePayload(phase: PhaseDefinition) {
  const tasks = taskNumbersForPhase(phase).map(taskEvidence);

  return {
    id: phase.id,
    name: phase.name,
    taskRange: `${formatTaskId(phase.taskStart)} - ${formatTaskId(phase.taskEnd)}`,
    counts: statusCounts(tasks),
    tasks
  };
}

function printHelp() {
  console.log(`Managed ads launch evidence

Usage:
  pnpm ops:evidence
  pnpm ops:evidence -- --phase=5
  pnpm ops:evidence -- --json

Evidence env vars:
  OPS_001_EVIDENCE=launch-notes#phase-0-owner-roster
  OPS_001_STATUS=evidence-captured

Task statuses:
  ${taskStatuses.join(", ")}
`);
}

function printTextReport(payload: ReturnType<typeof phasePayload>[]) {
  console.log("Managed ads launch evidence status");
  console.log("");

  for (const phase of payload) {
    const { counts } = phase;

    console.log(`Phase ${phase.id}: ${phase.name}`);
    console.log(`  Tasks: ${phase.taskRange}`);
    console.log(
      `  Counts: ${counts.complete}/${counts.total} complete, ${counts.missing} missing, ${counts.inProgress} in progress, ${counts.blocked} blocked, ${counts.noGo} no-go`
    );

    const openTasks = phase.tasks.filter((task) =>
      ["missing", "in-progress", "external-blocked", "no-go"].includes(task.status)
    );

    if (openTasks.length > 0) {
      console.log("  Open tasks:");
      for (const task of openTasks) {
        console.log(`  - ${task.taskId}: ${task.status} (${task.evidenceEnv}, ${task.statusEnv})`);
      }
    } else {
      console.log("  Open tasks: none");
    }

    console.log("");
  }
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
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

  const payload = selectedPhases().map(phasePayload);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ phases: payload }, null, 2));

    return;
  }

  printTextReport(payload);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Managed ads evidence check failed.");
  process.exitCode = 1;
}
