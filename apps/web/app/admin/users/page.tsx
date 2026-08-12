import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: apps/admin has no dedicated user-management page yet, so this
// redirects to the real console's dashboard rather than keeping a mock,
// weakly-gated duplicate alive here.
export default function AdminUsersRedirect() {
  redirect(getAdminUrl("/"));
}
