import { redirect } from "next/navigation";
import type { Route } from "next";

import { getAdminUrl } from "../admin-url";

// Retired: real provider management lives in apps/admin, properly gated on
// isPlatformAdmin.
export default function AdminProvidersRedirect() {
  redirect(getAdminUrl("/providers") as unknown as Route);
}
