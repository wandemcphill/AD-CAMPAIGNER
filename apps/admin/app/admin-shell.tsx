"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import {
  Banknote,
  Boxes,
  CircleDollarSign,
  CreditCard,
  FileSearch,
  Gift,
  Globe,
  LifeBuoy,
  LockKeyhole,
  Network,
  Phone,
  Radar,
  ShieldCheck,
  Users,
  Wallet,
  ShoppingCart,
  Smartphone,
  Store,
  Webhook,
  type LucideIcon
} from "lucide-react";

import { ThemeToggle, cn } from "@fliptrybe/ui";

import { useApiSession } from "./lib/use-session";
import { AdminAuthState } from "./ui/admin-auth-state";
import { SessionPanel } from "./ui/session-panel";

export type AdminNavItem = { label: string; href: string; icon: LucideIcon };

/**
 * Single source of truth for the top-level admin nav. Previously this array
 * was duplicated inline in apps/admin/app/page.tsx and every other top-level
 * page had no way to navigate back to the rest of the console at all.
 *
 * campaign-ops/, growth-services/, and digital-access/ each keep their own
 * dedicated *section* shell (AdminCampaignOpsShell, AdminGrowthShell,
 * AdminDigitalAccessShell) with sub-nav scoped to that vertical — those are
 * intentionally separate and are not duplicated per-page within their own
 * section, so they are left as-is.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/", icon: Radar },
  { label: "Moderation", href: "/campaign-ops/", icon: ShieldCheck },
  { label: "Payments", href: "/campaign-ops/reports/", icon: Banknote },
  { label: "Wallets", href: "/wallets/", icon: Wallet },
  { label: "Users", href: "/users/", icon: Users },
  { label: "Growth", href: "/growth-services/", icon: Boxes },
  { label: "Audit", href: "/campaign-ops/activity/", icon: FileSearch },
  { label: "Access", href: "/digital-access/", icon: LockKeyhole },
  { label: "VTU", href: "/vtu/", icon: Smartphone },
  { label: "Providers", href: "/providers/", icon: Network },
  { label: "Digital Products", href: "/digital-products/", icon: Globe },
  { label: "Digital Value", href: "/digital-value/", icon: CircleDollarSign },
  { label: "Ad Accounts", href: "/ad-accounts/", icon: CreditCard },
  { label: "Telecom", href: "/telecom/", icon: Phone },
  { label: "Webhooks", href: "/webhooks/", icon: Webhook },
  { label: "Support", href: "/support/", icon: LifeBuoy },
  { label: "Rewards", href: "/rewards/", icon: Gift },
  { label: "Marketplace", href: "/marketplace/applications/", icon: Store },
  { label: "Guest Checkout", href: "/guest-checkout/", icon: ShoppingCart }
];

export function AdminShell({
  active,
  children,
  subtitle = "Governance console"
}: {
  active: string;
  children: ReactNode;
  subtitle?: string;
}) {
  const { error, loading, session } = useApiSession();

  useEffect(() => {
    if (!loading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
    }
  }, [loading, session]);

  if (loading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={error} loading={loading} title="Admin auth" />;
  }

  return (
    <main className="ft-shell min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-4 xl:border-r xl:border-b-0">
          <Link className="flex items-center gap-3" href="/">
            <img alt="FlipTrybe" className="size-10" src="/brand/icon-mark.svg" />
            <div>
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                FlipTrybe Admin
              </div>
              <div className="text-xs text-[var(--ft-text-muted)]">{subtitle}</div>
            </div>
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {ADMIN_NAV_ITEMS.map((item) => (
              <a
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition",
                  active === item.href
                    ? "bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
                    : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                )}
                href={item.href}
                key={item.label}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <ThemeToggle className="mt-4 w-full justify-center" />
          <SessionPanel />
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}
