import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: apps/admin has no dedicated user-management page yet, so this
// redirects to the real console's dashboard rather than keeping a mock,
// weakly-gated duplicate alive here.
//
// Cast through `never` rather than a URL object or `as Route`: local
// typedRoutes-augmented builds type redirect() as Route<string> | URL, but a
// checkout with no .next/types generated yet (as in CI, which typechecks
// before any `next build`/`dev` has run) sees the un-augmented string-only
// signature -- a URL object satisfies the former but fails the latter. This
// external cross-app URL will never match Route<string>'s internal-route
// literal check either way, and `never` is assignable to every possible
// signature, so it works under both.
export default function AdminUsersRedirect() {
  redirect(getAdminUrl("/") as never);
}
