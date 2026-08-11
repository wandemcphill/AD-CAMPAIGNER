import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/ADS CAMPAIGNER";
const API_SRC = path.join(ROOT, "apps/api/src");
const WEB_APP = path.join(ROOT, "apps/web/app");
const ADMIN_APP = path.join(ROOT, "apps/admin/app");

function walk(dir, filter, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}

// ---------- 1. Extract endpoints from Nest controllers ----------

const controllerFiles = walk(
  API_SRC,
  (p) =>
    /\.controllers?\.ts$/.test(p) &&
    !/\.test\.ts$/.test(p) &&
    !/\.spec\.ts$/.test(p)
);

const METHOD_RE = /^\s*@(Get|Post|Patch|Put|Delete)\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?\s*\)/;
const CONTROLLER_RE = /@Controller\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/;
const PERM_RE = /@RequirePermissions\(([^)]*)\)/;
const FEATURE_RE = /@RequireFeature\(([^)]*)\)/;
const PUBLIC_RE = /@Public\(\)/;

const endpoints = [];

for (const file of controllerFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  let prefix = "";
  let pendingPerms = null;
  let pendingFeature = null;
  let pendingPublic = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cm = line.match(CONTROLLER_RE);
    if (cm) {
      prefix = (cm[1] ?? cm[2] ?? "").replace(/^\/|\/$/g, "");
      pendingPerms = null;
      pendingFeature = null;
      pendingPublic = false;
      continue;
    }

    const pm = line.match(PERM_RE);
    if (pm) {
      pendingPerms = pm[1].replace(/["']/g, "").split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    const fm = line.match(FEATURE_RE);
    if (fm) {
      pendingFeature = fm[1].replace(/["']/g, "").split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }

    if (PUBLIC_RE.test(line)) {
      pendingPublic = true;
      continue;
    }

    const mm = line.match(METHOD_RE);
    if (mm) {
      const verb = mm[1].toUpperCase();
      const sub = (mm[2] ?? mm[3] ?? mm[4] ?? "").replace(/^\/|\/$/g, "");
      const full = "/" + [prefix, sub].filter(Boolean).join("/");
      endpoints.push({
        verb,
        path: full,
        prefix: prefix || "(root)",
        file: rel,
        line: i + 1,
        perms: pendingPerms,
        feature: pendingFeature,
        isPublic: pendingPublic
      });
      pendingPerms = null;
      pendingFeature = null;
      pendingPublic = false;
    }
  }
}

// ---------- 2. Collect frontend call sites ----------

const feFiles = [
  ...walk(WEB_APP, (p) => /\.(ts|tsx)$/.test(p)),
  ...walk(ADMIN_APP, (p) => /\.(ts|tsx)$/.test(p))
];

const feBlob = new Map(); // file -> content
for (const f of feFiles) feBlob.set(f, fs.readFileSync(f, "utf8"));

// Any quoted or templated string starting with a slash. Body is permissive on
// purpose: call sites look like `/campaigns/${encodeURIComponent(id)}/start`,
// so parens/commas must survive long enough to be normalized away below.
// Known limitation: a doubly-nested template (a `${...}` whose expression
// itself contains a template literal, e.g. a query-string builder) breaks
// this capture early. Confirmed manually rather than fixed here — a fancier
// regex here regressed matching broadly (verified, then reverted).
const CALL_RE = /[`"'](\/[^`"'\n]*)[`"']/g;
const feCalls = new Set();
const feCallOwners = new Map(); // normalized path -> Set(files)

for (const [file, content] of feBlob) {
  let m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(content))) {
    const raw = m[1];
    if (raw.length < 2) continue;
    // A trailing ${...} glued straight onto a path SEGMENT (no "/" right
    // before it) is almost always a query-string builder, e.g.
    // `/things${query}` or `/things${status ? `?status=${status}` : ""}` —
    // drop it. But `/things/${id}` is a real path segment (its own dynamic
    // dispatch target, e.g. `/campaigns/${id}/actions/${action}`) and MUST
    // NOT be stripped, or the whole dynamic-dispatch match collapses (this
    // regressed dynamic matches to 0 once — verified, then fixed).
    const withoutTrailingInterpolation = /\/\$\{[^}]*\}$/.test(raw)
      ? raw
      : raw.replace(/\$\{[^}]*\}$/, "");
    // strip query, normalize any remaining interpolations & params to :p
    const norm =
      withoutTrailingInterpolation
        .split("?")[0]
        .replace(/\$\{[^}]*\}/g, ":p")
        .replace(/\/:[a-zA-Z0-9_]+/g, "/:p")
        .replace(/\/$/, "") || "/";
    // discard anything that still isn't path-shaped after normalization
    if (!/^\/[a-zA-Z0-9_\-/.:]*$/.test(norm)) continue;
    feCalls.add(norm);
    if (!feCallOwners.has(norm)) feCallOwners.set(norm, new Set());
    feCallOwners.get(norm).add(path.relative(ROOT, file).replace(/\\/g, "/"));
  }
}

function normalizeApiPath(p) {
  return p.replace(/\/:[a-zA-Z0-9_]+/g, "/:p").replace(/\/$/, "") || "/";
}

// Exact match, then "dynamic dispatch": the frontend builds the last segment
// from a variable, e.g. `/campaigns/${id}/actions/${action}` reaches every
// /campaigns/:id/actions/<literal> route. Those count as wired, but flagged
// separately because nothing statically proves which literals are reachable.
function findWiring(ep) {
  const target = normalizeApiPath(ep.path);
  const owners = new Set();
  if (feCallOwners.has(target)) {
    for (const o of feCallOwners.get(target)) owners.add(o);
    return { owners, kind: "exact" };
  }

  const segs = target.split("/");
  for (const [fePath, files] of feCallOwners) {
    const fs2 = fePath.split("/");
    if (fs2.length !== segs.length) continue;
    let ok = true;
    let usedWildcard = false;
    for (let i = 0; i < segs.length; i++) {
      if (fs2[i] === segs[i]) continue;
      if (fs2[i] === ":p") {
        usedWildcard = true;
        continue;
      }
      ok = false;
      break;
    }
    if (ok && usedWildcard) for (const f of files) owners.add(f);
  }
  return { owners, kind: owners.size ? "dynamic" : "none" };
}

// ---------- 3. Frontend route inventory ----------

function routesOf(appDir, appLabel) {
  const pages = walk(appDir, (p) => /[\\/]page\.tsx$/.test(p));
  return pages
    .map((p) => {
      let r = path
        .relative(appDir, path.dirname(p))
        .replace(/\\/g, "/")
        .replace(/\(([^)]*)\)\//g, "");
      r = "/" + r;
      if (r === "/.") r = "/";
      const content = fs.readFileSync(p, "utf8");
      const isRedirect =
        /redirect\(|window\.location\.replace\(|router\.replace\(/.test(content) &&
        content.length < 2000;
      return { app: appLabel, route: r, redirect: isRedirect, file: path.relative(ROOT, p).replace(/\\/g, "/") };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

const webRoutes = routesOf(WEB_APP, "web");
const adminRoutes = routesOf(ADMIN_APP, "admin");

// ---------- 4. Group + emit ----------

const byPrefix = new Map();
for (const ep of endpoints) {
  if (!byPrefix.has(ep.prefix)) byPrefix.set(ep.prefix, []);
  byPrefix.get(ep.prefix).push(ep);
}

const rows = [];
for (const [, eps] of byPrefix) {
  for (const ep of eps.sort((a, b) => a.path.localeCompare(b.path))) {
    const { owners, kind } = findWiring(ep);
    rows.push({ ...ep, kind, owners: [...owners] });
  }
}

const exact = rows.filter((r) => r.kind === "exact").length;
const dynamic = rows.filter((r) => r.kind === "dynamic").length;
const none = rows.filter((r) => r.kind === "none").length;

const here = path.dirname(new URL(import.meta.url).pathname.slice(1));
fs.writeFileSync(
  path.join(here, "parity-data.json"),
  JSON.stringify({ endpoints: rows, webRoutes, adminRoutes }, null, 2)
);

console.log("endpoints:", rows.length);
console.log("  exact-wired :", exact);
console.log("  dynamic     :", dynamic);
console.log("  UNWIRED     :", none);
console.log("web routes:", webRoutes.length, "(redirect shims:", webRoutes.filter((r) => r.redirect).length + ")");
console.log("admin routes:", adminRoutes.length);
console.log("\nprefix  total  unwired");
for (const [p, e] of [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const u = e.filter((x) => findWiring(x).kind === "none").length;
  if (u) console.log(`  ${String(e.length).padStart(3)}  ${String(u).padStart(3)} unwired  /${p}`);
}
