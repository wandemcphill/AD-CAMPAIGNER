"use client";

import { type ReactNode, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState } from "../../campaigns/components";
import { useFeatureFlags } from "../../lib/feature-flags";

// Each tab is backed by its own feature flag and its own provider domain — a
// deployment can run remittance without virtual cards. Tabs whose flag is off
// are not rendered at all, because their endpoints answer 503.
const TABS = [
  { id: "accounts", label: "Accounts", flag: "virtualAccounts" },
  { id: "cards", label: "Cards", flag: "virtualCards" },
  { id: "remittance", label: "Remittance", flag: "remittance" }
];

export default function FinancialProductsLayout({ children }: { children: ReactNode }) {
  const { flags, ready: flagsReady } = useFeatureFlags();
  const availableTabs = TABS.filter((t) => flags[t.flag] === true);
  const router = useRouter();
  const pathname = usePathname();
  const activeTab =
    TABS.find((t) => pathname.startsWith(`/os/financial-products/${t.id}`))?.id ?? "accounts";

  const onChange = useCallback(
    (id: string) => {
      router.push(`/os/financial-products/${id}`);
    },
    [router]
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Financial Products</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Virtual accounts, virtual cards, and international transfers.
        </p>
        {/* Only warn about sandbox behaviour when this deployment has NOT turned
            on live provider integrations. Showing it against a live provider
            would tell customers their real money movement is fake. */}
        {flags["liveProviderIntegrations"] !== true && (
          <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            These are sandbox/mock-backed in this environment — no real bank account, card, or
            transfer is created yet.
          </div>
        )}

        {flagsReady && availableTabs.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              copy="Virtual accounts, virtual cards, and international transfers are not switched on for this workspace yet. Contact support if you were expecting access."
              title="Not available yet"
            />
          </div>
        ) : (
          <>
            <div className="mt-4">
              <TabBar items={availableTabs} onChange={onChange} value={activeTab} />
            </div>

            {children}
          </>
        )}
      </div>
    </div>
  );
}
