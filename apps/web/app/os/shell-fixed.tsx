"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  BarChart3,
  Bell,
  Bitcoin,
  Bot,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
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
  Zap
} from "lucide-react";

import { ThemeToggle, cn } from "@fliptrybe/ui";
import { useFeatureFlags } from "../lib/feature-flags";
import { useApiSession } from "../lib/use-session";

/**
 * next.config sets `typedRoutes: true`, so Link's href is a generated union of
 * real routes rather than `string`. Nav hrefs are authored as plain strings in
 * the tables below, so they need a cast at the call site. Deriving the type
 * from Link itself (rather than importing Next's `Route`) keeps this correct
 * even if Next re-shapes that export.
 */
type LinkHref = ComponentProps<typeof Link>["href"];

const asHref = (href: string) => href as LinkHref;

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  flag?: string;
  /** Extra search terms so the palette finds a page by what users call it. */
  keywords?: string;
};

type NavSection = NavItem & { children?: NavItem[] };

const PRIMARY_NAV: NavSection[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard, children: [] },
  {
    label: "Growth",
    href: "/os/campaigns",
    icon: Megaphone,
    children: [
      { label: "Campaign Builder", href: "/os/campaigns/new", icon: Wand2, keywords: "create new brief" },
      { label: "Campaign Manager", href: "/os/campaigns", icon: Megaphone, keywords: "list all campaigns" },
      { label: "AI Studio", href: "/os/studio", icon: Sparkles, keywords: "creative generate copy" },
      { label: "Analytics", href: "/os/analytics", icon: BarChart3, keywords: "impressions clicks performance" },
      { label: "Reports", href: "/os/reports", icon: FileText, keywords: "results summary export" },
      { label: "Automation", href: "/os/automation", icon: Workflow, flag: "workflowAutomation" },
      { label: "Creative Library", href: "/os/library", icon: FileText, keywords: "assets images video" },
      { label: "AI Personas", href: "/os/personas", icon: Bot, keywords: "audience targeting" },
      { label: "Growth Services", href: "/os/growth", icon: Zap, keywords: "agency order" },
      { label: "Approvals", href: "/os/approvals", icon: ClipboardCheck, permission: "campaign:approve" },
      {
        label: "Trust Engine",
        href: "/os/trust-engine",
        icon: ShieldCheck,
        permission: "analytics:read",
        flag: "trustEngine"
      }
    ]
  },
  {
    label: "Money",
    href: "/os/money",
    icon: Banknote,
    children: [
      { label: "Overview", href: "/os/money", icon: Banknote, keywords: "finance" },
      { label: "Wallet", href: "/os/wallet", icon: CreditCard, keywords: "balance fund top up" },
      { label: "Invoices", href: "/os/money/invoices", icon: FileText, flag: "invoicing", keywords: "bill due" },
      {
        label: "Payment Links",
        href: "/os/money/payment-links",
        icon: Link2,
        flag: "paymentLinks",
        keywords: "collect checkout"
      },
      {
        label: "Virtual Accounts",
        href: "/os/financial-products/accounts",
        icon: Building2,
        flag: "virtualAccounts",
        keywords: "bank account number"
      },
      {
        label: "Virtual Cards",
        href: "/os/financial-products/cards",
        icon: CreditCard,
        flag: "virtualCards",
        keywords: "debit card"
      },
      {
        label: "Transfers",
        href: "/os/financial-products/remittance",
        icon: Send,
        flag: "remittance",
        keywords: "send money remit usa uk europe canada nigeria"
      },
      {
        label: "USDT & USDC",
        href: "/os/crypto",
        icon: Bitcoin,
        flag: "cryptoSell",
        keywords: "crypto stablecoin buy sell digital dollars"
      },
      {
        label: "RMB / China Payments",
        href: "/os/rmb",
        icon: Banknote,
        flag: "rmbBuy",
        keywords: "china yuan alipay wechat supplier payment"
      }
    ]
  },
  {
    label: "Services",
    href: "/os/services",
    icon: Store,
    children: [
      { label: "Airtime", href: "/os/airtime/airtime", icon: Phone, flag: "vtu", keywords: "recharge credit" },
      { label: "Data", href: "/os/airtime/data", icon: Wifi, flag: "vtu", keywords: "internet bundle" },
      { label: "Buy Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher purchase buy" },
      { label: "Sell Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher cash sell trade" },
      { label: "International Top-Up", href: "/os/telecom", icon: Globe, flag: "telecomGateway" },
      { label: "International Numbers", href: "/os/numbers", icon: Globe, flag: "virtualNumbers", keywords: "phone line" },
      { label: "My Numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers" },
      {
        label: "Electricity",
        href: "/os/utilities/electricity",
        icon: Lightbulb,
        flag: "billsElectricity",
        keywords: "power bill units"
      },
      { label: "Cable TV", href: "/os/utilities/cable", icon: Tv, flag: "billsCable", keywords: "subscription" },
      {
        label: "Education",
        href: "/os/utilities/education",
        icon: GraduationCap,
        flag: "billsEducation",
        keywords: "school pin"
      },
      { label: "Bet Funding", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting" },
      { label: "Sell Crypto", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell", keywords: "cash out" },
      { label: "Buy RMB", href: "/os/rmb", icon: Banknote, flag: "rmbBuy", keywords: "yuan fx" },
      { label: "Digital Access", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess" }
    ]
  },
  {
    label: "Marketplace",
    href: "/os/marketplace",
    icon: Building2,
    children: [
      { label: "Discover", href: "/os/marketplace", icon: Store, keywords: "browse find" },
      { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase, keywords: "partner hire" },
      { label: "Creators", href: "/os/marketplace/creators", icon: Globe, keywords: "influencer talent" },
      { label: "Applications", href: "/os/marketplace/applications", icon: ClipboardList }
    ]
  },
  {
    label: "Rewards",
    href: "/os/rewards",
    icon: Trophy,
    children: [
      { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy, flag: "rewards" },
      { label: "My Progress", href: "/os/rewards/progress", icon: Gift, flag: "rewards", keywords: "points earned" },
      { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode, flag: "rewards" },
      { label: "Vouchers", href: "/os/vouchers", icon: Ticket, keywords: "code redeem" }
    ]
  }
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Team", href: "/os/team", icon: Users, keywords: "members invite" },
  { label: "My Orders", href: "/os/orders", icon: PackageSearch, keywords: "purchase history" },
  { label: "Transactions", href: "/os/wallet", icon: FileText, keywords: "statement ledger" },
  { label: "Notifications", href: "/os/notifications", icon: Bell, keywords: "alerts updates" },
  { label: "Support", href: "/os/support", icon: LifeBuoy, flag: "support", keywords: "help contact" },
  { label: "Profile", href: "/os/profile", icon: UserCircle, keywords: "account" },
  { label: "Settings", href: "/os/settings", icon: Settings, keywords: "preferences security" }
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !session) window.location.replace("/login");
  }, [loading, session]);

  const openCommand = useCallback(() => {
    setCommandQuery("");
    setHighlighted(0);
    setCommandOpen(true);
  }, []);

  useEffect(() => {
    function handleKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandQuery("");
        setHighlighted(0);
        setCommandOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Keep the highlighted row in view while arrow-keying through results.
  useEffect(() => {
    const node = resultsRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const canSee = useCallback(
    (item: NavItem) => {
      if (item.flag && !(flagsReady && flags[item.flag] === true)) return false;
      if (!item.permission) return true;
      if (!session) return false;
      return session.isPlatformAdmin || Boolean(session.permissions?.includes(item.permission));
    },
    [flags, flagsReady, session]
  );

  const visiblePrimary = useMemo(
    () =>
      PRIMARY_NAV.filter(canSee).map((section) => ({
        ...section,
        children: (section.children ?? []).filter(canSee)
      })),
    [canSee]
  );

  const visibleAccount = useMemo(() => ACCOUNT_NAV.filter(canSee), [canSee]);

  /**
   * Every destination this user can actually reach, de-duplicated by href and
   * filtered by flag + permission, so a search result never lands on a 403/503.
   */
  const commandResults = useMemo(() => {
    const seen = new Set<string>();
    const reachable = [
      ...visiblePrimary.flatMap((section) => [section, ...(section.children ?? [])]),
      ...visibleAccount
    ].filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });

    const query = commandQuery.trim().toLowerCase();
    if (!query) return reachable;

    return reachable.filter((item) =>
      `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(query)
    );
  }, [commandQuery, visiblePrimary, visibleAccount]);

  if (loading || !session) return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;

  const isActive = (href: string) =>
    href === "/os" ? pathname === "/os" : pathname.startsWith(href);

  const title =
    [...visiblePrimary.flatMap((section) => [section, ...(section.children ?? [])]), ...visibleAccount]
      .filter((item) => isActive(item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "FlipTrybe";

  function runCommand(href: string) {
    setCommandOpen(false);
    setCommandQuery("");
    router.push(asHref(href) as Parameters<typeof router.push>[0]);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.replace("/login");
  }

  function handleCommandKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (commandResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => (prev + 1) % commandResults.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => (prev - 1 + commandResults.length) % commandResults.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = commandResults[highlighted] ?? commandResults[0];
      if (target) runCommand(target.href);
    }
  }

  const searchTriggerClass =
    "flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)] transition hover:border-[var(--ft-accent)]/40 hover:text-[var(--ft-text-secondary)]";

  const renderSection = (section: NavSection, mobile = false) => {
    const active = isActive(section.href);

    return (
      <div key={section.href}>
        <Link
          className={cn(
            "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-sm font-medium transition",
            mobile ? "h-10" : "h-9 text-label",
            active
              ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
              : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
          )}
          href={asHref(section.href)}
          {...(mobile ? { onClick: () => setSidebarOpen(false) } : {})}
        >
          <section.icon className="size-4" />
          {section.label}
        </Link>
        {active && (section.children?.length ?? 0) > 0 && (
          <div
            className={cn(
              "my-1 flex flex-col gap-0.5 border-l border-[var(--ft-border)] pl-2",
              mobile ? "ml-6" : "ml-[22px]"
            )}
          >
            {(section.children ?? []).map((child) => (
              <Link
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-md)] px-3 text-label transition",
                  mobile ? "h-9" : "h-8",
                  isActive(child.href)
                    ? "font-medium text-[var(--ft-accent)]"
                    : "text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
                )}
                href={asHref(child.href)}
                key={child.href}
                {...(mobile ? { onClick: () => setSidebarOpen(false) } : {})}
              >
                <child.icon className="size-3.5" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-sm font-bold">FlipTrybe</span>
              <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} type="button">
                <X className="size-5" />
              </button>
            </div>
            <button
              className={cn(searchTriggerClass, "mb-3 w-full")}
              onClick={() => {
                setSidebarOpen(false);
                openCommand();
              }}
              type="button"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search pages</span>
            </button>
            {visiblePrimary.map((section) => renderSection(section, true))}
            <div className="mt-4 border-t border-[var(--ft-border)] pt-3">
              {visibleAccount.map((item) => (
                <Link
                  className="flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--ft-text-secondary)]"
                  href={asHref(item.href)}
                  key={item.href}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
              <button
                className="mt-2 flex h-10 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm text-[var(--ft-text-secondary)]"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                type="button"
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out" : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--ft-border)] px-5">
          <img alt="" className="size-8" src="/brand/icon-mark.svg" />
          <div>
            <div className="text-sm font-bold">FlipTrybe</div>
            <div className="font-mono text-micro uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">
              Growth OS
            </div>
          </div>
        </div>

        <button className={cn(searchTriggerClass, "mx-3 mt-3")} onClick={openCommand} type="button">
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-1.5 py-0.5 font-mono text-micro">
            ⌘K
          </kbd>
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {visiblePrimary.map((section) => renderSection(section))}
          <div className="mt-4 border-t border-[var(--ft-border)] pt-3">
            {visibleAccount.map((item) => (
              <Link
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-label font-medium transition",
                  isActive(item.href)
                    ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                    : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
                )}
                href={asHref(item.href)}
                key={item.href}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-[var(--ft-border)] p-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-xs font-bold text-[var(--ft-accent)]">
              {session.user.name?.[0] ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{session.user.name}</div>
              <div className="truncate text-xs text-[var(--ft-text-muted)]">
                @{session.user.username}
              </div>
            </div>
            <ThemeToggle />
          </div>
          <button
            className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)]"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <LogOut className="size-3.5" />
            {signingOut ? "Signing out" : "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/90 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu className="size-5 text-[var(--ft-text-muted)]" />
            </button>
            <div className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="Search pages"
              className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-[var(--ft-text-muted)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)] lg:hidden"
              onClick={openCommand}
              type="button"
            >
              <Search className="size-4" />
            </button>
            <Link
              aria-label="Notifications"
              className={cn(
                "grid size-9 place-items-center rounded-[var(--radius-sm)] transition hover:bg-[var(--ft-bg-muted)]",
                pathname.startsWith("/os/notifications")
                  ? "text-[var(--ft-accent)]"
                  : "text-[var(--ft-text-muted)]"
              )}
              href={asHref("/os/notifications")}
            >
              <Bell className="size-4" />
            </Link>
            <ThemeToggle className="hidden lg:inline-flex" />
            <button
              className="hidden h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-xs font-medium text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)] sm:flex"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <LogOut className="size-3.5" />
              {signingOut ? "Signing out" : "Logout"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE_NAV.map((item) =>
            item.label === "More" ? (
              <button
                className="grid place-items-center gap-0.5 py-1 text-[var(--ft-text-muted)]"
                key={item.href}
                onClick={() => setSidebarOpen(true)}
                type="button"
              >
                <item.icon className="size-5" />
                <span className="text-micro font-medium">{item.label}</span>
              </button>
            ) : (
              <Link
                className={cn(
                  "grid place-items-center gap-0.5 py-1",
                  isActive(item.href) ? "text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]"
                )}
                href={asHref(item.href)}
                key={item.href}
              >
                <item.icon className="size-5" />
                <span className="text-micro font-medium">{item.label}</span>
              </Link>
            )
          )}
        </nav>
      </div>

      {commandOpen && (
        <div
          aria-label="Search pages"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
          role="dialog"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setCommandOpen(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-xl)]">
            <div className="flex items-center gap-3 border-b border-[var(--ft-border)] px-4">
              <Search className="size-4 shrink-0 text-[var(--ft-text-muted)]" />
              <input
                aria-label="Search pages"
                autoFocus
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ft-text-muted)]"
                onChange={(event) => {
                  setCommandQuery(event.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={handleCommandKeyDown}
                placeholder="Search campaigns, wallet, airtime, invoices"
                value={commandQuery}
              />
              <kbd className="hidden rounded border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-1.5 py-0.5 font-mono text-micro text-[var(--ft-text-muted)] sm:block">
                ESC
              </kbd>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2" ref={resultsRef}>
              <p className="px-3 py-2 font-mono text-micro uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                {commandQuery.trim() ? "Results" : "Go to"}
              </p>
              {commandResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[var(--ft-text-muted)]">
                  No matching pages.
                </p>
              ) : (
                commandResults.map((item, index) => (
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition",
                      index === highlighted
                        ? "bg-[var(--ft-bg-muted)]"
                        : "hover:bg-[var(--ft-bg-muted)]"
                    )}
                    data-index={index}
                    key={item.href}
                    onClick={() => runCommand(item.href)}
                    onMouseEnter={() => setHighlighted(index)}
                    type="button"
                  >
                    <item.icon className="size-4 shrink-0 text-[var(--ft-accent)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-[var(--ft-text-muted)]">
                        {item.href}
                      </span>
                    </span>
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
