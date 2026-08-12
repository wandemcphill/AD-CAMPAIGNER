"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { useFeatureFlags } from "../../lib/feature-flags";

const TAB_ORDER = [
  { id: "accounts", flag: "virtualAccounts" },
  { id: "cards", flag: "virtualCards" },
  { id: "remittance", flag: "remittance" }
];

// Bare "/os/financial-products" (old default tab, and any stale bookmark/link)
// redirects to the first tab this deployment has switched on, falling back to
// "accounts" once flags are known so the URL always resolves to a real route.
export default function FinancialProductsIndexPage() {
  const router = useRouter();
  const { flags, ready } = useFeatureFlags();

  useEffect(() => {
    if (!ready) return;
    const firstAvailable = TAB_ORDER.find((t) => flags[t.flag] === true)?.id ?? "accounts";
    router.replace(`/os/financial-products/${firstAvailable}` as Route);
  }, [ready, flags, router]);

  return null;
}
