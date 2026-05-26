type Target = "api" | "worker" | "web" | "admin";
type Stage =
  | "consistency"
  | "off"
  | "digital-access-api"
  | "digital-access-admin"
  | "digital-access-worker"
  | "otp-beta"
  | "managed-ads-mvp";

const targets = ["api", "worker", "web", "admin"];
const stages = [
  "consistency",
  "off",
  "digital-access-api",
  "digital-access-admin",
  "digital-access-worker",
  "otp-beta",
  "managed-ads-mvp"
];

const digitalAccessFlags = [
  "ENABLE_DIGITAL_ACCESS",
  "ENABLE_DIGITAL_ACCESS_ADMIN",
  "DIGITAL_ACCESS_WORKER_ENABLED",
  "DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED"
];
const otpFlags = [
  "ENABLE_OTP_MODULE",
  "ENABLE_PREMIUM_OTP",
  "ENABLE_BUDGET_OTP",
  "ENABLE_OTP_ADMIN"
];
const otpWorkerFlags = [
  "OTP_WORKER_ENABLED",
  "OTP_ALLOCATION_WORKER_ENABLED",
  "OTP_POLLING_WORKER_ENABLED",
  "OTP_REFUNDS_WORKER_ENABLED",
  "OTP_PROVIDER_HEALTH_WORKER_ENABLED"
];
const trustedHeaderFlags = ["TRUST_PROXY_AUTH_HEADERS", "DIGITAL_ACCESS_TRUST_AUTH_HEADERS"];

const errors: string[] = [];
const warnings: string[] = [];

function arg(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=", 2)[1];
}

function target(): Target {
  const value = arg("target") ?? "api";
  if (!targets.includes(value)) {
    throw new Error(`Use --target=${targets.join("|")}`);
  }
  return value as Target;
}

function stage(): Stage {
  const value = arg("stage") ?? "consistency";
  const normalized = value === "digital-access-beta" ? "digital-access-admin" : value;
  if (!stages.includes(normalized)) {
    throw new Error(`Use --stage=${stages.join("|")}`);
  }
  return normalized as Stage;
}

function enabled(name: string) {
  return ["1", "true", "yes", "on"].includes(process.env[name]?.trim().toLowerCase() ?? "");
}

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

function requireEnv(names: string[], label: string) {
  for (const name of names) {
    if (!present(name)) {
      errors.push(`${label}: missing ${name}`);
    }
  }
}

function expectValue(name: string, expected: string, label: string) {
  const actual = process.env[name]?.trim();
  if (actual !== expected) {
    errors.push(`${label}: expected ${name}=${expected}`);
  }
}

function expect(name: string, expected: boolean, label: string) {
  if (enabled(name) !== expected) {
    errors.push(`${label}: expected ${name}=${expected ? "true" : "false"}`);
  }
}

function expectAll(names: string[], expected: boolean, label: string) {
  for (const name of names) {
    expect(name, expected, label);
  }
}

function checkStrictProduction(currentTarget: Target) {
  if (!process.argv.includes("--strict-production")) {
    return;
  }

  if (currentTarget === "api") {
    requireEnv(
      [
        "NODE_ENV",
        "APP_URL",
        "ADMIN_URL",
        "API_URL",
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "SESSION_SECRET"
      ],
      "api"
    );
    if (process.env.STORAGE_PROVIDER === "cloudinary") {
      requireEnv(
        ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_UPLOAD_PRESET"],
        "api cloudinary"
      );
    }
    if (process.env.STORAGE_PROVIDER === "mock") {
      warnings.push("api: STORAGE_PROVIDER=mock is not suitable for production media uploads.");
    }
    if (enabled("MEDIA_UPLOAD_ALLOW_MOCK_STORAGE")) {
      errors.push("api: MEDIA_UPLOAD_ALLOW_MOCK_STORAGE must be false in strict production.");
    }
    if (process.env.PAYMENT_PROVIDER === "live") {
      requireEnv(
        [
          "KORAPAY_PUBLIC_KEY",
          "KORAPAY_SECRET_KEY",
          "KORAPAY_ENCRYPTION_KEY",
          "KORAPAY_WEBHOOK_URL",
          "KORAPAY_WEBHOOK_SECRET",
          "KORAPAY_REDIRECT_URL",
          "TREASURY_BANK_NAME",
          "TREASURY_ACCOUNT_NAME",
          "TREASURY_ACCOUNT_NUMBER"
        ],
        "api payments"
      );
    }
  }

  if (currentTarget === "worker") {
    requireEnv(["NODE_ENV", "DATABASE_URL", "REDIS_URL"], "worker");
  }

  if (currentTarget === "web" || currentTarget === "admin") {
    requireEnv(["NEXT_PUBLIC_API_URL"], currentTarget);
  }

  if (
    (currentTarget === "api" || currentTarget === "worker") &&
    process.env.SMM_PROVIDER === "live" &&
    !["SMDPANEL_API_KEY", "SMMRAJA_API_KEY", "JAP_API_KEY", "PEAKERR_API_KEY"].some(present)
  ) {
    errors.push(`${currentTarget}: SMM_PROVIDER=live needs at least one supplier API key`);
  }
}

function checkManagedAdsMvp(currentTarget: Target) {
  const label = `${currentTarget}/managed-ads-mvp`;

  if (currentTarget === "api") {
    requireEnv(
      [
        "NODE_ENV",
        "APP_URL",
        "ADMIN_URL",
        "API_URL",
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "SESSION_SECRET"
      ],
      label
    );
    expectValue("STORAGE_PROVIDER", "cloudinary", label);
    requireEnv(
      ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_UPLOAD_PRESET"],
      `${label} cloudinary`
    );
    expectValue("PAYMENT_PROVIDER", "live", label);
    requireEnv(
      [
        "KORAPAY_PUBLIC_KEY",
        "KORAPAY_SECRET_KEY",
        "KORAPAY_ENCRYPTION_KEY",
        "KORAPAY_WEBHOOK_URL",
        "KORAPAY_WEBHOOK_SECRET",
        "KORAPAY_REDIRECT_URL",
        "TREASURY_BANK_NAME",
        "TREASURY_ACCOUNT_NAME",
        "TREASURY_ACCOUNT_NUMBER"
      ],
      `${label} payments`
    );
    if (enabled("MEDIA_UPLOAD_ALLOW_MOCK_STORAGE")) {
      errors.push(`${label}: MEDIA_UPLOAD_ALLOW_MOCK_STORAGE must stay disabled.`);
    }
  }

  if (currentTarget === "worker") {
    requireEnv(["NODE_ENV", "DATABASE_URL", "REDIS_URL"], label);
  }

  if (currentTarget === "web" || currentTarget === "admin") {
    requireEnv(["NEXT_PUBLIC_API_URL"], label);
    if (enabled("NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE")) {
      errors.push(`${label}: NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE must be disabled.`);
    }
  }

  expectAll(trustedHeaderFlags, false, label);
}

function checkConsistency(currentTarget: Target) {
  if (enabled("ENABLE_DIGITAL_ACCESS_ADMIN") && !enabled("ENABLE_DIGITAL_ACCESS")) {
    errors.push("ENABLE_DIGITAL_ACCESS_ADMIN requires ENABLE_DIGITAL_ACCESS=true");
  }
  if (
    enabled("DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED") &&
    !enabled("DIGITAL_ACCESS_WORKER_ENABLED")
  ) {
    errors.push(
      "DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED requires DIGITAL_ACCESS_WORKER_ENABLED=true"
    );
  }
  if (trustedHeaderFlags.some(enabled)) {
    warnings.push(
      "Trusted auth header flags are enabled; only use them behind a trusted auth proxy."
    );
  }
  if (otpFlags.slice(1).some(enabled) && !enabled("ENABLE_OTP_MODULE")) {
    errors.push("OTP sub-feature flags require ENABLE_OTP_MODULE=true");
  }
  if (otpWorkerFlags.slice(1).some(enabled) && !enabled("OTP_WORKER_ENABLED")) {
    errors.push("OTP queue flags require OTP_WORKER_ENABLED=true");
  }
  if (
    currentTarget === "worker" &&
    enabled("OTP_WORKER_ENABLED") &&
    !enabled("ENABLE_OTP_MODULE")
  ) {
    errors.push("OTP_WORKER_ENABLED requires ENABLE_OTP_MODULE=true");
  }
  if (enabled("ENABLE_OTP_MODULE")) {
    requireEnv(["OTP_BETA_WORKSPACE_IDS"], "otp beta");
    if ((process.env.OTP_PROVIDER_MODE ?? "mock") === "mock") {
      errors.push("OTP beta must not run with OTP_PROVIDER_MODE=mock");
    }
  }
}

function checkStage(currentTarget: Target, currentStage: Stage) {
  const label = `${currentTarget}/${currentStage}`;

  if (currentStage === "managed-ads-mvp") {
    checkManagedAdsMvp(currentTarget);
    return;
  }

  if (currentStage === "off") {
    if (currentTarget === "web") return expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS", false, label);
    if (currentTarget === "admin")
      return expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN", false, label);
    expectAll([...digitalAccessFlags, ...otpFlags, ...trustedHeaderFlags], false, label);
    if (currentTarget === "worker") expectAll(otpWorkerFlags, false, label);
  }

  if (currentStage === "digital-access-api") {
    if (currentTarget === "api") {
      expect("ENABLE_DIGITAL_ACCESS", true, label);
      expect("ENABLE_DIGITAL_ACCESS_ADMIN", false, label);
      expectAll(
        ["DIGITAL_ACCESS_WORKER_ENABLED", "DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED", ...otpFlags],
        false,
        label
      );
    }
    if (currentTarget === "web") expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS", true, label);
    if (currentTarget === "admin") expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN", false, label);
  }

  if (currentStage === "digital-access-admin" || currentStage === "digital-access-worker") {
    if (currentTarget === "api") {
      expect("ENABLE_DIGITAL_ACCESS", true, label);
      expect("ENABLE_DIGITAL_ACCESS_ADMIN", true, label);
      expectAll(
        ["DIGITAL_ACCESS_WORKER_ENABLED", "DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED", ...otpFlags],
        false,
        label
      );
    }
    if (currentTarget === "web") expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS", true, label);
    if (currentTarget === "admin") expect("NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN", true, label);
    if (currentTarget === "worker" && currentStage === "digital-access-worker") {
      expectAll(
        ["ENABLE_DIGITAL_ACCESS", "ENABLE_DIGITAL_ACCESS_ADMIN", ...digitalAccessFlags.slice(2)],
        true,
        label
      );
    }
  }

  if (currentStage === "otp-beta" && (currentTarget === "api" || currentTarget === "worker")) {
    expectAll(otpFlags, true, label);
    if (currentTarget === "worker") expectAll(otpWorkerFlags, true, label);
  }
}

const currentTarget = target();
const currentStage = stage();

if (currentStage !== "managed-ads-mvp") {
  checkStrictProduction(currentTarget);
}
checkConsistency(currentTarget);
checkStage(currentTarget, currentStage);

for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);

if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`Rollout preflight passed for ${currentTarget}/${currentStage}.`);
}
