import { redirect } from "next/navigation";
import type { Route } from "next";

import { getAdminUrl } from "./admin-url";

// Retired: this used to be a second, weakly-gated admin dashboard duplicating
// apps/admin (the real, isPlatformAdmin-gated governance console). Redirect
// to the real console instead.
export default function AdminDashboardRedirect() {
  redirect(getAdminUrl("/") as unknown as Route);
}
