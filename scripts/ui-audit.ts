import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const scanRoots = [
  "apps/web/app",
  "apps/admin/app/campaign-ops",
  "apps/admin/app/digital-access",
  "apps/admin/app/otp",
  "packages/ui/src"
];

const blockedTerms = [
  "Demo fallback",
  "Failed to fetch",
  "Demo mode",
  "Demo queue",
  "Demo fallback",
  "Fallback",
  "missing id",
  "Detail endpoint",
  "Queue endpoint",
  "Reports endpoint",
  "Activity endpoint",
  "/v1 connected",
  "/v1 admin API",
  "Fund Campaigns",
  "Continue to Checkout",
  "Fast purchase",
  "Completion checklist",
  "Back to Campaigns"
];

const blockedPatterns = [
  { label: "Demo fallback", pattern: /\bdemo fallback\b/i },
  { label: "missing id", pattern: /\bmissing id\b/i }
];

const fileScopedBlockedPatterns = [
  {
    filePattern: /apps[\\/]web[\\/]app[\\/]ui[\\/]session-panel\.tsx$/,
    label: "sidebar auth form",
    pattern: /<form\b|type=["']password["']|\bsignIn\b|\bsignUp\b|Create account|Sign in/i
  }
];

const requiredRoutes = [
  "apps/web/app/campaigns/page.tsx",
  "apps/web/app/campaigns/new/page.tsx",
  "apps/web/app/billing/page.tsx",
  "apps/web/app/reports/page.tsx",
  "apps/web/app/profile/page.tsx",
  "apps/web/app/notifications/page.tsx",
  "apps/admin/app/campaign-ops/page.tsx",
  "apps/admin/app/campaign-ops/queue/page.tsx",
  "apps/admin/app/campaign-ops/detail/page.tsx",
  "apps/admin/app/campaign-ops/reports/page.tsx",
  "apps/admin/app/campaign-ops/activity/page.tsx"
];

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(path);
      }
      if (/\.(css|tsx?)$/.test(entry.name)) {
        return [path];
      }
      return [];
    })
  );

  return files.flat();
}

async function assertRouteExists(path: string) {
  try {
    await readFile(path, "utf8");
  } catch {
    throw new Error(`Required UX route is missing: ${path}`);
  }
}

async function main() {
  await Promise.all(requiredRoutes.map(assertRouteExists));

  const files = (await Promise.all(scanRoots.map(collectFiles))).flat();
  const violations: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file, "utf8");
      blockedTerms.forEach((term) => {
        if (content.includes(term)) {
          violations.push(`${relative(process.cwd(), file)} contains blocked production copy: ${term}`);
        }
      });
      blockedPatterns.forEach(({ label, pattern }) => {
        if (pattern.test(content)) {
          violations.push(`${relative(process.cwd(), file)} contains blocked production copy: ${label}`);
        }
      });
      fileScopedBlockedPatterns.forEach(({ filePattern, label, pattern }) => {
        const relativePath = relative(process.cwd(), file);
        if (filePattern.test(relativePath) && pattern.test(content)) {
          violations.push(`${relativePath} contains blocked production UI: ${label}`);
        }
      });
    })
  );

  if (violations.length > 0) {
    throw new Error(`UI audit failed:\n${violations.map((item) => `- ${item}`).join("\n")}`);
  }

  console.log("UI audit passed", {
    blockedTerms: blockedTerms.length,
    files: files.length,
    requiredRoutes: requiredRoutes.length
  });
}

void main();
