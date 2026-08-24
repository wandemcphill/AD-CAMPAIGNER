"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import {
  Activity,
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
  Scale,
  ShieldAlert,
  ShieldCheck,
  Tags,
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

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/", icon: Radar },
  { label: "Operations Control Tower", href: "/operations-control-tower/", icon: Activity },
  { label: "Risk & Security", href: "/risk/", icon: ShieldAlert },
  { label: "Moderation", href: "/campaign-ops/", icon: ShieldCheck },
  { label: "Payments", href: "/payments/", icon: Banknote },
  { label: "Wallets", href: "/wallets/", icon: Wallet },
  { label: "Users", href: "/users/", icon: Users },
  { label: "Reconciliation", href: "/reconciliation/", icon: Scale },
  { label: "Fulfilment", href: "/fulfilment/", icon: Boxes },
  { label: "Products & Pricing", href: "/commercial/", icon: Tags },
  { label: "Product Governance", href: "/product-governance/", icon: Boxes },
  { label: "Provider Governance", href: "/provider-governance/", icon: Network },
  { label: "Growth", href: "/growth-services/", icon: Boxes },
  { label: "Audit", href: "/audit/", icon: FileSearch },
  { label: "Access", href: "/digital-access/", icon: LockKeyhole },
  { label: "VTU", href: "/vtu/", icon: Smartphone },
  { label: "Providers", href: "/providers/", icon: Network },
  { label: "Digital Products", href: "/digital-products/", icon: Globe },
  { label: "Digital Value", href: "/digital-value/", icon: CircleDollarSign },
  { label: "Ad Accounts", href: "/ad-accounts/", icon: CreditCard },
  { label: "Telecom", href: "/telecom/", icon: Phone },
  { label: "Webhook Operations", href: "/webhook-operations/", icon: Webhook },
  { label: "Webhooks", href: "/webhooks/", icon: Webhook },
  { label: "Support Operations", href: "/support-ops/", icon: LifeBuoy },
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
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">FlipTrybe Admin</div>
              <div className="text-xs text-[var(--ft-text-muted)]">{subtitle}</div>
            </div>
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Admin navigation">
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                aria-current={active === item.href ? "page" : undefined}
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
              </Link>
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
