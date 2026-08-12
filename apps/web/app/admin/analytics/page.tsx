import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: real analytics live in apps/admin's digital-access console,
// properly gated on isPlatformAdmin.
export default function AdminAnalyticsRedirect() {
  redirect(getAdminUrl("/digital-access/analytics"));
}
