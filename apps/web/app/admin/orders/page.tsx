import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: real order management lives in apps/admin's growth-services
// console (Perfect Panel / SMM order ops), properly gated on isPlatformAdmin.
//
// Passed as a URL object, not a string: with typedRoutes on, redirect()'s
// string overload requires a Route<string> literal matching a known internal
// route, which an external cross-app URL never will. A URL object uses a
// separate overload that isn't subject to that check.
export default function AdminOrdersRedirect() {
  redirect(new URL(getAdminUrl("/growth-services/orders")));
}
