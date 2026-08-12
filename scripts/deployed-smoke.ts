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
  { name: "Web landing page", path: "/" },
  { name: "Web campaigns route", path: "/campaigns" },
  { name: "Web campaign intake route", path: "/campaigns/new" },
  { name: "Web billing route", path: "/billing" },
  { name: "Web reports route", path: "/reports" },
  { name: "Web profile route", path: "/profile" },
  { name: "Web notifications route", path: "/notifications" },
  // Public, no-account bills flow — the one purchase path an anonymous visitor
  // can complete, so a break here is silent revenue loss.
  { name: "Web guest checkout route", path: "/guest" },
  // Canonical /os screens for the verticals that move money.
  { name: "Web airtime/data route", path: "/os/airtime" },
  { name: "Web utilities route", path: "/os/utilities" },
  { name: "Web growth services route", path: "/os/growth" },
  { name: "Web financial products route", path: "/os/financial-products" },
  { name: "Web wallet route", path: "/os/wallet" }
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
  { method: "GET", name: "Client profile rejects unauthenticated", path: "/v1/client-profile" },
  { method: "GET", name: "Campaigns reject unauthenticated", path: "/v1/campaigns" },
  { method: "GET", name: "Campaign detail rejects unauthenticated", path: "/v1/campaigns/smoke_campaign" },
  { method: "GET", name: "Campaign timeline rejects unauthenticated", path: "/v1/campaigns/smoke_campaign/timeline" },
  { method: "GET", name: "Campaign notes reject unauthenticated", path: "/v1/campaigns/smoke_campaign/notes" },
  { method: "GET", name: "Campaign assets reject unauthenticated", path: "/v1/campaigns/smoke_campaign/assets" },
  { method: "GET", name: "Campaign reports reject unauthenticated", path: "/v1/campaigns/smoke_campaign/reports" },
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
    name: "Admin campaign ops campaigns reject unauthenticated",
    path: "/v1/admin/campaign-ops/campaigns"
  },
  {
    method: "GET",
    name: "Admin campaign ops queue rejects unauthenticated",
    path: "/v1/admin/campaign-ops/queue"
  },
  {
    method: "GET",
    name: "Admin campaign ops reports reject unauthenticated",
    path: "/v1/admin/campaign-ops/reports"
  },
  {
    method: "GET",
    name: "Admin campaign ops activity rejects unauthenticated",
    path: "/v1/admin/campaign-ops/activity"
  }
];

const p1ProtectedAdminRoutes = [
  { name: "P1 admin overview rejects unauthenticated", path: "/v1/admin/overview" },
  { name: "P1 admin SMM health rejects unauthenticated", path: "/v1/admin/smm/health" },
  { name: "P1 admin AI suggestions reject unauthenticated", path: "/v1/admin/ai/suggestions" }
];

const protectedVerticalRoutes = [
  { name: "VTU orders reject unauthenticated", path: "/v1/vtu/orders" },
  { name: "VTU data plans reject unauthenticated", path: "/v1/vtu/data-plans" },
  { name: "Bills orders reject unauthenticated", path: "/v1/vtu/bills/orders" },
  { name: "Virtual accounts reject unauthenticated", path: "/v1/financial-products/accounts" },
  { name: "Virtual cards reject unauthenticated", path: "/v1/financial-products/cards" },
  { name: "Remittance transfers reject unauthenticated", path: "/v1/financial-products/remittance" },
  { name: "Telecom orders reject unauthenticated", path: "/v1/telecom/orders" }
];

const p1PublicGrowthRoutes = [
  { name: "P1 growth catalog", path: "/v1/growth/catalog", shape: "record" },
  { name: "P1 growth services", path: "/v1/growth/services", shape: "array" }
] as const;

const campaignStatuses = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "CREATIVE_IN_PROGRESS",
  "RUNNING",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
  "QUEUED"
]);

const adminCampaignStatuses = new Set([
  "submitted",
  "review",
  "approved",
  "assigned",
  "creative_review",
  "platform_launch",
  "optimization",
  "paused",
  "reporting",
  "blocked",
  "completed",
  "failed"
]);

const invoiceStatuses = new Set([
  "DRAFT",
  "ISSUED",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "VOID",
  "CANCELLED",
  "REFUNDED"
]);

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
  const [pathPart, searchPart = ""] = path.split("?", 2);
  let requestedPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;

  if (basePath.endsWith("/v1") && requestedPath.startsWith("/v1/")) {
    requestedPath = requestedPath.slice("/v1".length);
  }

  url.pathname = `${basePath}${requestedPath}`.replace(/\/{2,}/g, "/");
  url.search = searchPart ? `?${searchPart}` : "";
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

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }

  try {
    return JSON.stringify(value) ?? "[unserializable value]";
  } catch {
    return "[unserializable value]";
  }
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" && value[key].trim().length > 0;
}

function hasNumber(value: Record<string, unknown>, key: string) {
  const candidate = value[key];

  return typeof candidate === "number" && Number.isFinite(candidate);
}

function hasArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]);
}

function expectString(value: Record<string, unknown>, key: string, label: string) {
  if (!hasString(value, key)) {
    throw new Error(`${label} did not include ${key}.`);
  }
}

function readString(value: Record<string, unknown>, key: string, label: string) {
  const candidate = value[key];

  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new Error(`${label} did not include ${key}.`);
  }

  return candidate;
}

function expectArrayField(value: Record<string, unknown>, key: string, label: string) {
  if (!hasArray(value, key)) {
    throw new Error(`${label} did not include ${key} array.`);
  }
}

function expectStatusValue(
  value: Record<string, unknown>,
  key: string,
  allowed: Set<string>,
  label: string
) {
  const status = value[key];

  if (typeof status !== "string" || !allowed.has(status)) {
    throw new Error(`${label} returned unsupported ${key}=${formatUnknown(status)}.`);
  }
}

function expectMoneyShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} did not include a money object.`);
  }
  if (!hasNumber(value, "amountMinor")) {
    throw new Error(`${label} money object did not include amountMinor.`);
  }
  expectString(value, "currency", `${label} money object`);
}

function expectOptionalIsoString(value: Record<string, unknown>, key: string, label: string) {
  const candidate = value[key];

  if (candidate !== null && candidate !== undefined && typeof candidate !== "string") {
    throw new Error(`${label} ${key} must be an ISO string or null.`);
  }
}

function skipResult(name: string, detail: string, target?: URL): CheckResult {
  return {
    name,
    status: "SKIP",
    detail,
    durationMs: 0,
    target: target ? displayUrl(target) : undefined
  };
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
  if (!isUnknownArray(body.json)) {
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

async function checkJsonRecordRoute(config: SmokeConfig, name: string, path: string) {
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

function expectCampaignShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not a campaign object.`);
  }

  expectString(value, "id", label);
  expectString(value, "name", label);
  expectStatusValue(value, "status", campaignStatuses, label);
  expectMoneyShape(value.budget, `${label} budget`);
  expectOptionalIsoString(value, "submittedAt", label);
  expectOptionalIsoString(value, "approvedAt", label);
  expectOptionalIsoString(value, "createdAt", label);
  expectOptionalIsoString(value, "updatedAt", label);

  if (value.destination !== undefined && value.destination !== null) {
    const destination = isRecord(value.destination) ? value.destination : undefined;

    if (!destination || !hasString(destination, "kind")) {
      throw new Error(`${label} destination did not include kind.`);
    }
  }

  return value;
}

function expectAdminCampaignShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not an admin campaign object.`);
  }

  expectString(value, "id", label);
  expectString(value, "name", label);
  expectString(value, "workspaceName", label);
  expectString(value, "ownerName", label);
  expectString(value, "channel", label);
  expectString(value, "nextAction", label);
  expectStatusValue(value, "status", adminCampaignStatuses, label);
  expectMoneyShape(value.budget, `${label} budget`);

  if (!hasNumber(value, "progress")) {
    throw new Error(`${label} did not include numeric progress.`);
  }

  return value;
}

function expectInvoiceShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not an invoice object.`);
  }

  expectString(value, "id", label);
  expectString(value, "number", label);
  expectStatusValue(value, "status", invoiceStatuses, label);
  if (!hasNumber(value, "totalMinor")) {
    throw new Error(`${label} did not include totalMinor.`);
  }
  expectString(value, "currency", label);
}

function expectNotificationShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not a notification object.`);
  }

  expectString(value, "id", label);
  expectString(value, "title", label);
  expectString(value, "body", label);
  expectString(value, "channel", label);
  expectString(value, "status", label);
}

function expectAdminReportShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not an admin report object.`);
  }

  expectString(value, "id", label);
  expectString(value, "title", label);
  expectString(value, "status", label);
  expectArrayField(value, "metrics", label);
}

function expectAdminActivityShape(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} was not an activity object.`);
  }

  expectString(value, "id", label);
  expectString(value, "action", label);
  expectString(value, "target", label);
  expectString(value, "severity", label);
}

async function checkAuthenticatedClientProfile(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/client-profile");

  return runCheck("Authenticated managed ads client profile", url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, "Authenticated managed ads client profile");

    if (body.json !== null && body.text.trim() !== "null") {
      expectJsonRecord(body, "Authenticated managed ads client profile");
    }

    return {
      name: "Authenticated managed ads client profile",
      status: "PASS",
      detail: "Returned client profile object or empty profile state.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedManagedAdsCampaigns(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/campaigns");
  let firstCampaignId: string | undefined;

  const result = await runCheck("Authenticated managed ads campaigns", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, "Authenticated managed ads campaigns");

    expectSuccess(response, "Authenticated managed ads campaigns");

    json.slice(0, 5).forEach((campaign, index) => {
      const normalized = expectCampaignShape(campaign, `Campaign ${index + 1}`);
      firstCampaignId ??= readString(normalized, "id", `Campaign ${index + 1}`);
    });

    return {
      name: "Authenticated managed ads campaigns",
      status: "PASS",
      detail: firstCampaignId
        ? "Returned workspace-scoped campaign list with managed ads fields."
        : "Returned an empty workspace-scoped campaign list.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });

  return { result, firstCampaignId };
}

async function checkAuthenticatedCampaignDetail(
  config: SmokeConfig,
  headers: HeadersInit,
  campaignId: string | undefined
) {
  const url = campaignId ? withPath(config.apiUrl, `/v1/campaigns/${campaignId}`) : undefined;

  if (!campaignId || !url) {
    return skipResult(
      "Authenticated managed ads campaign detail",
      "No campaign exists in this workspace; skipping detail shape check."
    );
  }

  return runCheck("Authenticated managed ads campaign detail", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectCampaignShape(
      expectJsonRecord(body, "Authenticated managed ads campaign detail"),
      "Authenticated campaign detail"
    );

    expectSuccess(response, "Authenticated managed ads campaign detail");
    for (const key of ["creatives", "notes", "statusHistory", "reports", "invoices", "budgetHolds"]) {
      expectArrayField(json, key, "Authenticated campaign detail");
    }

    return {
      name: "Authenticated managed ads campaign detail",
      status: "PASS",
      detail: "Returned campaign detail with timeline, media, billing, and report collections.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedCampaignCollection(
  config: SmokeConfig,
  headers: HeadersInit,
  campaignId: string | undefined,
  name: string,
  suffix: string,
  objectField?: string
) {
  const url = campaignId ? withPath(config.apiUrl, `/v1/campaigns/${campaignId}/${suffix}`) : undefined;

  if (!campaignId || !url) {
    return skipResult(name, "No campaign exists in this workspace; skipping route shape check.");
  }

  return runCheck(name, url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, name);

    if (objectField) {
      const json = expectJsonRecord(body, name);
      expectArrayField(json, objectField, name);
    } else {
      expectJsonArray(body, name);
    }

    return {
      name,
      status: "PASS",
      detail: "Returned managed ads campaign sub-resource shape.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedManagedAdsWallet(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/wallet");

  return runCheck("Authenticated managed ads wallet", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonRecord(body, "Authenticated managed ads wallet");

    expectSuccess(response, "Authenticated managed ads wallet");
    expectString(json, "id", "Authenticated managed ads wallet");
    expectString(json, "workspaceId", "Authenticated managed ads wallet");
    expectMoneyShape(json.availableBalance, "Authenticated managed ads wallet availableBalance");
    expectMoneyShape(json.heldBalance, "Authenticated managed ads wallet heldBalance");
    expectArrayField(json, "entries", "Authenticated managed ads wallet");

    return {
      name: "Authenticated managed ads wallet",
      status: "PASS",
      detail: "Returned wallet balance, holds, and ledger entry shape.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedManagedAdsInvoices(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/invoices");

  return runCheck("Authenticated managed ads invoices", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, "Authenticated managed ads invoices");

    expectSuccess(response, "Authenticated managed ads invoices");
    json.slice(0, 5).forEach((invoice, index) => {
      expectInvoiceShape(invoice, `Invoice ${index + 1}`);
    });

    return {
      name: "Authenticated managed ads invoices",
      status: "PASS",
      detail: "Returned invoice history with campaign funding fields.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedManagedAdsNotifications(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/notifications");

  return runCheck("Authenticated managed ads notifications", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, "Authenticated managed ads notifications");

    expectSuccess(response, "Authenticated managed ads notifications");
    json.slice(0, 5).forEach((notification, index) => {
      expectNotificationShape(notification, `Notification ${index + 1}`);
    });

    return {
      name: "Authenticated managed ads notifications",
      status: "PASS",
      detail: "Returned notification feed with delivery fields.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedGrowthOrders(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/growth/orders");

  return runCheck("P1 authenticated growth orders", url, async () => {
    const { response, body } = await get(url, config, headers);

    expectSuccess(response, "P1 authenticated growth orders");
    expectJsonArray(body, "P1 authenticated growth orders");

    return {
      name: "P1 authenticated growth orders",
      status: "PASS",
      detail: "Returned authenticated growth order list.",
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
  let firstCampaignId: string | undefined;

  const result = await runCheck("Authenticated admin Campaign Ops overview", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonRecord(body, "Authenticated admin Campaign Ops overview");

    expectSuccess(response, "Authenticated admin Campaign Ops overview");

    if (!isRecord(json.totals)) {
      throw new Error("Admin Campaign Ops overview did not include totals object.");
    }
    expectArrayField(json, "metrics", "Admin Campaign Ops overview");
    expectArrayField(json, "queue", "Admin Campaign Ops overview");
    expectArrayField(json, "reports", "Admin Campaign Ops overview");
    expectArrayField(json, "activity", "Admin Campaign Ops overview");

    (json.queue as unknown[]).slice(0, 5).forEach((campaign, index) => {
      const normalized = expectAdminCampaignShape(campaign, `Admin overview campaign ${index + 1}`);
      firstCampaignId ??= readString(normalized, "id", `Admin overview campaign ${index + 1}`);
    });
    (json.reports as unknown[]).slice(0, 5).forEach((report, index) => {
      expectAdminReportShape(report, `Admin overview report ${index + 1}`);
    });
    (json.activity as unknown[]).slice(0, 5).forEach((activity, index) => {
      expectAdminActivityShape(activity, `Admin overview activity ${index + 1}`);
    });

    return {
      name: "Authenticated admin Campaign Ops overview",
      status: "PASS",
      detail: "Returned managed ads operations overview with queue, report, activity, and totals shapes.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });

  return { result, firstCampaignId };
}

async function checkAuthenticatedAdminCampaignList(
  config: SmokeConfig,
  headers: HeadersInit,
  name: string,
  path: string
) {
  const url = withPath(config.apiUrl, path);
  let firstCampaignId: string | undefined;

  const result = await runCheck(name, url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, name);

    expectSuccess(response, name);
    json.slice(0, 10).forEach((campaign, index) => {
      const normalized = expectAdminCampaignShape(campaign, `${name} item ${index + 1}`);
      firstCampaignId ??= readString(normalized, "id", `${name} item ${index + 1}`);
    });

    return {
      name,
      status: "PASS",
      detail: firstCampaignId
        ? "Returned admin campaign list with operational status and next-action fields."
        : "Returned an empty admin campaign list.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });

  return { result, firstCampaignId };
}

async function checkAuthenticatedAdminCampaignDetail(
  config: SmokeConfig,
  headers: HeadersInit,
  campaignId: string | undefined
) {
  const url = campaignId
    ? withPath(config.apiUrl, `/v1/admin/campaign-ops/campaigns/${campaignId}`)
    : undefined;

  if (!campaignId || !url) {
    return skipResult(
      "Authenticated admin Campaign Ops detail",
      "No admin campaign exists in this workspace; skipping detail shape check."
    );
  }

  return runCheck("Authenticated admin Campaign Ops detail", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectCampaignShape(
      expectJsonRecord(body, "Authenticated admin Campaign Ops detail"),
      "Authenticated admin campaign detail"
    );

    expectSuccess(response, "Authenticated admin Campaign Ops detail");
    for (const key of [
      "creatives",
      "notes",
      "statusHistory",
      "assignments",
      "manualPlacements",
      "reports",
      "invoices",
      "budgetHolds"
    ]) {
      expectArrayField(json, key, "Authenticated admin campaign detail");
    }

    return {
      name: "Authenticated admin Campaign Ops detail",
      status: "PASS",
      detail: "Returned admin campaign workspace with assignments, proofs, billing, and reports.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedAdminReports(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/admin/campaign-ops/reports");

  return runCheck("Authenticated admin Campaign Ops reports", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, "Authenticated admin Campaign Ops reports");

    expectSuccess(response, "Authenticated admin Campaign Ops reports");
    json.slice(0, 10).forEach((report, index) => {
      expectAdminReportShape(report, `Admin report ${index + 1}`);
    });

    return {
      name: "Authenticated admin Campaign Ops reports",
      status: "PASS",
      detail: "Returned admin report queue with publish-state fields.",
      httpStatus: response.status,
      target: displayUrl(url)
    };
  });
}

async function checkAuthenticatedAdminActivity(config: SmokeConfig, headers: HeadersInit) {
  const url = withPath(config.apiUrl, "/v1/admin/campaign-ops/activity");

  return runCheck("Authenticated admin Campaign Ops activity", url, async () => {
    const { response, body } = await get(url, config, headers);
    const json = expectJsonArray(body, "Authenticated admin Campaign Ops activity");

    expectSuccess(response, "Authenticated admin Campaign Ops activity");
    json.slice(0, 10).forEach((activity, index) => {
      expectAdminActivityShape(activity, `Admin activity ${index + 1}`);
    });

    return {
      name: "Authenticated admin Campaign Ops activity",
      status: "PASS",
      detail: "Returned admin activity log with audit-friendly fields.",
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
  // The web app reads this to decide which verticals to show; if it stops
  // answering, the whole sidebar silently empties out.
  results.push(
    await checkJsonRecordRoute(config, "Platform feature flags", "/v1/platform/feature-flags")
  );
  results.push(await checkJsonArrayRoute(config, "Destination catalog", "/v1/destinations/catalog"));
  results.push(await checkJsonArrayRoute(config, "SMM services catalog", "/v1/smm/services"));
  for (const route of p1PublicGrowthRoutes) {
    results.push(
      route.shape === "array"
        ? await checkJsonArrayRoute(config, route.name, route.path)
        : await checkJsonRecordRoute(config, route.name, route.path)
    );
  }
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
  for (const route of p1ProtectedAdminRoutes) {
    results.push(await checkProtectedRouteRejects(config, route.name, route.path));
  }
  // Money-moving verticals. AuthorizationGuard runs before FeatureFlagGuard, so
  // these answer 401 whether or not the vertical's flag is on — which is what
  // makes them a valid check on a deployment with financial products disabled.
  for (const route of protectedVerticalRoutes) {
    results.push(await checkProtectedRouteRejects(config, route.name, route.path));
  }

  const authHeaders = await resolveAuthHeaders(config, results);

  if (authHeaders) {
    results.push(await checkAuthenticatedSession(config, authHeaders));
    results.push(await checkAuthenticatedDigitalAccess(config, authHeaders));
    results.push(await checkAuthenticatedClientProfile(config, authHeaders));

    const campaignSmoke = await checkAuthenticatedManagedAdsCampaigns(config, authHeaders);
    results.push(campaignSmoke.result);
    results.push(
      await checkAuthenticatedCampaignDetail(config, authHeaders, campaignSmoke.firstCampaignId)
    );
    results.push(
      await checkAuthenticatedCampaignCollection(
        config,
        authHeaders,
        campaignSmoke.firstCampaignId,
        "Authenticated managed ads campaign timeline",
        "timeline",
        "items"
      )
    );
    results.push(
      await checkAuthenticatedCampaignCollection(
        config,
        authHeaders,
        campaignSmoke.firstCampaignId,
        "Authenticated managed ads campaign notes",
        "notes"
      )
    );
    results.push(
      await checkAuthenticatedCampaignCollection(
        config,
        authHeaders,
        campaignSmoke.firstCampaignId,
        "Authenticated managed ads campaign assets",
        "assets"
      )
    );
    results.push(
      await checkAuthenticatedCampaignCollection(
        config,
        authHeaders,
        campaignSmoke.firstCampaignId,
        "Authenticated managed ads campaign reports",
        "reports"
      )
    );
    results.push(await checkAuthenticatedManagedAdsWallet(config, authHeaders));
    results.push(await checkAuthenticatedManagedAdsInvoices(config, authHeaders));
    results.push(await checkAuthenticatedManagedAdsNotifications(config, authHeaders));
    results.push(await checkAuthenticatedGrowthOrders(config, authHeaders));

    if (config.adminAuthChecksEnabled) {
      results.push(await checkAuthenticatedAdminDigitalAccess(config, authHeaders));
      const adminOverview = await checkAuthenticatedAdminCampaignOps(config, authHeaders);
      results.push(adminOverview.result);
      const adminCampaigns = await checkAuthenticatedAdminCampaignList(
        config,
        authHeaders,
        "Authenticated admin Campaign Ops campaigns",
        "/v1/admin/campaign-ops/campaigns?limit=10"
      );
      results.push(adminCampaigns.result);
      const adminQueue = await checkAuthenticatedAdminCampaignList(
        config,
        authHeaders,
        "Authenticated admin Campaign Ops queue",
        "/v1/admin/campaign-ops/queue?limit=10"
      );
      results.push(adminQueue.result);
      results.push(await checkAuthenticatedAdminReports(config, authHeaders));
      results.push(await checkAuthenticatedAdminActivity(config, authHeaders));
      results.push(
        await checkAuthenticatedAdminCampaignDetail(
          config,
          authHeaders,
          adminOverview.firstCampaignId ?? adminCampaigns.firstCampaignId ?? adminQueue.firstCampaignId
        )
      );
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
