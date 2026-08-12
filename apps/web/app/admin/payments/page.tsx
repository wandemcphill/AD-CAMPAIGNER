import { redirect } from "next/navigation";

import { getAdminUrl } from "../admin-url";

// Retired: real payment/settlement ops live in apps/admin's digital-products
// console, properly gated on isPlatformAdmin.
export default function AdminPaymentsRedirect() {
  redirect(getAdminUrl("/digital-products"));
}
