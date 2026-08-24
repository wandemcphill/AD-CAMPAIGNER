"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FeatureFlagProvider } from "../lib/feature-flags";
import { TechnologyChrome } from "./technology-chrome";
import { OsShellFixed } from "./shell-fixed";
import { CustomerActionRail } from "./customer-action-rail";
import { CustomerTransactionJourney, type TransactionJourneyStage } from "./components/customer-transaction-journey";

const TRANSACTION_ROUTES: Array<{ match: string; label: string }> = [
  { match: "/os/financial-products/remittance", label: "Send money" },
  { match: "/os/crypto", label: "USDT / USDC" },
  { match: "/os/rmb", label: "RMB / China payment" },
  { match: "/os/digital-value", label: "Gift card / cashout" }
];

function stageForPath(pathname: string): TransactionJourneyStage | null {
  const match = TRANSACTION_ROUTES.find((route) => pathname === route.match || pathname.startsWith(`${route.match}/`));
  if (!match) return null;
  return "choose";
}

function transactionLabel(pathname: string) {
  return TRANSACTION_ROUTES.find((route) => pathname === route.match || pathname.startsWith(`${route.match}/`))?.label;
}

export default function OsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const journeyStage = stageForPath(pathname);
  const journeyLabel = transactionLabel(pathname);

  return (
    <FeatureFlagProvider>
      <TechnologyChrome>
        <OsShellFixed>
          <CustomerActionRail pathname={pathname} />
          {journeyStage && journeyLabel ? (
            <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/90 px-4 py-3 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[1600px] rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/80 p-3 shadow-[var(--shadow-sm)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">{journeyLabel}</div>
                    <div className="mt-0.5 text-xs text-[var(--ft-text-secondary)]">One consistent flow from intent to outcome.</div>
                  </div>
                  <span className="hidden rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)] sm:inline-flex">Transaction flow</span>
                </div>
                <CustomerTransactionJourney current={journeyStage} compact />
              </div>
            </div>
          ) : null}
          {children}
        </OsShellFixed>
      </TechnologyChrome>
    </FeatureFlagProvider>
  );
}
