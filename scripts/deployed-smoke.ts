type CheckStatus = "PASS" | "FAIL" | "SKIP";
type HttpMethod = "GET" | "POST";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  durationMs?: number;
  httpStatus?: number;
  target?: string;
}

interface SmokeConfig {
  apiUrl: URL;
  appUrl: URL | undefined;
  adminUrl: URL | undefined;
  timeoutMs: number;
  writeChecksEnabled: boolean;
  adminAuthChecksEnabled: boolean;
}

interface ResponseBody {
  contentType: string;
  json?: unknown;
  text: string;
}

const userAgent = "fliptrybe-deployed-smoke/1.0";

const webRoutes = [
  { name: "Web campaigns route", path: "/campaigns" },
  { name: "Web campaign intake route", path: "/campaigns/new" },
  { name: "Web billing route", path: "/billing" },
  { name: "Web reports route", path: "/reports" },
  { name: "Web profile route", path: "/profile" },
  { name: "Web notifications route", path: "/notifications" }
];

const adminRoutes = [
  { name: "Admin campaign ops route", path: "/campaign-ops" },
  { name: "Admin review queue route", path: "/campaign-ops/queue" },
  { name: "Admin campaign detail route", path: "/campaign-ops/detail" },
  { name: "Admin reports queue route", path: "/campaign-ops/reports" },
  { name: "Admin activity route", path: "/campaign-ops/activity" }
];

const protectedManagedAdsRoutes: Array<{
  method: HttpMethod;
  name: string;
  path: string;
  payload?: Record<string, unknown>;
}> = [
  { method: "GET", name: "Campaigns reject unauthenticated", path: "/v1/campaigns" },
  { method: "GET", name: "Company profiles reject unauthenticated", path: "/v1/company-profiles" },
  { method: "GET", name: "Invoices reject unauthenticated", path: "/v1/invoices" },
  { method: "GET", name: "Notifications reject unauthenticated", path: "/v1/notifications" },
  {
    method: "POST",
    name: "Media upload intents reject unauthenticated",
    path: "/v1/media/upload-intents",
    payload: { byteSize: 1024, contentType: "image/png", filename: "smoke.png" }
  },
  {
    method: "POST",
    name: "Wallet funding intents reject unauthenticated",
    path: "/v1/wallet/funding-intents",
    payload: { amountMinor: 1000, currency: "NGN" }
  },
  {
    method: "GET",
    name: "Admin campaign ops overview rejects unauthenticated",
    path: "/v1/admin/campaign-ops/overview"
  },
  {
    method: "GET",
    name: "Admin campaign ops queue rejects unauthenticated",
    path: "/v1/admin/campaign-ops/queue"
  }
];

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function maybeUrl(name: string) {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return undefined;
  }

  try {
    return new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function requiredUrl(name: string) {
  const url = maybeUrl(name);

  if (!url) {
    throw new Error(`${name} is required.`);
  }

  return url;
}

function displayUrl(url: URL) {
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");

  return `${url.origin}${path}${url.search ? "?..." : ""}`;
}

function withPath(base: URL, path: string) {
  const url = new URL(base.toString());
  const basePath = url.pathname.replace(/\/+$/, "");
  let requestedPath = path.startsWith("/") ? path : `/${path}`;

  if (basePath.endsWith("/v1") && requestedPath.startsWith("/v1/")) {
    requestedPath = requestedPath.slice("/v1".length);
  }

  url.pathname = `${basePath}${requestedPath}`.replace(/\/{2,}/g, "/");
  url.search = "";
  url.hash = "";

  return url;
}

async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      headers: {
        "user-agent": userAgent,
        ...init.headers
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(response: Response): Promise<ResponseBody> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const trimmed = text.trim();

  if (contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { contentType, json: JSON.parse(text) as unknown, text };
    } catch {
      return { contentType, text };
    }
  }

  return { contentType, text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" && value[key].trim().length > 0;
}

async function runCheck(name: string, target: URL | undefined, check: () => Promise<CheckResult>) {
  const startedAt = Date.now();

  if (!target) {
    return {
      name,
      status: "SKIP",
      detail: "URL env var is not set.",
      durationMs: 0
    } satisfies CheckResult;
  }

  try {
    const result = await check();

    return {
      ...result,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      name,
      status: "FAIL",
      detail: error instanceof Error ? error.message : "Unexpected smoke check failure.",
      durationMs: Date.now() - startedAt,
      target: displayUrl(target)
    } satisfies CheckResult;
  }
}

function expectJsonRecord(body: ResponseBody, label: string) {
  if (!isRecord(body.json)) {
    throw new Error(`${label} did not return a JSON object.`);
  }

  return body.json;
}

function expectJsonArray(body: ResponseBody, label: string) {
  if (!Array.isArray(body.json)) {
    throw new Error(`${label} did not return a JSON array.`);
  }

  return body.json;
}

async function get(url: URL, config: SmokeConfig, headers: HeadersInit = {}) {
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      redirect: "follow",
      headers
    },
    config.timeoutMs
  );
  const body = await readBody(response);

  return { response, body };
}

async function postJson(
  url: URL,
  config: SmokeConfig,
  payload: Record<string, unknown>,
  headers: HeadersInit = {}
) {
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      redirect: "follow",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(payload)
    },
    config.timeoutMs
  );
  const body = await readBody(response);

  return { response, body };
}

function expectStatus(response: Response, expected: number[], label: string) {
  if (!expected.includes(response.status)) {
    throw new Error(`${label} returned HTTP ${response.status}; expected ${expected.join(" or ")}.`);
  }
}

function expectSuccess(response: Response, label: string) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
}

async function checkStaticApp(name: string, url: URL | undefined, config: SmokeConfig) {
  return runCheck(name, url, async () => {
    if (!url) {
      throw new Error(`${name} URL is not configured.`);
    }

    const { response, body } = await get(url, config);

    expectSuccess(response, name);

    if (!body.contentType.includes("text/html") && !body.text.toLowerCase().includes("<html")) {
      throw new Error(`${name} did not look like an HTML app shell.`);
    }

    return {
      name,
      status: "PASS",
      detail: "App shell returned HTML.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkStaticRoute(name: string, baseUrl: URL | undefined, path: string, config: SmokeConfig) {
  const url = baseUrl ? withPath(baseUrl, path) : undefined;

  return checkStaticApp(name, url, config);
}

async function checkApiHealth(config: SmokeConfig) {
  const url = withPath(config.apiUrl, "/v1/health");

  return runCheck("API health", url, async () => {
    const { response, body } = await get(url, config);
    const json = expectJsonRecord(body, "API health");

    expectSuccess(response, "API health");

    if (json.status !== "ok") {
      throw new Error("API health JSON did not report status=ok.");
    }
    if (json.service !== "fliptrybe-api") {
      throw new Error("API health JSON did not identify fliptrybe-api.");
    }

    return {
      name: "API health",
      status: "PASS",
      detail: "Health JSON reported status=ok.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkJsonArrayRoute(config: SmokeConfig, name: string, path: string) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response, body } = await get(url, config);

    expectSuccess(response, name);
    expectJsonArray(body, name);

    return {
      name,
      status: "PASS",
      detail: "Returned JSON array.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkJsonObjectRoute(config: SmokeConfig, name: string, path: string) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response, body } = await get(url, config);

    expectSuccess(response, name);
    expectJsonRecord(body, name);

    return {
      name,
      status: "PASS",
      detail: "Returned JSON object.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkProtectedRouteRejects(config: SmokeConfig, name: string, path: string) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response } = await get(url, config);

    expectStatus(response, [401, 403], name);

    return {
      name,
      status: "PASS",
      detail: "Rejected unauthenticated request.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkProtectedRequestRejects(
  config: SmokeConfig,
  name: string,
  method: HttpMethod,
  path: string,
  payload: Record<string, unknown> = {}
) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response } =
      method === "POST" ? await postJson(url, config, payload) : await get(url, config);

    expectStatus(response, [401, 403], name);

    return {
      name,
      status: "PASS",
      detail: "Rejected unauthenticated request.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

function extractToken(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["token", "accessToken", "access_token", "idToken", "id_token"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const key of ["session", "data", "result"]) {
    const candidate = extractToken(value[key]);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

async function resolveAuthHeaders(config: SmokeConfig, results: CheckResult[]) {
  const token = process.env.AUTH_SMOKE_TOKEN?.trim();
  const email = process.env.AUTH_SMOKE_EMAIL?.trim();
  const password = process.env.AUTH_SMOKE_PASSWORD;

  if (token) {
    results.push({
      name: "Auth setup",
      status: "PASS",
      detail: "Using AUTH_SMOKE_TOKEN.",
      durationMs: 0
    });

    return { authorization: `Bearer ${token}` };
  }

  if (!email && !password) {
    results.push({
      name: "Auth setup",
      status: "SKIP",
      detail: "Set AUTH_SMOKE_TOKEN or AUTH_SMOKE_EMAIL/AUTH_SMOKE_PASSWORD for authenticated checks.",
      durationMs: 0
    });

    return undefined;
  }

  if (!email || !password) {
    results.push({
      name: "Auth setup",
      status: "FAIL",
      detail: "AUTH_SMOKE_EMAIL and AUTH_SMOKE_PASSWORD must be set together.",
      durationMs: 0
    });

    return undefined;
  }

  const loginUrl = maybeUrl("AUTH_SMOKE_LOGIN_URL") ?? withPath(config.apiUrl, "/v1/auth/login");
  let issuedToken: string | undefined;
  const loginResult = await runCheck("Auth login", loginUrl, async () => {
    const { response, body } = await postJson(loginUrl, config, { email, password });

    expectSuccess(response, "Auth login");

    issuedToken = extractToken(body.json);

    if (!issuedToken) {
      throw new Error("Auth login response did not include a supported token field.");
    }

    return {
      name: "Auth login",
      status: "PASS",
      detail: "Credentials exchanged for a bearer token.",
      httpStatus: response.status,
      target: displayUrl(loginUrl)
    };
  });

  results.push(loginResult);

  if (loginResult.status !== "PASS") {
    return undefined;
  }

  return issuedToken ? { authorization: `Bearer ${issuedToken}` } : undefined;
}

async function checkAuthenticatedSession(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/auth/session");

  return runCheck("Authenticated session", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonRecord(body, "Authenticated session");

    expectSuccess(response, "Authenticated session");

    if (!isRecord(json.user) || !isRecord(json.workspace)) {
      throw new Error("Authenticated session did not include user and workspace objects.");
    }

    return {
      name: "Authenticated session",
      status: "PASS",
      detail: "Session returned user and workspace scope.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedDigitalAccess(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/digital-access/requests");

  return runCheck("Authenticated Digital Access requests", url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, "Authenticated Digital Access requests");
    expectJsonArray(body, "Authenticated Digital Access requests");

    return {
      name: "Authenticated Digital Access requests",
      status: "PASS",
      detail: "Returned the workspace-scoped request list.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedJsonArray(
  config: SmokeConfig,
  headers: HeadersInit,
  name: string,
  path: string
) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, name);
    expectJsonArray(body, name);

    return {
      name,
      status: "PASS",
      detail: "Returned authenticated workspace-scoped list.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedJsonObject(
  config: SmokeConfig,
  headers: HeadersInit,
  name: string,
  path: string
) {
  const url = withPath(config.apiUrl, path);

  return runCheck(name, url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, name);
    expectJsonRecord(body, name);

    return {
      name,
      status: "PASS",
      detail: "Returned authenticated workspace-scoped object.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedAdminDigitalAccess(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/admin/digital-access/overview");

  return runCheck("Authenticated admin Digital Access overview", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonRecord(body, "Authenticated admin Digital Access overview");

    expectSuccess(response, "Authenticated admin Digital Access overview");

    if (!hasString(json, "enabled") && typeof json.enabled !== "boolean") {
      throw new Error("Admin overview did not include enabled state.");
    }

    return {
      name: "Authenticated admin Digital Access overview",
      status: "PASS",
      detail: "Returned admin overview JSON.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedAdminCampaignOps(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/admin/campaign-ops/overview");

  return runCheck("Authenticated admin Campaign Ops overview", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonRecord(body, "Authenticated admin Campaign Ops overview");

    expectSuccess(response, "Authenticated admin Campaign Ops overview");

    if (!Array.isArray(json.queue) || !Array.isArray(json.reports) || !Array.isArray(json.activity)) {
      throw new Error("Admin Campaign Ops overview did not include queue, reports, and activity arrays.");
    }

    return {
      name: "Authenticated admin Campaign Ops overview",
      status: "PASS",
      detail: "Returned managed ads operations overview JSON.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkOptInWrite(config: SmokeConfig) {
  const url = withPath(config.apiUrl, "/v1/support/tickets");

  if (!config.writeChecksEnabled) {
    return {
      name: "Opt-in write smoke",
      status: "SKIP",
      detail: "Set SMOKE_ENABLE_WRITE_CHECKS=true to create a synthetic support ticket.",
      durationMs: 0,
      target: displayUrl(url)
    } satisfies CheckResult;
  }

  return runCheck("Opt-in write smoke", url, async () => {
    const { response, body } = await postJson(url, config, {
      subject: `Deployed smoke ${new Date().toISOString()}`,
      body: "Synthetic deployed smoke ticket. Safe to close."
    });
    const json = expectJsonRecord(body, "Opt-in write smoke");

    expectSuccess(response, "Opt-in write smoke");

    if (!hasString(json, "id")) {
      throw new Error("Synthetic support ticket response did not include an id.");
    }

    return {
      name: "Opt-in write smoke",
      status: "PASS",
      detail: "Created a synthetic support ticket.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

function loadConfig(): SmokeConfig {
  return {
    apiUrl: requiredUrl("API_URL"),
    appUrl: maybeUrl("APP_URL"),
    adminUrl: maybeUrl("ADMIN_URL"),
    timeoutMs: numberFromEnv("SMOKE_TIMEOUT_MS", 15000),
    writeChecksEnabled: isEnabled(process.env.SMOKE_ENABLE_WRITE_CHECKS),
    adminAuthChecksEnabled:
      isEnabled(process.env.AUTH_SMOKE_ADMIN) || isEnabled(process.env.AUTH_SMOKE_EXPECT_ADMIN)
  };
}

function printHelp() {
  console.log(`Deployed smoke checks

Required:
  API_URL=https://your-api.example.com

Recommended:
  APP_URL=https://your-web.example.com
  ADMIN_URL=https://your-admin.example.com

Optional auth:
  AUTH_SMOKE_TOKEN=...
  AUTH_SMOKE_EMAIL=operator@example.com AUTH_SMOKE_PASSWORD=...
  AUTH_SMOKE_LOGIN_URL=https://your-api.example.com/v1/auth/login
  AUTH_SMOKE_ADMIN=true
  AUTH_SMOKE_EXPECT_ADMIN=true

Optional behavior:
  SMOKE_TIMEOUT_MS=15000
  SMOKE_ENABLE_WRITE_CHECKS=true
`);
}

function printSummary(results: CheckResult[], config: SmokeConfig) {
  console.log("Deployed smoke targets");
  console.log(`API_URL   ${displayUrl(config.apiUrl)}`);
  console.log(`APP_URL   ${config.appUrl ? displayUrl(config.appUrl) : "(not set)"}`);
  console.log(`ADMIN_URL ${config.adminUrl ? displayUrl(config.adminUrl) : "(not set)"}`);
  console.log("");

  for (const result of results) {
    const meta = [
      result.httpStatus === undefined ? undefined : `HTTP ${result.httpStatus}`,
      result.durationMs === undefined ? undefined : `${result.durationMs}ms`,
      result.target
    ].filter(Boolean);

    console.log(`${result.status} ${result.name}: ${result.detail}${meta.length ? ` (${meta.join(", ")})` : ""}`);
  }

  console.log("");
  console.log(
    `Summary: ${results.filter((result) => result.status === "PASS").length} passed, ${results.filter((result) => result.status === "FAIL").length} failed, ${results.filter((result) => result.status === "SKIP").length} skipped.`
  );
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();

    return;
  }

  const config = loadConfig();
  const results: CheckResult[] = [];

  results.push(await checkApiHealth(config));
  results.push(await checkStaticApp("Web app availability", config.appUrl, config));
  results.push(await checkStaticApp("Admin app availability", config.adminUrl, config));
  for (const route of webRoutes) {
    results.push(await checkStaticRoute(route.name, config.appUrl, route.path, config));
  }
  for (const route of adminRoutes) {
    results.push(await checkStaticRoute(route.name, config.adminUrl, route.path, config));
  }
  results.push(await checkJsonArrayRoute(config, "Destination catalog", "/v1/destinations/catalog"));
  results.push(await checkJsonArrayRoute(config, "SMM services catalog", "/v1/smm/services"));
  results.push(await checkProtectedRouteRejects(config, "Wallet rejects unauthenticated", "/v1/wallet"));
  results.push(await checkProtectedRouteRejects(config, "Session rejects unauthenticated", "/v1/auth/session"));
  results.push(
    await checkProtectedRouteRejects(
      config,
      "Digital Access requests reject unauthenticated",
      "/v1/digital-access/requests"
    )
  );
  for (const route of protectedManagedAdsRoutes) {
    results.push(
      await checkProtectedRequestRejects(
        config,
        route.name,
        route.method,
        route.path,
        route.payload
      )
    );
  }

  const authHeaders = await resolveAuthHeaders(config, results);

  if (authHeaders) {
    results.push(await checkAuthenticatedSession(config, authHeaders));
    results.push(await checkAuthenticatedDigitalAccess(config, authHeaders));
    results.push(
      await checkAuthenticatedJsonArray(
        config,
        authHeaders,
        "Authenticated managed ads campaigns",
        "/v1/campaigns"
      )
    );
    results.push(
      await checkAuthenticatedJsonObject(config, authHeaders, "Authenticated managed ads wallet", "/v1/wallet")
    );
    results.push(
      await checkAuthenticatedJsonArray(
        config,
        authHeaders,
        "Authenticated managed ads invoices",
        "/v1/invoices"
      )
    );

    if (config.adminAuthChecksEnabled) {
      results.push(await checkAuthenticatedAdminDigitalAccess(config, authHeaders));
      results.push(await checkAuthenticatedAdminCampaignOps(config, authHeaders));
    }
  }

  results.push(await checkOptInWrite(config));
  printSummary(results, config);

  if (results.some((result) => result.status === "FAIL")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke script failed.");
  process.exitCode = 1;
});
