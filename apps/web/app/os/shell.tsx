"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  GraduationCap,
  Globe,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
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
import { useApiSession } from "../lib/use-session";

type NavItem = { label: string; href: string; icon: LucideIcon; permission?: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "/os", icon: LayoutDashboard },
      { label: "AI Studio", href: "/os/studio", icon: Sparkles },
      { label: "Search", href: "/os/search", icon: Search },
    ],
  },
  {
    title: "Governance",
    items: [
      // Server-side enforcement (RequirePermissions("admin:access", "campaign:approve")
      // on ApprovalsController) is what actually protects /os/approvals — this
      // permission check just keeps the link out of the sidebar for users who'd get
      // a 403 anyway.
      { label: "Approvals", href: "/os/approvals", icon: ClipboardCheck, permission: "campaign:approve" },
      // Mirrors TrustEngineController's @RequirePermissions("analytics:read") gate —
      // server-side enforcement is what actually protects /os/trust-engine.
      { label: "Trust Engine", href: "/os/trust-engine", icon: ShieldCheck, permission: "analytics:read" },
    ],
  },
  {
    title: "Campaigns",
    items: [
      { label: "Campaign Builder", href: "/os/campaigns/new", icon: Wand2 },
      { label: "Campaign Manager", href: "/os/campaigns", icon: Megaphone },
      { label: "Analytics", href: "/os/analytics", icon: BarChart3 },
      { label: "Reports", href: "/os/reports", icon: FileText },
      { label: "Automation", href: "/os/automation", icon: Workflow },
    ],
  },
  {
    title: "Creative",
    items: [
      { label: "Creative Library", href: "/os/library", icon: Folder },
      { label: "AI Personas", href: "/os/personas", icon: Bot },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Growth Services", href: "/os/growth", icon: Zap },
      { label: "Digital Access", href: "/os/digital-access", icon: KeyRound },
      { label: "Marketplace", href: "/os/marketplace", icon: Store },
      { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase },
      { label: "Creators", href: "/os/marketplace/creators", icon: Globe },
    ],
  },
  {
    title: "Digital Products",
    items: [
      { label: "International Numbers", href: "/os/numbers", icon: Globe },
      { label: "My Numbers", href: "/os/numbers/mine", icon: Smartphone },
      { label: "Gift Cards", href: "/os/digital-value", icon: Gift },
      { label: "Airtime", href: "/os/airtime", icon: Phone },
      { label: "Data", href: "/os/data", icon: Wifi },
      { label: "International Top-Up", href: "/os/telecom", icon: Globe2 },
      { label: "Electricity", href: "/os/utilities", icon: Lightbulb },
      { label: "Cable TV", href: "/os/utilities?tab=cable", icon: Tv },
      { label: "Bet Funding", href: "/os/utilities?tab=betting", icon: Trophy },
      { label: "Education", href: "/os/utilities?tab=education", icon: GraduationCap },
      { label: "Sell Crypto", href: "/os/crypto", icon: Bitcoin },
      { label: "Buy RMB", href: "/os/rmb", icon: Banknote },
    ],
  },
  {
    title: "Financial Products",
    items: [
      { label: "Virtual Accounts", href: "/os/financial-products", icon: Building2 },
      { label: "Virtual Cards", href: "/os/financial-products?tab=cards", icon: CreditCard },
      { label: "Remittance", href: "/os/financial-products?tab=remittance", icon: Send },
    ],
  },
  {
    title: "Rewards",
    items: [
      { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy },
      { label: "My Progress", href: "/os/rewards/progress", icon: Gift },
      { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Wallet", href: "/os/wallet", icon: CreditCard },
      { label: "Vouchers", href: "/os/vouchers", icon: Ticket },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Team", href: "/os/team", icon: Users },
      { label: "Notifications", href: "/os/notifications", icon: Bell },
      { label: "Support", href: "/os/support", icon: LifeBuoy },
      { label: "Profile", href: "/os/profile", icon: UserCircle },
      { label: "Settings", href: "/os/settings", icon: Settings },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard },
  { label: "Studio", href: "/os/studio", icon: Sparkles },
  { label: "Campaigns", href: "/os/campaigns", icon: Megaphone },
  { label: "Wallet", href: "/os/wallet", icon: CreditCard },
  { label: "More", href: "/os/search", icon: Menu },
];

export function OsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, session, signOut } = useApiSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMsg, setAssistantMsg] = useState("");
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
        setCommandOpen((prev) => !prev);
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
    if (!item.permission) return true;
    return (
      currentSession.isPlatformAdmin ||
      Boolean(currentSession.permissions?.includes(item.permission))
    );
  }

  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(canSeeNavItem)
  })).filter((group) => group.items.length > 0);

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
          {visibleNavGroups.map((group) => (
            <div className="mb-4" key={group.title}>
              <p className="mb-1 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                {group.title}
              </p>
              {group.items.map((item) => (
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
          ))}
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
            {visibleNavGroups.map((group) => (
              <div className="mb-4" key={group.title}>
                <p className="mb-1 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">{group.title}</p>
                {group.items.map((item) => (
                  <a
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
                      isActive(item.href)
                        ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                        : "text-[var(--ft-text-secondary)]"
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
            ))}
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
              {NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i.href))?.label ?? "FlipTrybe"}
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
                    <div className="text-sm font-semibold">AI Assistant</div>
                    <div className="text-[10px] text-[var(--ft-green)]">Online</div>
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
                    Hi! I&apos;m your AI growth assistant. Ask me anything about your campaigns, analytics, creatives, or growth strategy.
                  </div>
                </div>

                <div className="mt-3 grid gap-1.5">
                  {[
                    "How are my campaigns performing?",
                    "Suggest a new ad strategy",
                    "Optimize my budget allocation",
                    "Generate a performance report",
                  ].map((suggestion) => (
                    <button
                      className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-1.5 text-left text-xs text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)]/30"
                      key={suggestion}
                      onClick={() => setAssistantMsg(suggestion)}
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--ft-border)] p-3">
                <div className="flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) => setAssistantMsg(e.target.value)}
                    placeholder="Ask anything..."
                    value={assistantMsg}
                  />
                  <button
                    className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)] text-[var(--ft-text-inverse)] transition hover:opacity-90 disabled:opacity-40"
                    disabled={!assistantMsg.trim()}
                    type="button"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
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
            <div className="flex items-center gap-3 border-b border-[var(--ft-border)] px-4">
              <Search className="size-4 text-[var(--ft-text-muted)]" />
              <input
                autoFocus
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ft-text-muted)]"
                placeholder="Search campaigns, assets, people, or type a command..."
              />
              <kbd className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ft-text-muted)]">ESC</kbd>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              <p className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Quick actions</p>
              {[
                { icon: Wand2, label: "Create Campaign", desc: "AI-guided campaign builder" },
                { icon: Sparkles, label: "Generate Creative", desc: "Open AI Studio" },
                { icon: CreditCard, label: "Recharge Wallet", desc: "Add funds" },
                { icon: BarChart3, label: "View Analytics", desc: "Campaign performance" },
                { icon: Bot, label: "Ask AI Assistant", desc: "Get help with anything" },
              ].map((action) => (
                <button
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition hover:bg-[var(--ft-bg-muted)]"
                  key={action.label}
                  onClick={() => setCommandOpen(false)}
                  type="button"
                >
                  <action.icon className="size-4 text-[var(--ft-accent)]" />
                  <div>
                    <div className="text-sm font-medium">{action.label}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">{action.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
