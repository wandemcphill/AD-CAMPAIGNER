"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Activity, Banknote, Boxes, CircleDollarSign, CreditCard, FileSearch, Gift, Globe, LifeBuoy, LockKeyhole, Network, Phone, Radar, Scale, ShieldAlert, ShieldCheck, Tags, Users, Wallet, ShoppingCart, Smartphone, Store, Webhook, type LucideIcon } from "lucide-react";
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

export function AdminShell({ active, children, subtitle = "Control center" }: { active: string; children: ReactNode; subtitle?: string }) {
  const { error, loading, session } = useApiSession();
  useEffect(() => { if (!loading && !session?.isPlatformAdmin) window.location.replace("/login/"); }, [loading, session]);
  if (loading || !session?.isPlatformAdmin) return <AdminAuthState error={error} loading={loading} title="Admin auth" />;

  return (
    <main className="ft-admin-shell ft-shell min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[276px_1fr]">
        <aside className="ft-glass border-b border-[var(--ft-border)] px-4 py-5 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:border-r xl:border-b-0">
          <Link className="group flex items-center gap-3 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-3 shadow-[var(--shadow-sm)]" href="/">
            <img alt="FlipTrybe Technology" className="size-11 transition group-hover:rotate-2" src="/brand/icon-mark.svg" />
            <div className="min-w-0"><div className="truncate text-sm font-semibold tracking-tight">FlipTrybe Technology</div><div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-accent)]">{subtitle}</div></div>
          </Link>
          <div className="mt-5 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/55 p-3"><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ft-text-muted)]">Platform status</div><div className="mt-2 flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full bg-[var(--ft-green)] shadow-[0_0_14px_var(--ft-green-glow)]" /> All monitored systems online</div></div>
          <nav className="mt-5 grid grid-cols-2 gap-1 xl:grid-cols-1" aria-label="Admin navigation">
            {ADMIN_NAV_ITEMS.map(item => <Link aria-current={active === item.href ? "page" : undefined} className={cn("group flex min-h-10 items-center gap-3 rounded-xl border border-transparent px-3 text-left text-[13px] font-medium transition", active === item.href ? "border-[var(--ft-accent)]/20 bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)] shadow-[var(--shadow-xs)]" : "text-[var(--ft-text-secondary)] hover:border-[var(--ft-border)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]")} href={item.href} key={item.label}><item.icon className={cn("size-4 shrink-0", active === item.href ? "text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)] group-hover:text-[var(--ft-accent)]")} /><span>{item.label}</span></Link>)}
          </nav>
          <ThemeToggle className="mt-4 w-full justify-center" />
          <SessionPanel />
        </aside>
        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-9 lg:py-7">{children}</section>
      </div>
    </main>
  );
}
