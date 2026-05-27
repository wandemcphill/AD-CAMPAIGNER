type PhaseStatus =
  | "not-started"
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
  primaryOwnerEnv: string[];
  launchGate: string;
  localEvidence: string[];
  externalBlockers: string[];
}

const phaseStatuses: PhaseStatus[] = [
  "not-started",
  "in-progress",
  "local-complete",
  "external-blocked",
  "evidence-captured",
  "go",
  "no-go"
];

const phases: PhaseDefinition[] = [
  {
    id: 0,
    name: "Access and ownership",
    taskStart: 1,
    taskEnd: 10,
    primaryOwnerEnv: ["OPS_DEPLOY_OWNER", "OPS_SUPPORT_OWNER", "OPS_CAMPAIGN_OWNER"],
    launchGate: "Every owner slot has a named human, backup, channel, and escalation path.",
    localEvidence: [
      "Owner map filled in",
      "Launch and incident channels created",
      "Admin route permission checks recorded"
    ],
    externalBlockers: [
      "Render access",
      "GitHub auth or repo access",
      "Korapay dashboard access",
      "Cloudinary dashboard access"
    ]
  },
  {
    id: 1,
    name: "Production environment",
    taskStart: 11,
    taskEnd: 25,
    primaryOwnerEnv: [
      "OPS_DEPLOY_OWNER",
      "OPS_API_OWNER",
      "OPS_WORKER_OWNER",
      "OPS_MEDIA_OWNER",
      "OPS_PAYMENTS_OWNER"
    ],
    launchGate: "Production services are on the expected commit with strict preflight evidence.",
    localEvidence: [
      "Rollout checks pass for API, worker, web, and admin",
      "Production env review has no demo/mock flags",
      "Backup and migration dry run are recorded"
    ],
    externalBlockers: [
      "Render service/env access",
      "Production Postgres/Redis access",
      "GitHub deploy provenance",
      "Korapay live env values",
      "Cloudinary live env values"
    ]
  },
  {
    id: 2,
    name: "Admin operations setup",
    taskStart: 26,
    taskEnd: 40,
    primaryOwnerEnv: ["OPS_CAMPAIGN_OWNER", "OPS_API_OWNER"],
    launchGate: "Operators can safely triage, assign, update, and audit campaign work.",
    localEvidence: [
      "Admin queue and permissions verified",
      "Status matrix, notes, audit log, and empty states verified",
      "Mobile admin checks recorded"
    ],
    externalBlockers: [
      "Production admin credentials for named operators",
      "Launch roster approval from operations lead"
    ]
  },
  {
    id: 3,
    name: "Client flow setup",
    taskStart: 41,
    taskEnd: 50,
    primaryOwnerEnv: ["OPS_API_OWNER", "OPS_SUPPORT_OWNER", "OPS_PAYMENTS_OWNER"],
    launchGate: "A real client can submit and review campaign state without internal leakage.",
    localEvidence: [
      "Signup/login and business profile checks recorded",
      "Campaign intake and detail checks recorded",
      "Billing, reports visibility, and mobile checks recorded"
    ],
    externalBlockers: [
      "Approved launch client account",
      "Verified contact details",
      "Production billing contact"
    ]
  },
  {
    id: 4,
    name: "Manual launch accounts",
    taskStart: 51,
    taskEnd: 60,
    primaryOwnerEnv: ["OPS_CAMPAIGN_OWNER", "OPS_PAYMENTS_OWNER", "OPS_MEDIA_OWNER"],
    launchGate: "External campaign launch process is usable before any client spend is at risk.",
    localEvidence: [
      "Naming, UTM, spend cap, and proof standards documented",
      "Placement field and live-before-proof policy documented"
    ],
    externalBlockers: [
      "Meta Business/Ads Manager access",
      "TikTok Ads Manager access",
      "Instagram/Facebook page access",
      "Ad policy escalation path"
    ]
  },
  {
    id: 5,
    name: "Payments and reconciliation",
    taskStart: 61,
    taskEnd: 70,
    primaryOwnerEnv: ["OPS_PAYMENTS_OWNER"],
    launchGate: "Money state reconciles exactly once from provider event to visible wallet/invoice state.",
    localEvidence: [
      "Payment intent and webhook idempotency evidence captured",
      "Invoice link, budget hold, capture/release, and insufficient balance evidence captured",
      "Reversal playbook exists"
    ],
    externalBlockers: [
      "Korapay live or approved sandbox access",
      "Webhook endpoint access",
      "Treasury/bank details",
      "Finance approver availability"
    ]
  },
  {
    id: 6,
    name: "Media and report evidence",
    taskStart: 71,
    taskEnd: 80,
    primaryOwnerEnv: [
      "OPS_MEDIA_OWNER",
      "OPS_CAMPAIGN_OWNER",
      "OPS_API_OWNER",
      "OPS_SUPPORT_OWNER"
    ],
    launchGate: "Media, proofs, and reports can be created, reviewed, published, and hidden correctly.",
    localEvidence: [
      "Image/video upload and rejected upload cases recorded",
      "Proof visibility checks recorded",
      "Report draft, preview, and publish checks recorded"
    ],
    externalBlockers: [
      "Cloudinary dashboard access",
      "Upload preset/secrets",
      "Proof assets from real external launches if required"
    ]
  },
  {
    id: 7,
    name: "Notifications and support",
    taskStart: 81,
    taskEnd: 90,
    primaryOwnerEnv: ["OPS_SUPPORT_OWNER"],
    launchGate: "Customers and operators have a staffed path for normal questions and incidents.",
    localEvidence: [
      "Notification routes checked",
      "Support channel and support macros captured",
      "Incident templates and disabled-provider checks captured"
    ],
    externalBlockers: [
      "Support inbox access",
      "Customer comms approval",
      "WhatsApp/provider access if enabled"
    ]
  },
  {
    id: 8,
    name: "Monitoring and alerts",
    taskStart: 91,
    taskEnd: 100,
    primaryOwnerEnv: [
      "OPS_API_OWNER",
      "OPS_WORKER_OWNER",
      "OPS_DEPLOY_OWNER",
      "OPS_PAYMENTS_OWNER",
      "OPS_MEDIA_OWNER",
      "OPS_SUPPORT_OWNER"
    ],
    launchGate: "Owners can see failures quickly and know who responds.",
    localEvidence: [
      "Alert names or manual review cadences captured",
      "Queue/payment/media review cadence recorded",
      "Deploy notification test and owner contact path recorded"
    ],
    externalBlockers: [
      "Render alert configuration",
      "Postgres/Redis dashboard access",
      "Korapay/payment alert source",
      "Cloudinary usage/error views"
    ]
  },
  {
    id: 9,
    name: "Go/no-go and rollback",
    taskStart: 101,
    taskEnd: 110,
    primaryOwnerEnv: [
      "OPS_DEPLOY_OWNER",
      "OPS_ROLLBACK_OWNER",
      "OPS_PAYMENTS_OWNER",
      "OPS_SUPPORT_OWNER",
      "OPS_CAMPAIGN_OWNER"
    ],
    launchGate: "Full smoke is complete, rollback is known, and every owner signs off.",
    localEvidence: [
      "Smoke campaign IDs and UI audit screenshots captured",
      "Rollback target/order and reconciliation plan captured",
      "Customer messaging plan, signoff thread, and config freeze notice captured"
    ],
    externalBlockers: [
      "Render rollback permissions",
      "GitHub deploy provenance",
      "Payment reconciliation approval",
      "Customer comms approval"
    ]
  }
];

function readArg(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=", 2)[1];
}

function phaseTaskIds(phase: PhaseDefinition) {
  return Array.from({ length: phase.taskEnd - phase.taskStart + 1 }, (_, index) => {
    return `OPS-${String(phase.taskStart + index).padStart(3, "0")}`;
  });
}

function phaseStatusEnvName(phase: PhaseDefinition) {
  return `OPS_PHASE_${phase.id}_STATUS`;
}

function phaseStatus(phase: PhaseDefinition): PhaseStatus {
  const raw = process.env[phaseStatusEnvName(phase)]?.trim().toLowerCase();

  if (!raw) {
    return "not-started";
  }

  if (!phaseStatuses.includes(raw as PhaseStatus)) {
    throw new Error(
      `${phaseStatusEnvName(phase)} must be one of ${phaseStatuses.join(", ")}. Received ${raw}.`
    );
  }

  return raw as PhaseStatus;
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
    if (phase.primaryOwnerEnv.length === 0) {
      errors.push(`Phase ${phase.id} has no primary owner env vars.`);
    }
  });

  const first = phases[0];
  const last = phases[phases.length - 1];

  if (first?.taskStart !== 1 || last?.taskEnd !== 110) {
    errors.push("Phase definitions must cover OPS-001 through OPS-110.");
  }

  return errors;
}

function phasePayload(phase: PhaseDefinition) {
  return {
    id: phase.id,
    name: phase.name,
    status: phaseStatus(phase),
    statusEnv: phaseStatusEnvName(phase),
    tasks: phaseTaskIds(phase),
    owners: phase.primaryOwnerEnv,
    launchGate: phase.launchGate,
    localEvidence: phase.localEvidence,
    externalBlockers: phase.externalBlockers
  };
}

function printHelp() {
  console.log(`Managed ads launch phases

Usage:
  pnpm ops:phases
  pnpm ops:phases -- --json
  pnpm ops:phases -- --phase=5

Optional status env vars:
  OPS_PHASE_0_STATUS=not-started|in-progress|local-complete|external-blocked|evidence-captured|go|no-go
  ...repeat through OPS_PHASE_9_STATUS
`);
}

function printTextReport(payload: ReturnType<typeof phasePayload>[]) {
  console.log("Managed ads production launch phases");
  console.log("");

  for (const phase of payload) {
    const taskRange = `${phase.tasks[0]} - ${phase.tasks[phase.tasks.length - 1]}`;
    console.log(`Phase ${phase.id}: ${phase.name}`);
    console.log(`  Status: ${phase.status} (${phase.statusEnv})`);
    console.log(`  Tasks: ${taskRange}`);
    console.log(`  Owners: ${phase.owners.join(", ")}`);
    console.log(`  Gate: ${phase.launchGate}`);
    console.log(`  Local evidence: ${phase.localEvidence.join("; ")}`);
    console.log(`  External blockers: ${phase.externalBlockers.join("; ")}`);
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
  console.error(error instanceof Error ? error.message : "Managed ads phase check failed.");
  process.exitCode = 1;
}
