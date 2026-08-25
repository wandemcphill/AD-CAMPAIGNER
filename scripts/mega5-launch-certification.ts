import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

interface Finding {
  severity: "ERROR" | "WARN";
  area: string;
  message: string;
  file?: string;
}

const root = new URL("../", import.meta.url).pathname;
const findings: Finding[] = [];

const requiredRoutes = [
  "apps/web/app/os/campaigns/page.tsx",
  "apps/web/app/os/campaigns/new/page.tsx",
  "apps/web/app/os/wallet/page.tsx",
  "apps/web/app/os/notifications/page.tsx",
  "apps/web/app/os/financial-products/page.tsx",
  "apps/web/app/os/financial-products/accounts/page.tsx",
  "apps/web/app/os/financial-products/cards/page.tsx",
  "apps/web/app/os/financial-products/remittance/page.tsx",
  "apps/web/app/guest/page.tsx",
  "apps/web/app/growth-services/page.tsx"
];

// Only scan customer-facing copy for affirmative claims. Provider implementation,
// generated Prisma code, tests, and this scanner itself may legitimately contain
// words such as "guarantee" while describing safety semantics or test fixtures.
const customerCopyRoots = ["apps/web/app", "packages/ui/src"];
const affirmativeClaimPatterns = [
  /(?:fliptrybe|we|our service|this service|your (?:money|funds|payment|transaction))[^\n.]{0,100}\b(?:is|are|will be|provides|offers)\b[^\n.]{0,80}\b(?:licensed by|regulated by|banking license|insured by|certified by)\b/i,
  /\b(?:fliptrybe|we|our service)\b[^\n.]{0,100}\b(?:guarantee|guaranteed)\b[^\n.]{0,80}\b(?:payment|delivery|refund|return|result|success|rate|security)\b/i,
  /\b(?:payment|delivery|refund|return|result|success|rate|security)\b[^\n.]{0,80}\b(?:is|are|will be)\b[^\n.]{0,60}\bguaranteed\b/i
];

const journeySignals: Record<string, string[]> = {
  money: ["payment", "transaction", "wallet", "receipt"],
  globalMoney: ["account", "currency", "usd", "gbp", "eur"],
  cards: ["card", "virtual", "transaction"],
  growth: ["campaign", "provider", "order", "notification"],
  trust: ["verification", "support", "security", "notification"]
};

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) return collectFiles(path);
      if (entry.isFile() && /\.(tsx?|jsx?|json|md|yml|yaml)$/.test(entry.name)) return [path];
      return [];
    })
  );
  return nested.flat();
}

async function fileExists(path: string) {
  try {
    await readFile(join(root, path), "utf8");
    return true;
  } catch {
    return false;
  }
}

function hasJourneySignals(content: string, signals: string[]) {
  const normalized = content.toLowerCase();
  return signals.every((signal) => normalized.includes(signal));
}

async function main() {
  for (const route of requiredRoutes) {
    if (!(await fileExists(route))) {
      findings.push({ severity: "ERROR", area: "routes", message: `Required launch route is missing: ${route}`, file: route });
    }
  }

  const allRoots = ["apps/web/app", "apps/admin/app", "apps/api/src", "packages", "services", "scripts"];
  const files = (
    await Promise.all(
      allRoots.map(async (directory) => {
        try {
          return await collectFiles(join(root, directory));
        } catch {
          return [];
        }
      })
    )
  ).flat();

  const contents = new Map<string, string>();
  for (const file of files) contents.set(file, await readFile(file, "utf8"));

  const customerCopyFiles = (
    await Promise.all(
      customerCopyRoots.map(async (directory) => {
        try {
          return await collectFiles(join(root, directory));
        } catch {
          return [];
        }
      })
    )
  ).flat();

  for (const file of customerCopyFiles) {
    const content = contents.get(file) ?? await readFile(file, "utf8");
    for (const pattern of affirmativeClaimPatterns) {
      const match = content.match(pattern);
      if (match) {
        findings.push({
          severity: "ERROR",
          area: "claims",
          message: `Potential unsupported affirmative provider/regulatory claim: ${match[0].trim().slice(0, 180)}`,
          file: relative(root, file)
        });
        break;
      }
    }
  }

  const joinedAppCopy = [...contents.entries()]
    .filter(([file]) => file.includes("/apps/web/app/"))
    .map(([, content]) => content)
    .join("\n");

  for (const [journey, signals] of Object.entries(journeySignals)) {
    if (!hasJourneySignals(joinedAppCopy, signals)) {
      findings.push({
        severity: "WARN",
        area: "journey",
        message: `Customer journey evidence is incomplete for ${journey}: expected signals ${signals.join(", ")}`
      });
    }
  }

  // render.yaml is a repository-root production contract and is intentionally
  // read directly rather than through the recursive application scan above.
  const renderYaml = await fileExists("render.yaml") ? await readFile(join(root, "render.yaml"), "utf8") : undefined;
  if (!renderYaml) {
    findings.push({ severity: "ERROR", area: "production-config", message: "render.yaml is missing from the repository root", file: "render.yaml" });
  } else {
    for (const key of ["ALLOW_MOCK_PROVIDERS", "MEDIA_UPLOAD_ALLOW_MOCK_STORAGE", "FEATURE_VIRTUAL_CARDS"]) {
      const pattern = new RegExp(`key: ${key}[\\s\\S]{0,120}?value:\\s*['\"]?(true|false)`, "i");
      if (!renderYaml.match(pattern)) {
        findings.push({ severity: "ERROR", area: "production-config", message: `render.yaml is missing explicit boolean safety configuration for ${key}`, file: "render.yaml" });
      }
    }
    if (!renderYaml.includes("/api/webhooks/korapay")) {
      findings.push({ severity: "ERROR", area: "webhooks", message: "KoraPay webhook URL is not sealed in render.yaml", file: "render.yaml" });
    }
  }

  const errors = findings.filter((finding) => finding.severity === "ERROR");
  const warnings = findings.filter((finding) => finding.severity === "WARN");

  console.log("MEGA 5 launch certification");
  console.log(`Scanned ${files.length} source/config files.`);
  console.log(`Errors: ${errors.length}; warnings: ${warnings.length}.`);
  for (const finding of findings) {
    const location = finding.file ? ` (${finding.file})` : "";
    console.log(`${finding.severity} [${finding.area}] ${finding.message}${location}`);
  }

  if (errors.length > 0) process.exitCode = 1;
}

void main();
