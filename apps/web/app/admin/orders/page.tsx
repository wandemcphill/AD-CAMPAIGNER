import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: real order management lives in apps/admin's growth-services
// console (Perfect Panel / SMM order ops), properly gated on isPlatformAdmin.
export default function AdminOrdersRedirect() {
  redirect(getAdminUrl("/growth-services/orders"));
}
