"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Building2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState } from "../../campaigns/components";
import { isAgeRestrictedError } from "../../lib/api-client";
import { useFeatureFlags } from "../../lib/feature-flags";
import { AgeGateNotice } from "../age-gate-notice";
import { loadAccounts } from "./api";

const TABS = [
  { id: "accounts", label: "Accounts", flag: "virtualAccounts" },
  { id: "cards", label: "Cards", flag: "virtualCards" },
  { id: "remittance", label: "Remittance", flag: "remittance" }
];

const TAB_ROUTES = {
  accounts: "/os/financial-products/accounts",
  cards: "/os/financial-products/cards",
  remittance: "/os/financial-products/remittance"
} as const satisfies Record<(typeof TABS)[number]["id"], string>;

export default function FinancialProductsLayout({ children }: { children: ReactNode }) {
  const { flags, ready: flagsReady } = useFeatureFlags();
  const availableTabs = TABS.filter((tab) => flags[tab.flag] === true);
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = TABS.find((tab) => pathname.startsWith(`/os/financial-products/${tab.id}`))?.id ?? "accounts";
  const [ageRestricted, setAgeRestricted] = useState(false);

  useEffect(() => {
    void loadAccounts().catch((caught) => {
      if (isAgeRestrictedError(caught)) setAgeRestricted(true);
    });
  }, []);

  const onChange = useCallback((id: string) => {
    const target = TAB_ROUTES[id as keyof typeof TAB_ROUTES];
    if (target) router.push(target);
  }, [router]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><Building2 className="size-5" /></span><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Global money</div><h1 className="mt-1 text-xl font-bold tracking-[-0.02em]">Financial Products</h1><p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Hold supported foreign currencies, spend globally and move money through supported corridors.</p></div></div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[10px] font-semibold text-[var(--ft-text-muted)]"><ArrowLeftRight className="size-3.5" /> Review before you move money</div>
        </div>

        {flags["liveProviderIntegrations"] !== true && (
          <div className="mt-3 rounded-xl border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">Some financial products are sandbox/mock-backed in this environment. Availability is shown per product before you begin.</div>
        )}

        {ageRestricted ? (
          <div className="mt-6"><AgeGateNotice feature="Financial products" /></div>
        ) : flagsReady && availableTabs.length === 0 ? (
          <div className="mt-6"><EmptyState copy="No financial products are switched on for this workspace yet. Contact support if you were expecting access." title="Not available yet" /></div>
        ) : (
          <>
            <div className="mt-4"><TabBar items={availableTabs} onChange={onChange} value={activeTab} /></div>
            {children}
          </>
        )}
      </div>
    </div>
  );
}
