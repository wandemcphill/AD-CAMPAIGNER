import { redirect } from "next/navigation";
import type { Route } from "next";

import { getAdminUrl } from "../admin-url";

// Retired: real digital-products ops live in apps/admin, properly gated on
// isPlatformAdmin.
export default function AdminProductsRedirect() {
  redirect(getAdminUrl("/digital-products") as unknown as Route);
}
