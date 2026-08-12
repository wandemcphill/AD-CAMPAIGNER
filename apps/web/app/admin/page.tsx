import { redirect } from "next/navigation";

import { getAdminUrl } from "./admin-url";

// Retired: this used to be a second, weakly-gated admin dashboard duplicating
// apps/admin (the real, isPlatformAdmin-gated governance console). Redirect
// to the real console instead.
//
// Passed as a URL object, not a string: with typedRoutes on, redirect()'s
// string overload requires a Route<string> literal matching a known internal
// route, which an external cross-app URL never will. A URL object uses a
// separate overload that isn't subject to that check.
export default function AdminDashboardRedirect() {
  redirect(new URL(getAdminUrl("/")));
}
