import { readFileSync } from "node:fs";

const render = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
const errors: string[] = [];

function expectValue(key: string, expected: string) {
  const pattern = new RegExp(`- key: ${key}\\s+value: ([^\\n]+)`, "m");
  const value = render.match(pattern)?.[1]?.trim();
  if (!value) {
    errors.push(`render.yaml: missing explicit value for ${key}`);
    return;
  }
  if (value !== expected) {
    errors.push(`render.yaml: ${key} must be ${expected}, found ${value}`);
  }
}

for (const key of [
  "ENABLE_OTP_MODULE",
  "ENABLE_PREMIUM_OTP",
  "ENABLE_BUDGET_OTP",
  "ENABLE_OTP_ADMIN",
  "DIGITAL_ACCESS_WORKER_ENABLED",
  "DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED",
  "OTP_PROVIDER_HEALTH_WORKER_ENABLED",
  "SMSACTIVATE_COMPATIBLE_ENABLED",
  "FEATURE_VIRTUAL_CARDS",
  "TRUST_PROXY_AUTH_HEADERS",
  "DIGITAL_ACCESS_TRUST_AUTH_HEADERS",
  "MEDIA_UPLOAD_ALLOW_MOCK_STORAGE",
  "FX_LIVE_PROVIDER_REFRESH"
]) {
  expectValue(key, '"false"');
}

const webhook = render.match(/- key: KORAPAY_WEBHOOK_URL\\s+value: ([^\\n]+)/m)?.[1]?.trim();
if (!webhook) {
  errors.push("render.yaml: KORAPAY_WEBHOOK_URL must be explicitly configured.");
} else if (!webhook.includes("/api/webhooks/korapay")) {
  errors.push("render.yaml: KORAPAY_WEBHOOK_URL must contain /api/webhooks/korapay.");
}

if (errors.length > 0) {
  console.error(`Production seal check failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production seal check passed: Blueprint defaults satisfy the documented safety gates.");
}
