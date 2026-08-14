"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  BarChart3,
  Bell,
  Bitcoin,
  Bot,
  Briefcase,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Folder,
  Gift,
  Globe,
  Globe2,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  QrCode,
  Search,
  Send,
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
  type LucideIcon
} from "lucide-react";

import { ThemeToggle, cn } from "@fliptrybe/ui";
import { useFeatureFlags } from "../lib/feature-flags";
import { useApiSession } from "../lib/use-session";

/**
 * `flag` names a runtime feature flag from the API (see lib/feature-flags).
 * An item carrying one is hidden unless that flag resolved to true, so the
 * sidebar never links to a vertical this deployment answers 503 for.
 */
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  flag?: string;
};
/**
 * A primary customer destination. `children` are the section's second-level
 * pages, shown inline (accordion-style) only while that section is active. Many
 * of these sub-pages live at non-co-located routes (e.g. /os/analytics,
 * /os/library) that no route-subtree layout can wrap, so the shell itself owns
 * their contextual navigation.
 */
type NavSection = NavItem & { children?: NavItem[] };

// Phase 4 nav restructuring: the sidebar used to be a flat registry of every
// module (~10 groups / ~40 items). It now exposes 6 primary destinations plus
// an account group; the individual sub-pages that used to be top-level items
// (Analytics, Reports, Automation, Library, Personas, Studio, the service
// verticals, financial products, etc.) are reachable via SectionTabs / hub
// pages nested under these primaries. See apps/web/app/os/campaigns/page.tsx,
// wallet/page.tsx, marketplace/page.tsx, rewards/page.tsx and services/page.tsx.
const PRIMARY_NAV: NavSection[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard },
  {
    label: "Growth",
    href: "/os/campaigns",
    icon: Megaphone,
    children: [
      { label: "Campaign Builder", href: "/os/campaigns/new", icon: Wand2 },
      { label: "Campaign Manager", href: "/os/campaigns", icon: Megaphone },
      { label: "AI Studio", href: "/os/studio", icon: Sparkles },
      { label: "Analytics", href: "/os/analytics", icon: BarChart3 },
      { label: "Reports", href: "/os/reports", icon: FileText },
      { label: "Automation", href: "/os/automation", icon: Workflow, flag: "workflowAutomation" },
      { label: "Creative Library", href: "/os/library", icon: Folder },
      { label: "AI Personas", href: "/os/personas", icon: Bot },
      { label: "Growth Services", href: "/os/growth", icon: Zap },
      // Server-side @RequirePermissions is the real guard; the permission field
      // just keeps the link out of the sidebar for users who'd get a 403.
      { label: "Approvals", href: "/os/approvals", icon: ClipboardCheck, permission: "campaign:approve" },
      { label: "Trust Engine", href: "/os/trust-engine", icon: ShieldCheck, permission: "analytics:read", flag: "trustEngine" },
    ],
  },
  {
    label: "Money",
    href: "/os/money",
    icon: Banknote,
    children: [
      { label: "Overview", href: "/os/money", icon: Banknote },
      { label: "Wallet", href: "/os/wallet", icon: CreditCard },
      { label: "Invoices", href: "/os/money/invoices", icon: FileText, flag: "invoicing" },
      { label: "Payment Links", href: "/os/money/payment-links", icon: Link2, flag: "paymentLinks" },
      { label: "Virtual Accounts", href: "/os/financial-products/accounts", icon: Building2, flag: "virtualAccounts" },
      { label: "Virtual Cards", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards" },
      { label: "Transfers", href: "/os/financial-products/remittance", icon: Send, flag: "remittance" },
    ],
  },
  {
    label: "Services",
    href: "/os/services",
    icon: Store,
    children: [
      { label: "Airtime", href: "/os/airtime/airtime", icon: Phone, flag: "vtu" },
      { label: "Data", href: "/os/airtime/data", icon: Wifi, flag: "vtu" },
      { label: "Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell" },
      { label: "International Top-Up", href: "/os/telecom", icon: Globe2, flag: "telecomGateway" },
      { label: "International Numbers", href: "/os/numbers", icon: Globe, flag: "virtualNumbers" },
      { label: "My Numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers" },
      { label: "Electricity", href: "/os/utilities/electricity", icon: Lightbulb, flag: "billsElectricity" },
      { label: "Cable TV", href: "/os/utilities/cable", icon: Tv, flag: "billsCable" },
      { label: "Education", href: "/os/utilities/education", icon: GraduationCap, flag: "billsEducation" },
      { label: "Bet Funding", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting" },
      { label: "Sell Crypto", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell" },
      { label: "Buy RMB", href: "/os/rmb", icon: Banknote, flag: "rmbBuy" },
      { label: "Digital Access", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess" },
    ],
  },
  {
    label: "Marketplace",
    href: "/os/marketplace",
    icon: Building2,
    children: [
      { label: "Discover", href: "/os/marketplace", icon: Store },
      { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase },
      { label: "Creators", href: "/os/marketplace/creators", icon: Globe },
    ],
  },
  {
    label: "Rewards",
    href: "/os/rewards",
    icon: Trophy,
    // No section-level flag: Vouchers is always available, so the section renders
    // whenever any child is visible. The reward-specific children keep their own
    // "rewards" flag, so they hide together when the vertical is off.
    children: [
      { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy, flag: "rewards" },
      { label: "My Progress", href: "/os/rewards/progress", icon: Gift, flag: "rewards" },
      { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode, flag: "rewards" },
      { label: "Vouchers", href: "/os/vouchers", icon: Ticket },
    ],
  },
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Team", href: "/os/team", icon: Users },
  { label: "Transactions", href: "/os/wallet", icon: FileText },
  { label: "Notifications", href: "/os/notifications", icon: Bell },
  { label: "Support", href: "/os/support", icon: LifeBuoy, flag: "support" },
  { label: "Profile", href: "/os/profile", icon: UserCircle },
  { label: "Settings", href: "/os/settings", icon: Settings },
];

// Flat lookup of every navigable item, used for the header title.
const ALL_NAV_ITEMS: NavItem[] = [
  ...PRIMARY_NAV.flatMap((section) => [section, ...(section.children ?? [])]),
  ...ACCOUNT_NAV,
];

const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard },
  { label: "Growth", href: "/os/campaigns", icon: Megaphone },
  { label: "Money", href: "/os/money", icon: Banknote },
  { label: "Services", href: "/os/services", icon: Store },
  { label: "More", href: "/os/search", icon: Menu },
];

export function OsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, signOut } = useApiSession();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace("/login");
    }
  }, [loading, session]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandQuery("");
        setCommandOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (loading || !session) {
    return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
  }

  function isActive(href: string) {
    if (href === "/os") return pathname === "/os";
    return pathname.startsWith(href);
  }

  const currentSession = session;

  function canSeeNavItem(item: NavItem) {
    // Hidden until the flag set has loaded and says yes. Rendering the link
    // optimistically and pulling it back would be worse than a brief absence.
    if (item.flag && !(flagsReady && flags[item.flag] === true)) {
      return false;
    }
    if (!item.permission) return true;
    return (
      currentSession.isPlatformAdmin ||
      Boolean(currentSession.permissions?.includes(item.permission))
    );
  }

  const visiblePrimary = PRIMARY_NAV.filter(canSeeNavItem).map((section) => ({
    ...section,
    children: (section.children ?? []).filter(canSeeNavItem)
  }));
  const visibleAccount = ACCOUNT_NAV.filter(canSeeNavItem);

  // A section is expanded when it — or any of its children — is the active route.
  function sectionIsActive(section: { href: string; children?: NavItem[] }) {
    if (isActive(section.href)) return true;
    return (section.children ?? []).some((child) => isActive(child.href));
  }

  // Command palette: search across every destination the user can actually reach
  // (flag- and permission-filtered), so results never link to a 403/503 vertical.
  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const reachable = ALL_NAV_ITEMS.filter(canSeeNavItem);
    // De-duplicate by href (Money/Overview and a few labels share routes).
    const seen = new Set<string>();
    const unique = reachable.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
    if (!query) return unique;
    return unique.filter((item) => item.label.toLowerCase().includes(query));
    // canSeeNavItem closes over flags/session; recompute when the query or flag
    // readiness changes.
  }, [commandQuery, flagsReady, flags, session]);

  function runCommand(href: string) {
    setCommandOpen(false);
    setCommandQuery("");
    router.push(href);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.replace("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--ft-border)] px-5">
          <img alt="FlipTrybe" className="size-8" src="/brand/icon-mark.svg" />
          <div>
            <div className="text-sm font-bold">FlipTrybe</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">
              Growth OS
            </div>
          </div>
        </div>

        {/* Quick search */}
        <button
          className="mx-3 mt-3 flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)] transition hover:border-[var(--ft-accent)]/40"
          onClick={() => setCommandOpen(true)}
          type="button"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-4">
            {visiblePrimary.map((section) => {
              const expanded = sectionIsActive(section);
              return (
                <div key={section.href}>
                  <a
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition",
                      expanded
                        ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                        : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                    )}
                    href={section.href}
                  >
                    <section.icon className="size-4 shrink-0" />
                    {section.label}
                  </a>
                  {expanded && section.children.length > 0 && (
                    <div className="my-1 ml-[22px] flex flex-col gap-0.5 border-l border-[var(--ft-border)] pl-2">
                      {section.children.map((child) => (
                        <a
                          className={cn(
                            "flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-3 text-[12.5px] transition",
                            isActive(child.href)
                              ? "font-medium text-[var(--ft-accent)]"
                              : "text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
                          )}
                          href={child.href}
                          key={child.href}
                        >
                          <child.icon className="size-3.5 shrink-0" />
                          {child.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visibleAccount.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                Account
              </p>
              {visibleAccount.map((item) => (
                <a
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition",
                    isActive(item.href)
                      ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                      : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-[var(--ft-border)] p-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-xs font-bold text-[var(--ft-accent)]">
              {session.user.name?.[0] ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{session.user.name}</div>
              <div className="truncate text-[11px] text-[var(--ft-text-muted)]">@{session.user.username}</div>
            </div>
            <ThemeToggle />
          </div>
          <button
            className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)]/40 hover:text-[var(--ft-text-primary)] disabled:opacity-60"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut className="size-4" />
            {signingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-bold">FlipTrybe</span>
              <button onClick={() => setSidebarOpen(false)} type="button"><X className="size-5" /></button>
            </div>
            <div className="mb-4">
              {visiblePrimary.map((section) => {
                const expanded = sectionIsActive(section);
                return (
                  <div key={section.href}>
                    <a
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
                        expanded ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)]"
                      )}
                      href={section.href}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <section.icon className="size-4" />
                      {section.label}
                    </a>
                    {expanded && section.children.length > 0 && (
                      <div className="my-1 ml-6 flex flex-col gap-0.5 border-l border-[var(--ft-border)] pl-2">
                        {section.children.map((child) => (
                          <a
                            className={cn(
                              "flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-[13px] transition",
                              isActive(child.href) ? "font-medium text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)]"
                            )}
                            href={child.href}
                            key={child.href}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <child.icon className="size-4" />
                            {child.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {visibleAccount.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Account</p>
                {visibleAccount.map((item) => (
                  <a
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
                      isActive(item.href) ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-secondary)]"
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </a>
                ))}
              </div>
            )}
            <div className="border-t border-[var(--ft-border)] px-3 pt-3">
              <button
                className="flex h-10 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)] disabled:opacity-60"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                type="button"
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/90 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)} type="button">
              <Menu className="size-5 text-[var(--ft-text-muted)]" />
            </button>
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
              {ALL_NAV_ITEMS.filter((i) => isActive(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "FlipTrybe"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="hidden h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs text-[var(--ft-text-muted)] sm:flex"
              onClick={() => setCommandOpen(true)}
              type="button"
            >
              <Search className="size-3" />
              Search
              <kbd className="rounded border border-[var(--ft-border)] px-1 font-mono text-[9px]">⌘K</kbd>
            </button>
            <a
              className={cn(
                "grid size-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-[var(--ft-bg-muted)]",
                pathname.startsWith("/os/notifications") ? "text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]"
              )}
              href="/os/notifications"
            >
              <Bell className="size-4" />
            </a>
            <ThemeToggle className="hidden lg:inline-flex" />
            <button
              className="hidden h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)]/40 hover:text-[var(--ft-text-primary)] disabled:opacity-60 sm:flex"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOut className="size-3.5" />
              {signingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom bar */}
        <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE_NAV.map((item) => (
            <a
              className={cn(
                "grid place-items-center gap-0.5 py-1",
                isActive(item.href) ? "text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]"
              )}
              href={item.href}
              key={item.href}
              onClick={item.label === "More" ? (e) => { e.preventDefault(); setSidebarOpen(true); } : undefined}
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* Floating AI Assistant */}
      <div className="fixed bottom-20 right-4 z-[65] lg:bottom-6">
        <AnimatePresence>
          {assistantOpen && (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-3 flex w-[360px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-xl)]"
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{ maxHeight: "min(480px, 60vh)" }}
            >
              <div className="flex items-center justify-between border-b border-[var(--ft-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                    <Bot className="size-4 text-[var(--ft-accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Quick Navigator</div>
                    <div className="text-[10px] text-[var(--ft-text-muted)]">Jump to any tool</div>
                  </div>
                </div>
                <button onClick={() => setAssistantOpen(false)} type="button">
                  <X className="size-4 text-[var(--ft-text-muted)]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex gap-2">
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                    <Bot className="size-3.5 text-[var(--ft-accent)]" />
                  </div>
                  <div className="rounded-[var(--radius-lg)] rounded-tl-sm bg-[var(--ft-bg-surface)] p-3 text-xs text-[var(--ft-text-secondary)]">
                    Jump straight to what you need. Conversational AI is on the way — for now, pick a shortcut below.
                  </div>
                </div>

                <div className="mt-3 grid gap-1.5">
                  {[
                    { label: "View campaign performance", href: "/os/analytics" },
                    { label: "Open AI Studio", href: "/os/studio" },
                    { label: "Check my wallet", href: "/os/wallet" },
                    { label: "Generate a report", href: "/os/reports" },
                  ].map((shortcut) => (
                    <button
                      className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-1.5 text-left text-xs text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)]/30"
                      key={shortcut.href}
                      onClick={() => {
                        setAssistantOpen(false);
                        runCommand(shortcut.href);
                      }}
                      type="button"
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--ft-border)] p-3">
                <button
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-xs font-medium text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)]"
                  onClick={() => {
                    setAssistantOpen(false);
                    setCommandQuery("");
                    setCommandOpen(true);
                  }}
                  type="button"
                >
                  <Search className="size-3.5" /> Search all pages
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className={cn(
            "grid size-14 place-items-center rounded-full shadow-lg transition",
            assistantOpen
              ? "bg-[var(--ft-bg-raised)] border border-[var(--ft-border)]"
              : "bg-[var(--ft-accent)] text-[var(--ft-text-inverse)] hover:scale-105"
          )}
          onClick={() => setAssistantOpen((prev) => !prev)}
          type="button"
        >
          {assistantOpen ? <X className="size-5 text-[var(--ft-text-primary)]" /> : <MessageSquare className="size-5" />}
        </button>
      </div>

      {/* Command palette */}
      {commandOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCommandOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-xl)]">
            <form
              className="flex items-center gap-3 border-b border-[var(--ft-border)] px-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (commandResults[0]) runCommand(commandResults[0].href);
              }}
            >
              <Search className="size-4 text-[var(--ft-text-muted)]" />
              <input
                autoFocus
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ft-text-muted)]"
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search for a page — campaigns, invoices, wallet, services..."
                value={commandQuery}
              />
              <kbd className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ft-text-muted)]">ESC</kbd>
            </form>
            <div className="max-h-[360px] overflow-y-auto p-2">
              <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                {commandQuery.trim() ? "Results" : "Go to"}
              </p>
              {commandResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[var(--ft-text-muted)]">No matching pages.</p>
              ) : (
                commandResults.map((item) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition hover:bg-[var(--ft-bg-muted)]"
                    key={item.href}
                    onClick={() => runCommand(item.href)}
                    type="button"
                  >
                    <item.icon className="size-4 text-[var(--ft-accent)]" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="truncate text-xs text-[var(--ft-text-muted)]">{item.href}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
