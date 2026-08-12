import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: real provider management lives in apps/admin, properly gated on
// isPlatformAdmin.
//
// Passed as a URL object, not a string: with typedRoutes on, redirect()'s
// string overload requires a Route<string> literal matching a known internal
// route, which an external cross-app URL never will. A URL object uses a
// separate overload that isn't subject to that check.
export default function AdminProvidersRedirect() {
  redirect(new URL(getAdminUrl("/providers")));
}
