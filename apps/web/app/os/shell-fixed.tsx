"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  Building2,
  CreditCard,
  FileText,
  Gift,
  Globe,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  PackageSearch,
  Phone,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  Tv,
  UserCircle,
  Users,
  Wand2,
  Wifi,
  Workflow,
  X,
  Zap,
  Bitcoin,
  ClipboardCheck,
  ClipboardList,
  Briefcase,
  Bot,
  BarChart3,
  Send,
  QrCode,
  MessageSquare
} from "lucide-react";

import { ThemeToggle, cn } from "@fliptrybe/ui";
import { useFeatureFlags } from "../lib/feature-flags";
import { useApiSession } from "../lib/use-session";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  flag?: string;
};

type NavSection = NavItem & { children?: NavItem[] };

const PRIMARY_NAV: NavSection[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard, children: [] },
  {
    label: "Growth", href: "/os/campaigns", icon: Megaphone,
    children: [
      { label: "Campaign Builder", href: "/os/campaigns/new", icon: Wand2 },
      { label: "Campaign Manager", href: "/os/campaigns", icon: Megaphone },
      { label: "AI Studio", href: "/os/studio", icon: Sparkles },
      { label: "Analytics", href: "/os/analytics", icon: BarChart3 },
      { label: "Reports", href: "/os/reports", icon: FileText },
      { label: "Automation", href: "/os/automation", icon: Workflow, flag: "workflowAutomation" },
      { label: "Creative Library", href: "/os/library", icon: FileText },
      { label: "AI Personas", href: "/os/personas", icon: Bot },
      { label: "Growth Services", href: "/os/growth", icon: Zap },
      { label: "Approvals", href: "/os/approvals", icon: ClipboardCheck, permission: "campaign:approve" },
      { label: "Trust Engine", href: "/os/trust-engine", icon: ShieldCheck, permission: "analytics:read", flag: "trustEngine" }
    ]
  },
  {
    label: "Money", href: "/os/money", icon: Banknote,
    children: [
      { label: "Overview", href: "/os/money", icon: Banknote },
      { label: "Wallet", href: "/os/wallet", icon: CreditCard },
      { label: "Invoices", href: "/os/money/invoices", icon: FileText, flag: "invoicing" },
      { label: "Payment Links", href: "/os/money/payment-links", icon: Link2, flag: "paymentLinks" },
      { label: "Virtual Accounts", href: "/os/financial-products/accounts", icon: Building2, flag: "virtualAccounts" },
      { label: "Virtual Cards", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards" },
      { label: "Transfers", href: "/os/financial-products/remittance", icon: Send, flag: "remittance" }
    ]
  },
  {
    label: "Services", href: "/os/services", icon: Store,
    children: [
      { label: "Airtime", href: "/os/airtime/airtime", icon: Phone, flag: "vtu" },
      { label: "Data", href: "/os/airtime/data", icon: Wifi, flag: "vtu" },
      { label: "Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell" },
      { label: "International Top-Up", href: "/os/telecom", icon: Globe, flag: "telecomGateway" },
      { label: "International Numbers", href: "/os/numbers", icon: Globe, flag: "virtualNumbers" },
      { label: "My Numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers" },
      { label: "Electricity", href: "/os/utilities/electricity", icon: Lightbulb, flag: "billsElectricity" },
      { label: "Cable TV", href: "/os/utilities/cable", icon: Tv, flag: "billsCable" },
      { label: "Education", href: "/os/utilities/education", icon: GraduationCap, flag: "billsEducation" },
      { label: "Bet Funding", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting" },
      { label: "Sell Crypto", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell" },
      { label: "Buy RMB", href: "/os/rmb", icon: Banknote, flag: "rmbBuy" },
      { label: "Digital Access", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess" }
    ]
  },
  {
    label: "Marketplace", href: "/os/marketplace", icon: Building2,
    children: [
      { label: "Discover", href: "/os/marketplace", icon: Store },
      { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase },
      { label: "Creators", href: "/os/marketplace/creators", icon: Globe },
      { label: "Applications", href: "/os/marketplace/applications", icon: ClipboardList }
    ]
  },
  {
    label: "Rewards", href: "/os/rewards", icon: Trophy,
    children: [
      { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy, flag: "rewards" },
      { label: "My Progress", href: "/os/rewards/progress", icon: Gift, flag: "rewards" },
      { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode, flag: "rewards" },
      { label: "Vouchers", href: "/os/vouchers", icon: Ticket }
    ]
  }
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Team", href: "/os/team", icon: Users },
  { label: "My Orders", href: "/os/orders", icon: PackageSearch },
  { label: "Transactions", href: "/os/wallet", icon: FileText },
  { label: "Notifications", href: "/os/notifications", icon: Bell },
  { label: "Support", href: "/os/support", icon: LifeBuoy, flag: "support" },
  { label: "Profile", href: "/os/profile", icon: UserCircle },
  { label: "Settings", href: "/os/settings", icon: Settings }
];

const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard },
  { label: "Growth", href: "/os/campaigns", icon: Megaphone },
  { label: "Money", href: "/os/money", icon: Banknote },
  { label: "Services", href: "/os/services", icon: Store },
  { label: "More", href: "/os/search", icon: Menu }
];

export function OsShellFixed({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, signOut } = useApiSession();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !session) window.location.replace("/login");
  }, [loading, session]);

  if (loading || !session) return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;

  const canSee = (item: NavItem) => {
    if (item.flag && !(flagsReady && flags[item.flag] === true)) return false;
    if (!item.permission) return true;
    return session.isPlatformAdmin || Boolean(session.permissions?.includes(item.permission));
  };

  const visiblePrimary = PRIMARY_NAV.filter(canSee).map((section) => ({
    ...section,
    children: (section.children ?? []).filter(canSee)
  }));
  const visibleAccount = ACCOUNT_NAV.filter(canSee);

  const isActive = (href: string) => href === "/os" ? pathname === "/os" : pathname.startsWith(href);
  const title = [...visiblePrimary.flatMap((s) => [s, ...(s.children ?? [])]), ...visibleAccount]
    .filter((item) => isActive(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "FlipTrybe";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-bold">FlipTrybe</span>
              <button onClick={() => setSidebarOpen(false)} type="button"><X className="size-5" /></button>
            </div>
            {visiblePrimary.map((section) => (
              <div key={section.href}>
                <a className={cn("flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium", isActive(section.href) ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)]")} href={section.href} onClick={() => setSidebarOpen(false)}>
                  <section.icon className="size-4" />{section.label}
                </a>
                {isActive(section.href) && (section.children?.length ?? 0) > 0 && (
                  <div className="my-1 ml-6 flex flex-col gap-0.5 border-l border-[var(--ft-border)] pl-2">
                    {(section.children ?? []).map((child) => (
                      <a className={cn("flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-[13px]", isActive(child.href) ? "font-medium text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)]")} href={child.href} key={child.href} onClick={() => setSidebarOpen(false)}>
                        <child.icon className="size-4" />{child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 border-t border-[var(--ft-border)] pt-3">
              {visibleAccount.map((item) => (
                <a className="flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--ft-text-secondary)]" href={item.href} key={item.href} onClick={() => setSidebarOpen(false)}>
                  <item.icon className="size-4" />{item.label}
                </a>
              ))}
              <button className="mt-2 flex h-10 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--ft-text-secondary)]" disabled={signingOut} onClick={() => void handleSignOut()} type="button">
                <LogOut className="size-4" />{signingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--ft-border)] px-5">
          <img alt="FlipTrybe" className="size-8" src="/brand/icon-mark.svg" />
          <div><div className="text-sm font-bold">FlipTrybe</div><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">Growth OS</div></div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {visiblePrimary.map((section) => {
            const active = isActive(section.href);
            return (
              <div key={section.href}>
                <a className={cn("flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium", active ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} href={section.href}>
                  <section.icon className="size-4" />{section.label}
                </a>
                {active && (section.children?.length ?? 0) > 0 && (
                  <div className="my-1 ml-[22px] flex flex-col gap-0.5 border-l border-[var(--ft-border)] pl-2">
                    {(section.children ?? []).map((child) => (
                      <a className={cn("flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-3 text-[12.5px]", isActive(child.href) ? "font-medium text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]")} href={child.href} key={child.href}>
                        <child.icon className="size-3.5" />{child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-4 border-t border-[var(--ft-border)] pt-3">
            {visibleAccount.map((item) => (
              <a className={cn("flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium", isActive(item.href) ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} href={item.href} key={item.href}>
                <item.icon className="size-4" />{item.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="border-t border-[var(--ft-border)] p-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-xs font-bold text-[var(--ft-accent)]">{session.user.name?.[0] ?? "U"}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{session.user.name}</div><div className="truncate text-[11px] text-[var(--ft-text-muted)]">@{session.user.username}</div></div>
            <ThemeToggle />
          </div>
          <button className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)]" disabled={signingOut} onClick={() => void handleSignOut()} type="button">
            <LogOut className="size-3.5" />{signingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/90 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setSidebarOpen(true)} type="button"><Menu className="size-5 text-[var(--ft-text-muted)]" /></button><div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">{title}</div></div>
          <div className="flex items-center gap-1"><a className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-[var(--ft-text-muted)]" href="/os/notifications"><Bell className="size-4" /></a><ThemeToggle className="hidden lg:inline-flex" /><button className="hidden h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)] sm:flex" disabled={signingOut} onClick={() => void handleSignOut()} type="button"><LogOut className="size-3.5" />{signingOut ? "Signing out..." : "Logout"}</button></div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE_NAV.map((item) => (
            <a className={cn("grid place-items-center gap-0.5 py-1", isActive(item.href) ? "text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]")} href={item.href} key={item.href} onClick={item.label === "More" ? (event) => { event.preventDefault(); setSidebarOpen(true); } : undefined}>
              <item.icon className="size-5" /><span className="text-[10px] font-medium">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
