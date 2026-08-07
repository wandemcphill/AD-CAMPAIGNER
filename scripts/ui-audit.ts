import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const scanRoots = [
  "apps/web/app",
  "apps/admin/app/campaign-ops",
  "apps/admin/app/digital-access",
  "apps/admin/app/digital-products",
  "apps/admin/app/digital-value",
  "apps/admin/app/vtu",
  "apps/admin/app/growth-services",
  "apps/admin/app/marketplace",
  "apps/admin/app/rewards",
  "apps/admin/app/providers",
  "packages/ui/src"
];

const blockedTerms = [
  "Demo fallback",
  "Failed to fetch",
  "Demo mode",
  "Demo queue",
  "Demo fallback",
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
  { label: "missing id", pattern: /\bmissing id\b/i },
  {
    label: "raw debug label",
    pattern: /\b(?:debug|todo|fixme|lorem ipsum|mock data|sample data|dummy data|test data)\b/i
  },
  { label: "console debug call", pattern: /\bconsole\.(?:debug|log|trace)\s*\(/i }
];

const fileScopedBlockedPatterns = [
  {
    filePattern: /apps[\\/]web[\\/]app[\\/]ui[\\/]session-panel\.tsx$/,
    label: "sidebar auth form",
    pattern: /<form\b|type=["']password["']|\bsignIn\s*\(|\bsignUp\s*\(|\bauth(?:entication)?\s+form\b/i
  }
];

const requiredRoutes = [
  "apps/web/app/os/campaigns/page.tsx",
  "apps/web/app/os/campaigns/new/page.tsx",
  "apps/web/app/os/campaigns/[id]/page.tsx",
  "apps/web/app/os/analytics/page.tsx",
  "apps/web/app/os/wallet/page.tsx",
  "apps/web/app/os/reports/page.tsx",
  "apps/web/app/os/profile/page.tsx",
  "apps/web/app/os/notifications/page.tsx",
  "apps/web/app/os/onboarding/page.tsx",
  "apps/admin/app/campaign-ops/page.tsx",
  "apps/admin/app/campaign-ops/queue/page.tsx",
  "apps/admin/app/campaign-ops/detail/page.tsx",
  "apps/admin/app/campaign-ops/reports/page.tsx",
  "apps/admin/app/campaign-ops/activity/page.tsx"
];

const serviceLanguageRequirements = [
  {
    file: "apps/web/app/os/campaigns/page.tsx",
    label: "client campaigns",
    requiredTerms: ["campaign", "operator", "report", "spend"]
  },
  {
    file: "apps/web/app/os/campaigns/new/page.tsx",
    label: "campaign intake",
    requiredTerms: ["brief", "budget", "invoice", "operator"]
  },
  {
    file: "apps/web/app/os/wallet/page.tsx",
    label: "billing",
    requiredTerms: ["campaign", "invoice", "wallet", "budget"]
  },
  {
    file: "apps/web/app/os/reports/page.tsx",
    label: "client reports",
    requiredTerms: ["campaign", "report", "operator", "proof"]
  },
  {
    file: "apps/web/app/os/profile/page.tsx",
    label: "business profile",
    requiredTerms: ["profile", "campaign", "invoice", "operator"]
  },
  {
    file: "apps/admin/app/campaign-ops/page.tsx",
    label: "admin ops hub",
    requiredTerms: ["campaign", "operator", "queue", "client report"]
  },
  {
    file: "apps/admin/app/campaign-ops/queue/page.tsx",
    label: "admin ops queue",
    requiredTerms: ["campaign", "operator", "queue", "review"]
  },
  {
    file: "apps/admin/app/campaign-ops/detail/detail-client.tsx",
    label: "admin campaign detail",
    requiredTerms: ["campaign", "client", "operator", "proof"]
  },
  {
    file: "apps/admin/app/campaign-ops/reports/page.tsx",
    label: "admin reports",
    requiredTerms: ["client report", "campaign", "metrics", "publish"]
  },
  {
    file: "apps/admin/app/campaign-ops/activity/page.tsx",
    label: "admin activity",
    requiredTerms: ["campaign", "admin actions", "operator", "client-visible"]
  }
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

async function assertServiceLanguage(violations: string[]) {
  await Promise.all(
    serviceLanguageRequirements.map(async ({ file, label, requiredTerms }) => {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        violations.push(`${file} is missing required managed-ads surface: ${label}`);
        return;
      }

      const normalizedContent = content.toLowerCase();
      const missingTerms = requiredTerms.filter(
        (term) => !normalizedContent.includes(term.toLowerCase())
      );
      if (missingTerms.length > 0) {
        violations.push(
          `${file} is missing managed-ads language for ${label}: ${missingTerms.join(", ")}`
        );
      }
    })
  );
}

async function main() {
  await Promise.all(requiredRoutes.map(assertRouteExists));

  const files = (await Promise.all(scanRoots.map(collectFiles))).flat();
  const violations: string[] = [];
  await assertServiceLanguage(violations);

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
    serviceLanguageRequirements: serviceLanguageRequirements.length,
    requiredRoutes: requiredRoutes.length
  });
}

void main();
