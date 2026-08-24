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
  Banknote, BarChart3, Bell, Bitcoin, Bot, Briefcase, Building2, ClipboardCheck, ClipboardList,
  CreditCard, FileText, Gift, Globe, GraduationCap, KeyRound, LayoutDashboard, LifeBuoy,
  Lightbulb, Link2, LogOut, Megaphone, Menu, PackageSearch, Phone, QrCode, Search, Send,
  Settings, ShieldCheck, Smartphone, Sparkles, Store, Ticket, Trophy, Tv, UserCircle, Users,
  Wand2, Wifi, Workflow, X, Zap
} from "lucide-react";

import { ThemeToggle, cn } from "@fliptrybe/ui";
import { useFeatureFlags } from "../lib/feature-flags";
import { useApiSession } from "../lib/use-session";

type LinkHref = ComponentProps<typeof Link>["href"];
const asHref = (href: string) => href as LinkHref;

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; permission?: string; flag?: string; keywords?: string };
type NavSection = NavItem & { children?: NavItem[] };

const PRIMARY_NAV: NavSection[] = [
  { label: "Home", href: "/os", icon: LayoutDashboard, children: [] },
  { label: "Growth", href: "/os/campaigns", icon: Megaphone, children: [
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
    { label: "Trust Engine", href: "/os/trust-engine", icon: ShieldCheck, permission: "analytics:read", flag: "trustEngine" }
  ]},
  { label: "Money", href: "/os/money", icon: Banknote, children: [
    { label: "Overview", href: "/os/money", icon: Banknote, keywords: "finance" },
    { label: "Wallet", href: "/os/wallet", icon: CreditCard, keywords: "balance fund top up" },
    { label: "Invoices", href: "/os/money/invoices", icon: FileText, flag: "invoicing", keywords: "bill due" },
    { label: "Payment Links", href: "/os/money/payment-links", icon: Link2, flag: "paymentLinks", keywords: "collect checkout" },
    { label: "Virtual Accounts", href: "/os/financial-products/accounts", icon: Building2, flag: "virtualAccounts", keywords: "bank account number" },
    { label: "Virtual Cards", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards", keywords: "debit card international subscriptions" },
    { label: "Transfers", href: "/os/financial-products/remittance", icon: Send, flag: "remittance", keywords: "send money remit usa uk europe canada nigeria" },
    { label: "USDT & USDC", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell", keywords: "crypto stablecoin buy sell digital dollars" },
    { label: "RMB / China Payments", href: "/os/rmb", icon: Banknote, flag: "rmbBuy", keywords: "china yuan alipay wechat supplier payment" }
  ]},
  { label: "Services", href: "/os/services", icon: Store, children: [
    { label: "Airtime", href: "/os/airtime/airtime", icon: Phone, flag: "vtu", keywords: "recharge credit" },
    { label: "Data", href: "/os/airtime/data", icon: Wifi, flag: "vtu", keywords: "internet bundle" },
    { label: "Buy Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher purchase buy" },
    { label: "Sell Gift Cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher cash sell trade" },
    { label: "International Top-Up", href: "/os/telecom", icon: Globe, flag: "telecomGateway" },
    { label: "International Numbers", href: "/os/numbers", icon: Globe, flag: "virtualNumbers", keywords: "phone line" },
    { label: "My Numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers" },
    { label: "Electricity", href: "/os/utilities/electricity", icon: Lightbulb, flag: "billsElectricity", keywords: "power bill units" },
    { label: "Cable TV", href: "/os/utilities/cable", icon: Tv, flag: "billsCable", keywords: "subscription" },
    { label: "Education", href: "/os/utilities/education", icon: GraduationCap, flag: "billsEducation", keywords: "school pin" },
    { label: "Bet Funding", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting" },
    { label: "Digital Access", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess" }
  ]},
  { label: "Marketplace", href: "/os/marketplace", icon: Building2, children: [
    { label: "Discover", href: "/os/marketplace", icon: Store, keywords: "browse find" },
    { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase, keywords: "partner hire" },
    { label: "Creators", href: "/os/marketplace/creators", icon: Globe, keywords: "influencer talent" },
    { label: "Applications", href: "/os/marketplace/applications", icon: ClipboardList }
  ]},
  { label: "Rewards", href: "/os/rewards", icon: Trophy, children: [
    { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy, flag: "rewards" },
    { label: "My Progress", href: "/os/rewards/progress", icon: Gift, flag: "rewards", keywords: "points earned" },
    { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode, flag: "rewards" },
    { label: "Vouchers", href: "/os/vouchers", icon: Ticket, keywords: "code redeem" }
  ]}
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Team", href: "/os/team", icon: Users, keywords: "members invite" },
  { label: "My Orders", href: "/os/orders", icon: PackageSearch, keywords: "purchase history activity" },
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
  const { flags } = useFeatureFlags();
  const { session, loading, logout } = useApiSession();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleNav = useMemo(() => PRIMARY_NAV.map((section) => ({ ...section, children: section.children?.filter((item) => !item.flag || flags[item.flag]) })), [flags]);
  const accountNav = useMemo(() => ACCOUNT_NAV.filter((item) => !item.flag || flags[item.flag]), [flags]);
  const searchItems = useMemo(() => [...visibleNav.flatMap((section) => section.children ?? []), ...accountNav], [visibleNav, accountNav]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return searchItems.filter((item) => `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, searchItems]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);

  const active = (href: string) => pathname === href || (href !== "/os" && pathname.startsWith(`${href}/`));
  const navigate = (href: string) => { setQuery(""); router.push(href); };
  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === "Escape") setQuery(""); if (event.key === "Enter" && results[0]) navigate(results[0].href); };
  const handleLogout = useCallback(async () => { await logout(); router.push("/signin"); }, [logout, router]);

  if (loading) return <div className="min-h-screen bg-[var(--ft-bg-base)]" />;

  return <div className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-[var(--ft-border)] px-5"><Link href="/os" className="font-semibold tracking-[-0.03em]">FlipTrybe <span className="text-[var(--ft-accent)]">Technology</span></Link></div>
      <div className="p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--ft-text-muted)]" /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKeyDown} className="w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] py-2 pl-9 pr-12 text-xs outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]/50" placeholder="Find a service…" aria-label="Find a service" /><kbd className="absolute right-2 top-2 rounded border border-[var(--ft-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--ft-text-muted)]">⌘K</kbd></div>{results.length > 0 ? <div className="absolute left-4 right-4 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-xl">{results.map((item) => <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--ft-bg-muted)]" key={item.href} onClick={() => navigate(item.href)}><item.icon className="size-4 text-[var(--ft-accent)]" />{item.label}</button>)}</div> : null}</div>
      <nav className="flex-1 overflow-y-auto px-3 pb-5" aria-label="Primary navigation">{visibleNav.map((section) => <div className="mb-4" key={section.label}><Link className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", active(section.href) ? "bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]" : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} href={asHref(section.href)}><section.icon className="size-4" />{section.label}</Link>{section.children?.length ? <div className="mt-1 space-y-0.5 pl-3">{section.children.map((item) => <Link className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", active(item.href) ? "bg-[var(--ft-bg-muted)] font-semibold text-[var(--ft-text-primary)]" : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} href={asHref(item.href)} key={item.label}><item.icon className="size-3.5" />{item.label}</Link>)}</div> : null}</div>)}</nav>
      <div className="border-t border-[var(--ft-border)] p-3"><div className="mb-2 px-3 font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Account</div>{accountNav.map((item) => <Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]" href={asHref(item.href)} key={item.label}><item.icon className="size-3.5" />{item.label}</Link>)}<button onClick={() => void handleLogout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"><LogOut className="size-3.5" />Sign out</button></div>
    </aside>
    <div className="lg:pl-[260px]"><header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/90 px-4 backdrop-blur-xl lg:px-7"><button className="rounded-lg p-2 lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Open navigation"><Menu className="size-5" /></button><div className="flex-1 lg:hidden font-semibold">FlipTrybe <span className="text-[var(--ft-accent)]">Technology</span></div><div className="ml-auto text-xs text-[var(--ft-text-muted)]">{session?.user?.email ?? "Account"}</div></header><main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">{children}</main></div>
    {mobileOpen ? <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[290px] bg-[var(--ft-bg-surface)] p-4" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><span className="font-semibold">FlipTrybe Technology</span><button onClick={() => setMobileOpen(false)}><X className="size-5" /></button></div><div className="mt-5 space-y-1">{[...MOBILE_NAV, ...accountNav].map((item) => <Link className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-[var(--ft-bg-muted)]" href={asHref(item.href)} key={item.label}><item.icon className="size-4" />{item.label}</Link>)}</div></aside></div> : null}
  </div>;
}
