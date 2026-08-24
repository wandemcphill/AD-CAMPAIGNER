const adminUrl = new URL(process.env.ADMIN_URL ?? "https://fliptrybe-ads-campaigner-admin-umys.onrender.com");
const apiUrl = new URL(process.env.API_URL ?? "https://ft-campaigner-api-fra.onrender.com");
const timeoutMs = Number.isFinite(Number(process.env.SMOKE_TIMEOUT_MS)) ? Number(process.env.SMOKE_TIMEOUT_MS) : 15000;

const adminRoutes = [
  "/",
  "/operations-control-tower/",
  "/risk/",
  "/campaign-ops/",
  "/payments/",
  "/wallets/",
  "/users/",
  "/reconciliation/",
  "/fulfilment/",
  "/commercial/",
  "/product-governance/",
  "/provider-governance/",
  "/growth-services/",
  "/audit/",
  "/digital-access/",
  "/vtu/",
  "/providers/",
  "/digital-products/",
  "/digital-value/",
  "/ad-accounts/",
  "/telecom/",
  "/webhook-operations/",
  "/webhooks/",
  "/support/",
  "/support-ops/",
  "/rewards/",
  "/marketplace/applications/",
  "/guest-checkout/",
  "/campaign-ops/queue/",
  "/campaign-ops/reports/",
  "/campaign-ops/activity/"
];

const protectedAdminApiRoutes = [
  "/v1/admin/command-center/overview",
  "/v1/admin/command-center/alerts",
  "/v1/admin/command-center/fulfilment",
  "/v1/admin/operations-control-tower/overview",
  "/v1/admin/operations-control-tower/queue",
  "/v1/admin/finance/payments",
  "/v1/admin/reconciliation/exceptions",
  "/v1/admin/support/tickets",
  "/v1/admin/digital-access/overview",
  "/v1/admin/campaign-ops/overview",
  "/v1/admin/campaign-ops/campaigns",
  "/v1/admin/campaign-ops/queue",
  "/v1/admin/campaign-ops/reports",
  "/v1/admin/campaign-ops/activity"
];

async function request(url: URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      headers: { "user-agent": "fliptrybe-admin-surface-audit/1.0", ...(init.headers ?? {}) },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function auditAdminRoute(path: string) {
  const url = new URL(path, adminUrl);
  const response = await request(url);
  const body = await response.text();
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Admin route ${path} returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !body.toLowerCase().includes("<html")) {
    throw new Error(`Admin route ${path} did not return an HTML application shell.`);
  }
}

async function auditProtectedApi(path: string) {
  const url = new URL(path, apiUrl);
  const response = await request(url);
  if (response.status !== 401 && response.status !== 403) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`Protected admin endpoint ${path} returned HTTP ${response.status}; expected 401/403. Body: ${body}`);
  }
}

async function main() {
  const failures: string[] = [];

  for (const route of adminRoutes) {
    try {
      await auditAdminRoute(route);
      console.log(`PASS admin ${route}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(detail);
      console.error(`FAIL admin ${route}: ${detail}`);
    }
  }

  for (const route of protectedAdminApiRoutes) {
    try {
      await auditProtectedApi(route);
      console.log(`PASS protected ${route}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(detail);
      console.error(`FAIL protected ${route}: ${detail}`);
    }
  }

  console.log(`Admin surface audit: ${adminRoutes.length + protectedAdminApiRoutes.length - failures.length} passed, ${failures.length} failed.`);
  if (failures.length > 0) process.exitCode = 1;
}

void main();
