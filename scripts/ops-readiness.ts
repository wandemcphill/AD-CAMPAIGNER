type Target = "all" | "api" | "worker" | "web" | "admin";

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

const targets = ["all", "api", "worker", "web", "admin"];

const ownerRequirements: EnvRequirement[] = [
  { name: "OPS_DEPLOY_OWNER", task: "Assign the production deploy owner." },
  { name: "OPS_API_OWNER", task: "Assign the production API owner." },
  { name: "OPS_WORKER_OWNER", task: "Assign the production worker owner." },
  { name: "OPS_PAYMENTS_OWNER", task: "Assign the production payments owner." },
  { name: "OPS_MEDIA_OWNER", task: "Assign the production media and Cloudinary owner." },
  { name: "OPS_CAMPAIGN_OWNER", task: "Assign the production campaign operations owner." },
  { name: "OPS_REPORT_QA_OWNER", task: "Assign the production report QA owner." },
  { name: "OPS_SUPPORT_OWNER", task: "Assign the production support owner." },
  { name: "OPS_CUSTOMER_COMMS_OWNER", task: "Assign the production customer communications owner." },
  { name: "OPS_INCIDENT_COMMANDER", task: "Assign the launch incident commander." },
  { name: "OPS_ROLLBACK_OWNER", task: "Assign the production rollback owner." }
];

const alertRequirement: AnyOfRequirement = {
  names: ["OPS_ALERT_EMAIL", "OPS_ALERT_WEBHOOK"],
  task: "Configure an operational alert destination.",
  validator: validateAlertDestination
};

const channelRequirements: EnvRequirement[] = [
  { name: "OPS_LAUNCH_CHANNEL", task: "Record the launch-room channel or URL." },
  { name: "OPS_INCIDENT_CHANNEL", task: "Record the incident channel or URL." },
  { name: "OPS_SUPPORT_CHANNEL", task: "Record the customer support inbox or channel." }
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

function envValue(name: string) {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : undefined;
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

function validateAlertDestination(name: string, value: string) {
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

function printHelp() {
  console.log(`Managed ads MVP ops readiness

Usage:
  pnpm ops:readiness
  pnpm ops:readiness -- --target=api

Targets:
  all, api, worker, web, admin

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
  APP_URL, ADMIN_URL, API_URL, and/or NEXT_PUBLIC_API_URL based on target
`);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();

    return;
  }

  const currentTarget = target();
  const missingTasks = [
    ...ownerRequirements.map(checkRequired),
    ...channelRequirements.map(checkRequired),
    checkAnyOf(alertRequirement),
    ...urlRequirementsByTarget[currentTarget].map(checkRequired)
  ].filter((entry): entry is string => Boolean(entry));

  console.log(`Managed ads MVP ops readiness target: ${currentTarget}`);

  if (missingTasks.length > 0) {
    console.error("Missing operational readiness tasks:");
    for (const task of missingTasks.flatMap((entry) => entry.split("\n"))) {
      console.error(`- ${task}`);
    }
    process.exitCode = 1;

    return;
  }

  console.log("Operational readiness placeholders are present.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Ops readiness check failed.");
  process.exitCode = 1;
}
