// apps/web/app/admin/* is retired: it used to be a second, weakly-gated admin
// surface duplicating apps/admin (the real, isPlatformAdmin-gated governance
// console — a separate Render service, see render.yaml). These routes now
// just redirect to the equivalent page on the real admin app so any old
// bookmarks/links still land somewhere useful.
function normalizeAdminBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "") || "http://localhost:3100";
}

export function getAdminBaseUrl() {
  return normalizeAdminBaseUrl(
    process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3100"
  );
}

export function getAdminUrl(path = "") {
  return `${getAdminBaseUrl()}${path}`;
}
