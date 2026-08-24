"use client";

import {
  ArrowRight,
  Bell,
  Plane,
  CreditCard,
  Globe2,
  CircleDollarSign,
  Users,
  ShoppingBag,
  Tv,
  Gift,
  Megaphone,
  Phone,
  Plus,
  Send,
  Sparkles,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import { EmptyState, StatusBadge, ValueSkeleton } from "@fliptrybe/ui";

import {
  fallbackCurrency,
  formatCampaignMoney,
  formatCompact,
  formatDateTime,
  metricValue,
  totalBudgetMinor
} from "../campaigns/api";
import { LoadingBlock } from "../campaigns/components";
import { useCampaignDashboardData } from "../campaigns/use-campaign-dashboard-data";
import { useFeatureFlags } from "../lib/feature-flags";
import { asHref } from "../lib/nav";
import { useApiSession } from "../lib/use-session";
import { formatNotificationTime } from "../notifications/api";
import { useNotificationsData } from "../notifications/use-notifications-data";

type QuickAction = { icon: LucideIcon; label: string; href: string; color: string; flag?: string };

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Megaphone, label: "New campaign", href: "/os/campaigns/new", color: "var(--ft-accent)" },
  { icon: Plus, label: "Fund wallet", href: "/os/wallet", color: "var(--ft-yellow)" },
  { icon: Phone, label: "Buy airtime", href: "/os/airtime/airtime", color: "var(--ft-green)", flag: "vtu" },
  { icon: Gift, label: "Gift cards", href: "/os/digital-value", color: "var(--ft-purple)", flag: "giftCardSell" },
  { icon: Send, label: "Send money", href: "/os/financial-products/remittance", color: "var(--ft-blue)", flag: "remittance" },
  { icon: Sparkles, label: "AI studio", href: "/os/studio", color: "var(--ft-red)" }
];

const AWAITING_CUSTOMER = new Set(["CHANGES_REQUESTED", "PENDING_REVIEW", "PLAN_SENT", "READY", "REQUIRES_ACTION"]);

type DiscoveryCard = { label: string; description: string; href: string; icon: LucideIcon; eyebrow: string; tone: string; status?: "Live" | "Soon" };

const DISCOVERY_CARDS: DiscoveryCard[] = [
  { label: "Send money internationally", description: "Explore supported routes from the US, UK, Europe and Canada to Nigeria.", href: "/os/financial-products/remittance", icon: Send, eyebrow: "Global money", tone: "var(--ft-blue)", status: "Live" },
  { label: "Multi-currency accounts", description: "Manage supported foreign-currency account products from one workspace.", href: "/os/financial-products/accounts", icon: Globe2, eyebrow: "Currencies", tone: "var(--ft-purple)", status: "Live" },
  { label: "Virtual cards", description: "Access supported card products for international online spending.", href: "/os/financial-products/cards", icon: CreditCard, eyebrow: "Spend globally", tone: "var(--ft-accent)", status: "Live" },
  { label: "USDT & USDC", description: "Buy and sell supported stablecoins as the digital-dollar layer comes online.", href: "/os/financial-products", icon: CircleDollarSign, eyebrow: "Digital dollars", tone: "var(--ft-green)", status: "Soon" },
  { label: "Flights, safaris & tours", description: "Discover travel booking experiences without leaving the FlipTrybe ecosystem.", href: "/os/services", icon: Plane, eyebrow: "Travel", tone: "var(--ft-blue)", status: "Soon" },
  { label: "Pay China suppliers", description: "A future cross-border lane for Nigeria-to-China purchasing and settlement.", href: "/os/financial-products/remittance", icon: ShoppingBag, eyebrow: "China", tone: "var(--ft-yellow)", status: "Soon" },
  { label: "Grow your TikTok", description: "Reach Nigerian viewers, grow followers and build creator campaigns.", href: "/os/growth/services", icon: Users, eyebrow: "Audience growth", tone: "var(--ft-purple)", status: "Live" },
  { label: "Promote your LIVE", description: "Turn audience-growth goals into managed growth campaigns.", href: "/os/growth/services", icon: Tv, eyebrow: "TikTok LIVE", tone: "var(--ft-red)", status: "Live" }
];


function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function summaryLine(live: number, awaiting: number) {
  const parts: string[] = [];
  parts.push(live === 1 ? "1 campaign live" : `${live} campaigns live`);
  if (awaiting > 0) parts.push(awaiting === 1 ? "1 needs your input" : `${awaiting} need your input`);
  return parts.join(" · ");
}

export default function DashboardPage() {
  const { aiInsights, analytics, campaigns, loading, wallet } = useCampaignDashboardData();
  const { loading: notifLoading, notifications } = useNotificationsData();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const { session } = useApiSession();

  const visibleQuickActions = QUICK_ACTIONS.filter((action) => !action.flag || (flagsReady && flags[action.flag] === true));
  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const availableBalance = wallet?.availableBalance ?? null;
  const heldBalance = wallet?.heldBalance ?? null;
  const spend = formatCampaignMoney({ amountMinor: totalBudgetMinor(campaigns), currency: budgetCurrency });
  const liveCampaigns = campaigns.filter((c) => c.status === "ACTIVE" || c.status === "RUNNING");
  const awaitingCampaigns = campaigns.filter((c) => AWAITING_CUSTOMER.has(c.status));
  const impressions = metricValue(analytics, "impressions");
  const clicks = metricValue(analytics, "clicks");
  const sortedByRecency = [...campaigns].sort((a, b) => new Date(b.schedule?.startsAt ?? b.createdAt ?? 0).getTime() - new Date(a.schedule?.startsAt ?? a.createdAt ?? 0).getTime());
  const focusCampaigns = [...awaitingCampaigns, ...sortedByRecency.filter((c) => !AWAITING_CUSTOMER.has(c.status))].slice(0, 4);
  const insights = aiInsights?.items.slice(0, 3) ?? [];
  const unreadNotifications = notifications.filter((n) => !n.readAt).slice(0, 3);
  const firstName = session?.user.name?.split(" ")[0] ?? null;

  return (
    <div className="relative overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--ft-accent)_16%,transparent),transparent_45%),radial-gradient(circle_at_82%_0%,color-mix(in_srgb,var(--ft-accent-2)_12%,transparent),transparent_42%)]" />

      <header className="relative mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/75 px-3 py-1 font-mono text-micro font-semibold tracking-[0.14em] text-[var(--ft-accent)] uppercase shadow-[var(--shadow-xs)] backdrop-blur-xl">
            <span className="size-1.5 rounded-full bg-[var(--ft-green)] shadow-[0_0_12px_var(--ft-green-glow)]" />
            FlipTrybe Technology · Growth OS
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {greeting(new Date().getHours())}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">
            {loading ? <ValueSkeleton width="w-64" /> : summaryLine(liveCampaigns.length, awaitingCampaigns.length)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/70 px-3 py-2 text-xs text-[var(--ft-text-secondary)] shadow-[var(--shadow-xs)] backdrop-blur-xl">
          <span className="size-2 rounded-full bg-[var(--ft-green)] shadow-[0_0_12px_var(--ft-green-glow)]" />
          Intelligent infrastructure online
        </div>
      </header>

      <div className="relative grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="group relative overflow-hidden rounded-[24px] border border-[var(--ft-border-strong)] bg-[linear-gradient(135deg,var(--ft-bg-raised),color-mix(in_srgb,var(--ft-accent-subtle)_35%,var(--ft-bg-raised)))] p-6 shadow-[var(--shadow-lg)]"
          initial={{ opacity: 0, y: 8 }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[var(--ft-accent)]/10 blur-3xl transition duration-500 group-hover:bg-[var(--ft-accent)]/16" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-micro font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">Available balance</div>
              <div className="mt-3 font-mono text-4xl font-bold tracking-[-0.04em] tabular-nums sm:text-5xl">
                {loading ? <ValueSkeleton width="w-52" /> : availableBalance ? formatCampaignMoney(availableBalance) : "—"}
              </div>
              <p className="mt-2 text-caption text-[var(--ft-text-secondary)]">
                {loading ? <ValueSkeleton width="w-56" /> : <>{formatCampaignMoney(heldBalance ?? { amountMinor: 0, currency: budgetCurrency })} held across {liveCampaigns.length} {liveCampaigns.length === 1 ? "campaign" : "campaigns"}</>}
              </p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl border border-[var(--ft-accent)]/20 bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)] shadow-[0_0_30px_var(--ft-accent-glow)]">
              <Wallet className="size-5" />
            </div>
          </div>
          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <Link className="inline-flex items-center gap-2 rounded-xl bg-[var(--ft-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ft-accent-dim)] hover:shadow-[0_0_22px_var(--ft-accent-glow)]" href="/os/wallet">
              Manage wallet <ArrowRight className="size-4" />
            </Link>
            <span className="text-caption text-[var(--ft-text-muted)]">Secure balance layer</span>
          </div>
        </motion.section>

        <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/80 p-4 shadow-[var(--shadow-md)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Quick actions</h2>
              <p className="mt-0.5 text-caption text-[var(--ft-text-muted)]">High-frequency actions, one tap away</p>
            </div>
            <Sparkles className="size-4 text-[var(--ft-accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {visibleQuickActions.map((action, index) => (
              <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 8 }} key={action.label} transition={{ delay: index * 0.03 }}>
                <Link className="group flex h-full min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-center transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/30 hover:bg-[var(--ft-bg-raised)] hover:shadow-[var(--shadow-md)]" href={asHref(action.href)}>
                  <div className="grid size-10 place-items-center rounded-xl border border-[var(--ft-border)] transition group-hover:scale-105" style={{ backgroundColor: `color-mix(in srgb, ${action.color} 12%, transparent)` }}>
                    <action.icon className="size-5" style={{ color: action.color }} />
                  </div>
                  <span className="text-caption font-medium">{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <section className="relative mt-5 overflow-hidden rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-md)] backdrop-blur-xl sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[var(--ft-accent)]/8 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="font-mono text-micro font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Your FlipTrybe command center</div><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">What do you want to do?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">Money, travel, cards, creator growth and campaigns are becoming one connected experience. Pick the outcome, not the product department.</p></div>
          <Link className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--ft-accent)]" href="/os/services">Explore services <ArrowRight className="size-3.5" /></Link>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DISCOVERY_CARDS.map((card) => <Link className="group relative flex min-h-[156px] flex-col rounded-[22px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-md)]" href={card.href} key={card.label}>
            <div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]" style={{ color: card.tone }}><card.icon className="size-5" /></span><span className={card.status === "Live" ? "rounded-full bg-[var(--ft-green)]/10 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--ft-green)]" : "rounded-full bg-[var(--ft-yellow)]/10 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--ft-yellow)]"}>{card.status}</span></div>
            <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">{card.eyebrow}</div><div className="mt-1 text-sm font-semibold">{card.label}</div><p className="mt-1 flex-1 text-xs leading-5 text-[var(--ft-text-muted)]">{card.description}</p><ArrowRight className="mt-3 size-4 text-[var(--ft-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--ft-accent)]" />
          </Link>)}
        </div>
      </section>

      <div className="relative mt-5 grid gap-5 xl:grid-cols-[1fr_370px]">
        <div className="grid gap-5">
          <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-micro uppercase tracking-[0.14em] text-[var(--ft-text-muted)]">Active workspace</div>
                <h2 className="mt-1 text-lg font-semibold">{awaitingCampaigns.length > 0 ? "Needs your attention" : "Continue working"}</h2>
              </div>
              <Link className="inline-flex items-center gap-1 text-caption font-medium text-[var(--ft-accent)]" href="/os/campaigns">View all <ArrowRight className="size-3" /></Link>
            </div>
            <div className="mt-5 grid gap-2">
              {loading ? <LoadingBlock label="Loading campaigns" /> : focusCampaigns.length === 0 ? <EmptyState title="No campaigns yet">Start a campaign to see it tracked here.</EmptyState> : focusCampaigns.map((campaign) => (
                <Link className="group flex items-center gap-4 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30 hover:bg-[var(--ft-bg-raised)]" href={asHref(`/os/campaigns/${campaign.id}`)} key={campaign.id}>
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]">
                    <Megaphone className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{campaign.name}</span><StatusBadge status={campaign.status} /></div>
                    <div className="mt-1 text-caption text-[var(--ft-text-muted)]">{formatCampaignMoney(campaign.budget)} · Starts {formatDateTime(campaign.schedule?.startsAt ?? campaign.createdAt)}</div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-[var(--ft-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ft-accent)]" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div><div className="font-mono text-micro uppercase tracking-[0.14em] text-[var(--ft-text-muted)]">Performance layer</div><h2 className="mt-1 text-lg font-semibold">Portfolio</h2></div>
              <Link className="text-caption font-medium text-[var(--ft-accent)]" href="/os/analytics">Analytics <ArrowRight className="ml-1 inline size-3" /></Link>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[{ label: "Impressions", value: formatCompact(impressions), width: "w-16" }, { label: "Clicks", value: formatCompact(clicks), width: "w-16" }, { label: "Portfolio spend", value: spend, width: "w-24" }, { label: "Live campaigns", value: String(liveCampaigns.length), width: "w-10" }].map((metric) => (
                <div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4" key={metric.label}>
                  <dt className="text-caption text-[var(--ft-text-muted)]">{metric.label}</dt>
                  <dd className="mt-2 font-mono text-xl font-semibold tabular-nums">{loading ? <ValueSkeleton width={metric.width} /> : metric.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="grid gap-5 self-start">
          <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl">
            <div className="flex items-center gap-2"><Sparkles className="size-4 text-[var(--ft-accent)]" /><div><div className="font-mono text-micro uppercase tracking-[0.14em] text-[var(--ft-text-muted)]">Intelligence layer</div><h2 className="mt-1 font-semibold">Desk insights</h2></div></div>
            <div className="mt-4 grid gap-2">
              {loading ? <LoadingBlock label="Loading insights" /> : insights.length === 0 ? <p className="text-caption text-[var(--ft-text-muted)]">No desk insights yet — start a campaign to generate them.</p> : insights.map((insight) => <div className="flex items-start gap-3 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3" key={insight.id}><span className="mt-1 grid size-6 place-items-center rounded-lg bg-[var(--ft-accent-subtle)]"><Sparkles className="size-3.5 text-[var(--ft-accent)]" /></span><p className="text-caption leading-relaxed text-[var(--ft-text-secondary)]">{insight.label}</p></div>)}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-sm)] backdrop-blur-xl">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell className="size-4 text-[var(--ft-accent)]" /><h2 className="font-semibold">Notifications</h2></div><Link className="text-caption font-medium text-[var(--ft-accent)]" href="/os/notifications">View all</Link></div>
            <div className="mt-4 grid gap-2">
              {notifLoading ? <LoadingBlock label="Loading notifications" /> : unreadNotifications.length === 0 ? <p className="text-caption text-[var(--ft-text-muted)]">You&apos;re all caught up.</p> : unreadNotifications.map((notification) => <div className="flex items-start gap-3 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3" key={notification.id}><div className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--ft-accent)] shadow-[0_0_10px_var(--ft-accent-glow)]" /><div className="min-w-0"><p className="text-caption leading-relaxed">{notification.title}</p><p className="mt-1 text-micro text-[var(--ft-text-muted)]">{formatNotificationTime(notification.createdAt)}</p></div></div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
