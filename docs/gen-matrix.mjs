import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/ADS CAMPAIGNER";
const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
const data = JSON.parse(fs.readFileSync(path.join(here, "parity-data.json"), "utf8"));

// ---- route-level wiring: does the page (or anything it imports, 2 hops) call the API? ----
const API_CALL = /apiRequest|apiFetch|fetch\(|useApiSession/;

function readIfExists(p) {
  for (const cand of [p, p + ".ts", p + ".tsx", path.join(p, "index.ts"), path.join(p, "index.tsx")]) {
    try {
      if (fs.statSync(cand).isFile()) return fs.readFileSync(cand, "utf8");
    } catch {
      /* keep trying */
    }
  }
  return null;
}

function callsApi(absFile, depth = 0, seen = new Set()) {
  if (depth > 2 || seen.has(absFile)) return false;
  seen.add(absFile);
  const content = readIfExists(absFile);
  if (content === null) return false;
  if (API_CALL.test(content)) return true;

  const dir = path.dirname(absFile);
  const importRe = /from\s+["'](\.[^"']*)["']/g;
  let m;
  while ((m = importRe.exec(content))) {
    if (callsApi(path.resolve(dir, m[1]), depth + 1, seen)) return true;
  }
  return false;
}

const MOCK_RE = /\b(MOCK_|const MOCK|mockData|FAKE_|SAMPLE_|DUMMY_)/;

function usesMockData(pageFile) {
  const c = readIfExists(path.join(ROOT, pageFile));
  return c !== null && MOCK_RE.test(c);
}

const nonRedirect = data.webRoutes.filter((r) => !r.redirect);
const staticRoutes = nonRedirect.filter((r) => !callsApi(path.join(ROOT, r.file)));
const mockRoutes = nonRedirect.filter((r) => usesMockData(r.file));

// ---- domain map: controller prefix -> owning frontend surface ----
const DOMAIN = {
  campaigns: ["Campaigns", "/os/campaigns"],
  vtu: ["VTU / airtime / data / bills", "/os/airtime, /os/utilities"],
  smm: ["SMM (legacy surface)", "— none"],
  growth: ["Growth services", "/os/growth"],
  "digital-access": ["Digital Access", "/os/digital-access"],
  "digital-value": ["Gift cards", "/os/digital-value"],
  "virtual-numbers": ["Virtual numbers", "/os/numbers"],
  rewards: ["Rewards", "/os/rewards"],
  vouchers: ["Vouchers", "/os/vouchers"],
  crypto: ["Crypto", "/os/crypto"],
  rmb: ["RMB", "/os/rmb"],
  telecom: ["Telecom / intl top-up", "/os/telecom"],
  "financial-products": ["Financial products", "/os/financial-products"],
  marketplace: ["Marketplace", "/os/marketplace"],
  "marketplace/applications": ["Marketplace applications", "/os/marketplace/applications"],
  personas: ["Personas", "/os/personas"],
  "automation/workflows": ["Automation", "/os/automation"],
  auth: ["Auth", "/login, /register"],
  teams: ["Team", "/os/team"],
  notifications: ["Notifications", "/os/notifications"],
  support: ["Support", "/os/support"],
  "support/tickets": ["Support tickets", "/os/support"],
  wallet: ["Wallet", "/os/wallet"],
  payments: ["Payments", "/os/wallet"],
  invoices: ["Invoices", "— none"],
  "security/two-factor": ["2FA", "/os/settings/security"],
  "developer/api-keys": ["API keys", "/os/settings/api"],
  "developer/webhooks": ["Webhooks", "/os/settings/integrations"],
  guest: ["Guest checkout", "/guest"],
  claim: ["Reward claim", "/claim/[token]"],
  media: ["Media upload", "/os/library"],
  search: ["Search", "/os/search"],
  analytics: ["Analytics", "/os/analytics"],
  "ad-accounts": ["Ad accounts + KYC", "— none"],
  "company-profiles": ["Company profiles", "— none"],
  "client-profile": ["Client profile", "— none"],
  "trust-engine": ["Trust Engine", "— none"],
  live: ["Live viewers", "— none"],
  referrals: ["Referrals", "— none"],
  organizations: ["Organizations", "— none"],
  destinations: ["Destination catalog", "(used by campaigns)"],
  health: ["Health", "(infra)"],
  audit: ["Audit", "/os/campaigns/[id]"],
  webhooks: ["Provider webhooks (inbound)", "(server-to-server)"],
  "api/webhooks": ["Provider webhooks (inbound)", "(server-to-server)"],
  "webhooks/numbers": ["Number webhooks (inbound)", "(server-to-server)"],
  "v1/settlements": ["FX settlement", "— none"],
  "v1/fx": ["FX rates", "— none"]
};

const FLAGGED_OFF = {
  "financial-products": "virtualAccounts / virtualCards / remittance — ALL OFF",
  "trust-engine": "trustEngine — OFF",
  "ad-accounts": "kycVerification — OFF (KYC route only)"
};

const byPrefix = new Map();
for (const e of data.endpoints) {
  if (!byPrefix.has(e.prefix)) byPrefix.set(e.prefix, []);
  byPrefix.get(e.prefix).push(e);
}

const adminPrefixes = [...byPrefix.keys()].filter((p) => p.startsWith("admin"));
const clientPrefixes = [...byPrefix.keys()].filter((p) => !p.startsWith("admin"));

function statRow(p) {
  const eps = byPrefix.get(p);
  const ex = eps.filter((e) => e.kind === "exact").length;
  const dy = eps.filter((e) => e.kind === "dynamic").length;
  const un = eps.filter((e) => e.kind === "none").length;
  return { p, total: eps.length, ex, dy, un };
}

const L = [];
const w = (s = "") => L.push(s);

const totals = {
  total: data.endpoints.length,
  ex: data.endpoints.filter((e) => e.kind === "exact").length,
  dy: data.endpoints.filter((e) => e.kind === "dynamic").length,
  un: data.endpoints.filter((e) => e.kind === "none").length
};

w("# FlipTrybe — Backend/Frontend Parity Matrix");
w();
w("Generated from source: every `@Get/@Post/@Patch/@Put/@Delete` in `apps/api/src/**/*.controller*.ts`, cross-referenced against every API-path string literal in `apps/web/app` and `apps/admin/app`.");
w();
w("This is the spec for reaching full parity. It supersedes the Stitch mockups as the source of truth for *what must exist*; the mockups govern only *how it looks*.");
w();
w("## Headline");
w();
w("| | Count |");
w("|---|---|");
w(`| API endpoints | **${totals.total}** |`);
w(`| Wired — exact path match | ${totals.ex} |`);
w(`| Wired — via dynamic dispatch | ${totals.dy} |`);
w(`| **Unwired — no frontend caller** | **${totals.un}** |`);
w(`| Frontend routes (web) | ${data.webRoutes.length} (${data.webRoutes.filter((r) => r.redirect).length} redirect shims) |`);
w(`| Frontend routes (admin) | ${data.adminRoutes.length} |`);
w();
w(`**${Math.round((totals.un / totals.total) * 100)}% of the backend has no frontend caller.** That figure is the parity gap.`);
w();
w("---");
w();
w("## 1. Client API coverage by domain");
w();
w("| Domain | Endpoints | Wired | Unwired | Owning route | Flag |");
w("|---|---|---|---|---|---|");
for (const p of clientPrefixes.map(statRow).sort((a, b) => b.un - a.un || b.total - a.total)) {
  const [label, route] = DOMAIN[p.p] ?? [p.p, "?"];
  const flag = FLAGGED_OFF[p.p] ? "⚠️ " + FLAGGED_OFF[p.p] : "";
  w(`| ${label} \`/${p.p}\` | ${p.total} | ${p.ex + p.dy} | ${p.un ? "**" + p.un + "**" : "0"} | ${route} | ${flag} |`);
}
w();
w("## 2. Admin API coverage by domain");
w();
w("| Domain | Endpoints | Wired | Unwired |");
w("|---|---|---|---|");
for (const p of adminPrefixes.map(statRow).sort((a, b) => b.un - a.un || b.total - a.total)) {
  w(`| \`/${p.p}\` | ${p.total} | ${p.ex + p.dy} | ${p.un ? "**" + p.un + "**" : "0"} |`);
}
w();
w("---");
w();
w("## 3. The work list — every unwired endpoint");
w();
w("Each row is a screen or control that does not exist yet. Grouped by domain, ordered by size.");
w();

const unwiredByPrefix = [...byPrefix.entries()]
  .map(([p, eps]) => [p, eps.filter((e) => e.kind === "none")])
  .filter(([, eps]) => eps.length)
  .sort((a, b) => b[1].length - a[1].length);

for (const [p, eps] of unwiredByPrefix) {
  const [label, route] = DOMAIN[p] ?? [p, "?"];
  w(`### \`/${p}\` — ${label} (${eps.length} unwired)`);
  if (FLAGGED_OFF[p]) w(`> ⚠️ ${FLAGGED_OFF[p]}`);
  w(`Owning route: ${route}`);
  w();
  w("| Method | Path | Permission |");
  w("|---|---|---|");
  for (const e of eps) {
    const perm = e.isPublic ? "_public_" : (e.perms ?? []).join(", ") || "—";
    w(`| ${e.verb} | \`${e.path}\` | ${perm} |`);
  }
  w();
}

w("---");
w();
w("## 4. Screens that call nothing");
w();
w("Non-redirect routes where neither the page nor anything it imports (2 hops) calls the API. Marketing/legal pages are expected here; app screens are not.");
w();
if (staticRoutes.length) {
  w("| Route | File |");
  w("|---|---|");
  for (const r of staticRoutes) w(`| \`${r.route}\` | ${r.file} |`);
} else {
  w("_None detected._");
}
w();
w("## 4b. Screens rendering hardcoded mock data");
w();
w("These render invented values. Each is a screen that looks finished and is not.");
w();
if (mockRoutes.length) {
  w("| Route | File |");
  w("|---|---|");
  for (const r of mockRoutes) w(`| \`${r.route}\` | ${r.file} |`);
} else {
  w("_None detected._");
}
w();
w("## 5. Redirect shims (compatibility layer — do not delete)");
w();
w(data.webRoutes.filter((r) => r.redirect).map((r) => `\`${r.route}\``).join(" · "));
w();
w("### Verified by hand");
w();
w("- `/os/settings/api` renders `MOCK_KEYS` while `/developer/api-keys` exposes 3 real endpoints. The screen is a facade over a working API.");
w("- `/os/settings/workspace` hardcodes `useState(\"FlipTrybe Studio\")`, `\"fliptrybe-studio\"`, `\"Africa/Lagos\"`. It cannot save.");
w("- `/forgot-password` has three submit handlers (`handleQuestions`, `handlePin`, `handleReset`) and makes no API call. **Password reset is non-functional end to end.**");
w("- `/admin/*` in `apps/web` is 7 mock screens duplicating `apps/admin`, gated on session presence only — no `isPlatformAdmin` check.");
w();
w("---");
w();
w("## 6. Method and limitations");
w();
w("- **Wired** means a matching path string was found in the frontend. It does **not** prove the call is reachable from the UI, sends correct params, or handles errors. Treat as an upper bound on real parity.");
w("- **Dynamic** means the frontend builds the path from a variable (e.g. `` `/campaigns/${id}/actions/${action}` ``), so every literal under that prefix counts as reachable. Nothing statically proves which ones actually are.");
w("- Endpoints defined outside a `*.controller*.ts` file are not counted.");
w("- Server-to-server webhook receivers are listed as unwired and should stay that way — they are called by providers, not the UI.");

fs.writeFileSync(path.join(here, "parity-matrix.md"), L.join("\n"));
console.log("wrote parity-matrix.md");
console.log("static routes flagged:", staticRoutes.length);
console.log(staticRoutes.map((r) => r.route).join("\n"));
