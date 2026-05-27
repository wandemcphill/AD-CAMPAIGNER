type Target = "all" | "api" | "worker" | "web" | "admin";
type Phase = "all" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

interface EnvRequirement {
  name: string;
  task: string;
  validator?: (value: string) => string | undefined;
}

interface AnyOfRequirement {
  names: string[];
  task: string;
  validator?: (name: string, value: string) => string | undefined;
}

interface CheckGroup {
  title: string;
  requirements?: EnvRequirement[];
  anyOf?: AnyOfRequirement[];
}

const targets = ["all", "api", "worker", "web", "admin"];
const phases = ["all", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const phaseLabels: Record<Exclude<Phase, "all">, string> = {
  "0": "Access and ownership",
  "1": "Production environment",
  "2": "Admin operations setup",
  "3": "Client flow setup",
  "4": "Manual launch accounts",
  "5": "Payments and reconciliation",
  "6": "Media and report evidence",
  "7": "Notifications and support",
  "8": "Monitoring and alerts",
  "9": "Go/no-go and rollback"
};

const placeholderValues = new Set([
  "changeme",
  "change-me",
  "example",
  "example.com",
  "fixme",
  "name",
  "n/a",
  "na",
  "none",
  "null",
  "owner",
  "placeholder",
  "sample",
  "someone",
  "support",
  "tba",
  "tbd",
  "todo",
  "unknown",
  "unset",
  "your-name",
  "yourname"
]);

const ownerRequirements: EnvRequirement[] = [
  { name: "OPS_DEPLOY_OWNER", task: "Assign the production deploy owner.", validator: validateHumanName },
  { name: "OPS_API_OWNER", task: "Assign the production API owner.", validator: validateHumanName },
  { name: "OPS_WORKER_OWNER", task: "Assign the production worker owner.", validator: validateHumanName },
  { name: "OPS_PAYMENTS_OWNER", task: "Assign the production payments owner.", validator: validateHumanName },
  { name: "OPS_MEDIA_OWNER", task: "Assign the production media and Cloudinary owner.", validator: validateHumanName },
  { name: "OPS_CAMPAIGN_OWNER", task: "Assign the production campaign operations owner.", validator: validateHumanName },
  { name: "OPS_REPORT_QA_OWNER", task: "Assign the production report QA owner.", validator: validateHumanName },
  { name: "OPS_SUPPORT_OWNER", task: "Assign the production support owner.", validator: validateHumanName },
  { name: "OPS_CUSTOMER_COMMS_OWNER", task: "Assign the production customer communications owner.", validator: validateHumanName },
  { name: "OPS_INCIDENT_COMMANDER", task: "Assign the launch incident commander.", validator: validateHumanName },
  { name: "OPS_ROLLBACK_OWNER", task: "Assign the production rollback owner.", validator: validateHumanName }
];

const alertRequirement: AnyOfRequirement = {
  names: ["OPS_ALERT_EMAIL", "OPS_ALERT_WEBHOOK"],
  task: "Configure an operational alert destination.",
  validator: validateAlertDestination
};

const channelRequirements: EnvRequirement[] = [
  { name: "OPS_LAUNCH_CHANNEL", task: "Record the launch-room channel or URL.", validator: validateChannel },
  { name: "OPS_INCIDENT_CHANNEL", task: "Record the incident channel or URL.", validator: validateChannel },
  { name: "OPS_SUPPORT_CHANNEL", task: "Record the customer support inbox or channel.", validator: validateChannel }
];

const supportAndRollbackRequirements: EnvRequirement[] = [
  {
    name: "OPS_OWNER_ROSTER_URL",
    task: "Link the owner roster with backups and escalation handles.",
    validator: validateReference
  },
  {
    name: "OPS_LAUNCH_NOTES_URL",
    task: "Link the launch notes or go/no-go thread where evidence will be posted.",
    validator: validateReference
  },
  {
    name: "OPS_INCIDENT_RUNBOOK_URL",
    task: "Link the managed ads incident runbook.",
    validator: validateReference
  },
  {
    name: "OPS_ROLLBACK_PLAN_URL",
    task: "Link the rollback plan with order, target commit, and reconciliation owner.",
    validator: validateReference
  },
  {
    name: "OPS_SUPPORT_CONTACT",
    task: "Record the staffed client support contact for launch.",
    validator: validateContact
  },
  {
    name: "OPS_ESCALATION_CONTACT",
    task: "Record the urgent escalation contact or group.",
    validator: validateContact
  },
  {
    name: "OPS_CONFIG_FREEZE_WINDOW",
    task: "Record the production config freeze window for the launch.",
    validator: validateReference
  }
];

const urlRequirementsByTarget: Record<Target, EnvRequirement[]> = {
  all: [
    { name: "APP_URL", task: "Set the production client app URL.", validator: validateUrl },
    { name: "ADMIN_URL", task: "Set the production admin app URL.", validator: validateUrl },
    { name: "API_URL", task: "Set the server-side production API URL.", validator: validateUrl },
    {
      name: "NEXT_PUBLIC_API_URL",
      task: "Set the browser-facing production API URL.",
      validator: validateUrl
    }
  ],
  api: [
    { name: "API_URL", task: "Set the server-side production API URL.", validator: validateUrl }
  ],
  worker: [],
  web: [
    {
      name: "NEXT_PUBLIC_API_URL",
      task: "Set the browser-facing production API URL.",
      validator: validateUrl
    }
  ],
  admin: [
    {
      name: "NEXT_PUBLIC_API_URL",
      task: "Set the browser-facing production API URL.",
      validator: validateUrl
    }
  ]
};

const phaseEvidenceRequirements: EnvRequirement[] = Object.entries(phaseLabels).map(([phase, label]) => ({
  name: `OPS_PHASE_${phase}_EVIDENCE`,
  task: `Create a launch evidence placeholder for Phase ${phase} - ${label}.`,
  validator: validateReference
}));

function arg(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=", 2)[1];
}

function target(): Target {
  const value = arg("target") ?? process.env.OPS_READINESS_TARGET ?? "all";

  if (!targets.includes(value)) {
    throw new Error(`Use --target=${targets.join("|")}`);
  }

  return value as Target;
}

function phase(): Phase {
  const value = arg("phase") ?? process.env.OPS_READINESS_PHASE ?? "all";

  if (!phases.includes(value)) {
    throw new Error(`Use --phase=${phases.join("|")}`);
  }

  return value as Phase;
}

function envValue(name: string) {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : undefined;
}

function validateNotPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();

  if (placeholderValues.has(normalized)) {
    return "must be a real launch value, not a placeholder";
  }

  if (normalized.includes("todo") || normalized.includes("tbd") || normalized.includes("changeme")) {
    return "must not contain placeholder language such as todo, tbd, or changeme";
  }

  return undefined;
}

function validateHumanName(value: string) {
  const placeholderError = validateNotPlaceholder(value);

  if (placeholderError) {
    return placeholderError;
  }

  if (value.length < 3) {
    return "must be at least 3 characters";
  }

  return undefined;
}

function validateUrl(value: string) {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "must start with http:// or https://";
    }
  } catch {
    return "must be a valid absolute URL";
  }

  return undefined;
}

function validateReference(value: string) {
  const placeholderError = validateNotPlaceholder(value);

  if (placeholderError) {
    return placeholderError;
  }

  if (value.length < 6) {
    return "must be a usable link, ticket, document reference, or launch-note anchor";
  }

  return undefined;
}

function validateChannel(value: string) {
  const placeholderError = validateNotPlaceholder(value);

  if (placeholderError) {
    return placeholderError;
  }

  if (value.startsWith("#") && value.length > 1) {
    return undefined;
  }

  if (value.startsWith("@") && value.length > 1) {
    return undefined;
  }

  if (value.includes("@")) {
    return undefined;
  }

  return validateUrl(value);
}

function validateContact(value: string) {
  const placeholderError = validateNotPlaceholder(value);

  if (placeholderError) {
    return placeholderError;
  }

  if (value.startsWith("@") && value.length > 1) {
    return undefined;
  }

  if (value.startsWith("#") && value.length > 1) {
    return undefined;
  }

  if (value.includes("@")) {
    return undefined;
  }

  return validateUrl(value);
}

function validateAlertDestination(name: string, value: string) {
  const placeholderError = validateNotPlaceholder(value);

  if (placeholderError) {
    return placeholderError;
  }

  if (name === "OPS_ALERT_WEBHOOK") {
    return validateUrl(value);
  }

  if (!value.includes("@")) {
    return "must look like an email address";
  }

  return undefined;
}

function checkRequired(requirement: EnvRequirement) {
  const value = envValue(requirement.name);

  if (!value) {
    return `Set ${requirement.name}. ${requirement.task}`;
  }

  const validationError = requirement.validator?.(value);

  return validationError
    ? `Fix ${requirement.name}: ${validationError}. ${requirement.task}`
    : undefined;
}

function checkAnyOf(requirement: AnyOfRequirement) {
  const presentValues = requirement.names
    .map((name) => ({ name, value: envValue(name) }))
    .filter((entry): entry is { name: string; value: string } => Boolean(entry.value));

  if (presentValues.length === 0) {
    return `Set one of ${requirement.names.join(" or ")}. ${requirement.task}`;
  }

  const invalidValues = presentValues
    .map((entry) => {
      const validationError = requirement.validator?.(entry.name, entry.value);

      return validationError
        ? `Fix ${entry.name}: ${validationError}. ${requirement.task}`
        : undefined;
    })
    .filter((entry): entry is string => Boolean(entry));

  return invalidValues.length > 0 ? invalidValues.join("\n") : undefined;
}

function selectedPhaseEvidenceRequirements(currentPhase: Phase) {
  if (currentPhase === "all") {
    return phaseEvidenceRequirements;
  }

  return phaseEvidenceRequirements.filter((requirement) => requirement.name === `OPS_PHASE_${currentPhase}_EVIDENCE`);
}

function groupChecks(currentTarget: Target, currentPhase: Phase): CheckGroup[] {
  return [
    { title: "Owner slots", requirements: ownerRequirements },
    { title: "Launch, incident, and support channels", requirements: channelRequirements, anyOf: [alertRequirement] },
    { title: "Support, rollback, and contact metadata", requirements: supportAndRollbackRequirements },
    { title: "Target URLs", requirements: urlRequirementsByTarget[currentTarget] },
    { title: "Managed ads phase evidence placeholders", requirements: selectedPhaseEvidenceRequirements(currentPhase) }
  ];
}

function checkGroup(group: CheckGroup) {
  const tasks = [
    ...(group.requirements ?? []).map(checkRequired),
    ...(group.anyOf ?? []).map(checkAnyOf)
  ].filter((entry): entry is string => Boolean(entry));

  const requirementCount = (group.requirements?.length ?? 0) + (group.anyOf?.length ?? 0);

  return {
    title: group.title,
    requirementCount,
    tasks: tasks.flatMap((entry) => entry.split("\n"))
  };
}

function printHelp() {
  console.log(`Managed ads MVP ops readiness

Usage:
  pnpm ops:readiness
  pnpm ops:readiness -- --target=api
  pnpm ops:readiness -- --target=web --phase=3

Targets:
  all, api, worker, web, admin

Phases:
  all, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9

Required:
  OPS_DEPLOY_OWNER
  OPS_API_OWNER
  OPS_WORKER_OWNER
  OPS_PAYMENTS_OWNER
  OPS_MEDIA_OWNER
  OPS_CAMPAIGN_OWNER
  OPS_REPORT_QA_OWNER
  OPS_SUPPORT_OWNER
  OPS_CUSTOMER_COMMS_OWNER
  OPS_INCIDENT_COMMANDER
  OPS_ROLLBACK_OWNER
  OPS_LAUNCH_CHANNEL
  OPS_INCIDENT_CHANNEL
  OPS_SUPPORT_CHANNEL
  OPS_ALERT_EMAIL or OPS_ALERT_WEBHOOK
  OPS_OWNER_ROSTER_URL
  OPS_LAUNCH_NOTES_URL
  OPS_INCIDENT_RUNBOOK_URL
  OPS_ROLLBACK_PLAN_URL
  OPS_SUPPORT_CONTACT
  OPS_ESCALATION_CONTACT
  OPS_CONFIG_FREEZE_WINDOW
  OPS_PHASE_0_EVIDENCE through OPS_PHASE_9_EVIDENCE, or one phase when --phase=N
  APP_URL, ADMIN_URL, API_URL, and/or NEXT_PUBLIC_API_URL based on target
`);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();

    return;
  }

  const currentTarget = target();
  const currentPhase = phase();
  const results = groupChecks(currentTarget, currentPhase).map(checkGroup);
  const missingTasks = results.flatMap((result) =>
    result.tasks.map((task) => ({ group: result.title, task }))
  );
  const totalRequirements = results.reduce((sum, result) => sum + result.requirementCount, 0);

  console.log(`Managed ads MVP ops readiness target: ${currentTarget}`);
  console.log(`Managed ads MVP ops readiness phase: ${currentPhase}`);

  if (missingTasks.length > 0) {
    console.error(`Missing operational readiness tasks (${missingTasks.length}/${totalRequirements}):`);

    for (const result of results.filter((entry) => entry.tasks.length > 0)) {
      console.error(`[${result.title}]`);
      for (const task of result.tasks) {
        console.error(`- ${task}`);
      }
    }

    process.exitCode = 1;

    return;
  }

  console.log(`Operational readiness placeholders are present (${totalRequirements}/${totalRequirements}).`);
  for (const result of results) {
    console.log(`- ${result.title}: ${result.requirementCount} checked`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Ops readiness check failed.");
  process.exitCode = 1;
}
