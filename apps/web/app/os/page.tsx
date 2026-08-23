"use client";

import {
  ArrowRight,
  Bell,
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
import { useApiSession } from "../lib/use-session";
import { formatNotificationTime } from "../notifications/api";
import { useNotificationsData } from "../notifications/use-notifications-data";

type QuickAction = { icon: LucideIcon; label: string; href: string; color: string; flag?: string };

// Cross-domain quick actions -- not campaign-only. Flag-gated entries only
// appear when the vertical is switched on for this workspace, so we never link
// to a service that answers 503 (matches the shell sidebar gating).
const QUICK_ACTIONS: QuickAction[] = [
  { icon: Megaphone, label: "New Campaign", href: "/os/campaigns/new", color: "var(--ft-accent)" },
  { icon: Plus, label: "Fund Wallet", href: "/os/wallet", color: "var(--ft-yellow)" },
  {
    icon: Phone,
    label: "Buy Airtime",
    href: "/os/airtime/airtime",
    color: "var(--ft-green)",
    flag: "vtu"
  },
  {
    icon: Gift,
    label: "Gift Cards",
    href: "/os/digital-value",
    color: "var(--ft-purple)",
    flag: "giftCardSell"
  },
  {
    icon: Send,
    label: "Send Money",
    href: "/os/financial-products/remittance",
    color: "var(--ft-blue)",
    flag: "remittance"
  },
  { icon: Sparkles, label: "AI Studio", href: "/os/studio", color: "var(--ft-red)" }
];

// Statuses where the ball is in the customer's court. Everything else is
// either running or waiting on the ops desk, so it does not belong in the
// "needs you" list.
const AWAITING_CUSTOMER = new Set([
  "CHANGES_REQUESTED",
  "PENDING_REVIEW",
  "PLAN_SENT",
  "READY",
  "REQUIRES_ACTION"
]);

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** One sentence describing the state of the desk, instead of a wall of counters. */
function summaryLine(live: number, awaiting: number) {
  const parts: string[] = [];
  parts.push(live === 1 ? "1 campaign live" : `${live} campaigns live`);
  if (awaiting > 0)
    parts.push(awaiting === 1 ? "1 needs your input" : `${awaiting} need your input`);
  return parts.join(" · ");
}

export default function DashboardPage() {
  const { aiInsights, analytics, campaigns, loading, wallet } = useCampaignDashboardData();
  const { loading: notifLoading, notifications } = useNotificationsData();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const { session } = useApiSession();

  const visibleQuickActions = QUICK_ACTIONS.filter(
    (action) => !action.flag || (flagsReady && flags[action.flag] === true)
  );

  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const availableBalance = wallet?.availableBalance ?? null;
  const heldBalance = wallet?.heldBalance ?? null;
  const spend = formatCampaignMoney({
    amountMinor: totalBudgetMinor(campaigns),
    currency: budgetCurrency
  });

  const liveCampaigns = campaigns.filter((c) => c.status === "ACTIVE" || c.status === "RUNNING");
  const awaitingCampaigns = campaigns.filter((c) => AWAITING_CUSTOMER.has(c.status));
  const impressions = metricValue(analytics, "impressions");
  const clicks = metricValue(analytics, "clicks");

  const sortedByRecency = [...campaigns].sort(
    (a, b) =>
      new Date(b.schedule?.startsAt ?? b.createdAt ?? 0).getTime() -
      new Date(a.schedule?.startsAt ?? a.createdAt ?? 0).getTime()
  );

  // Anything waiting on the customer comes first; the rest of the slots are
  // filled with whatever they touched most recently.
  const focusCampaigns = [
    ...awaitingCampaigns,
    ...sortedByRecency.filter((c) => !AWAITING_CUSTOMER.has(c.status))
  ].slice(0, 4);

  const insights = aiInsights?.items.slice(0, 3) ?? [];
  const unreadNotifications = notifications.filter((n) => !n.readAt).slice(0, 3);
  const firstName = session?.user.name?.split(" ")[0] ?? null;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {greeting(new Date().getHours())}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          {loading ? (
            <ValueSkeleton width="w-48" />
          ) : (
            summaryLine(liveCampaigns.length, awaitingCampaigns.length)
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Balance. Available and held read as one figure with its reservation,
            rather than two cards that invite comparison. */}
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)]"
          initial={{ opacity: 0, y: 8 }}
        >
          <div className="flex items-center justify-between">
            <span className="text-caption text-[var(--ft-text-muted)]">Available balance</span>
            <Wallet className="size-4 text-[var(--ft-accent)]" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold">
            {loading ? (
              <ValueSkeleton width="w-40" />
            ) : availableBalance ? (
              formatCampaignMoney(availableBalance)
            ) : (
              "—"
            )}
          </div>
          <p className="text-caption mt-2 text-[var(--ft-text-secondary)]">
            {loading ? (
              <ValueSkeleton width="w-44" />
            ) : (
              <>
                {formatCampaignMoney(heldBalance ?? { amountMinor: 0, currency: budgetCurrency })}{" "}
                held across {liveCampaigns.length}{" "}
                {liveCampaigns.length === 1 ? "campaign" : "campaigns"}
              </>
            )}
          </p>
          <Link
            className="text-caption mt-4 inline-flex items-center gap-1 font-medium text-[var(--ft-accent)]"
            href="/os/wallet"
          >
            Manage wallet <ArrowRight className="size-3" />
          </Link>
          <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[var(--ft-accent)]/5 blur-3xl" />
        </motion.section>

        <section>
          <h2 className="text-micro mb-3 font-mono tracking-[0.15em] text-[var(--ft-text-muted)] uppercase">
            Quick actions
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {visibleQuickActions.map((action, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 8 }}
                key={action.label}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  className="group flex h-full flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
                  href={action.href}
                >
                  <div
                    className="grid size-10 place-items-center rounded-[var(--radius-md)] transition group-hover:scale-110"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${action.color} 12%, transparent)`
                    }}
                  >
                    <action.icon className="size-5" style={{ color: action.color }} />
                  </div>
                  <span className="text-caption text-center font-medium">{action.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          {/* Campaigns needing the customer, ahead of merely recent ones. */}
          <section className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {awaitingCampaigns.length > 0 ? "Needs you" : "Continue working"}
              </h2>
              <Link
                className="text-caption font-medium text-[var(--ft-accent)]"
                href="/os/campaigns"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 grid gap-2">
              {loading ? (
                <LoadingBlock label="Loading campaigns" />
              ) : focusCampaigns.length === 0 ? (
                <EmptyState icon={Megaphone} title="No campaigns yet">
                  Start a campaign to see it tracked here.
                </EmptyState>
              ) : (
                focusCampaigns.map((campaign) => (
                  <Link
                    className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 transition hover:border-[var(--ft-accent)]/30"
                    href={`/os/campaigns/${campaign.id}`}
                    key={campaign.id}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <div className="text-caption mt-1 text-[var(--ft-text-muted)]">
                        {formatCampaignMoney(campaign.budget)} · Starts{" "}
                        {formatDateTime(campaign.schedule?.startsAt ?? campaign.createdAt)}
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-[var(--ft-text-muted)]" />
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* One performance block. Previously impressions, spend and the wallet
              balance each appeared twice on this screen across three sections. */}
          <section className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Portfolio</h2>
              <Link
                className="text-caption font-medium text-[var(--ft-accent)]"
                href="/os/analytics"
              >
                Analytics
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Impressions", value: formatCompact(impressions), width: "w-16" },
                { label: "Clicks", value: formatCompact(clicks), width: "w-16" },
                { label: "Portfolio spend", value: spend, width: "w-24" },
                { label: "Live campaigns", value: String(liveCampaigns.length), width: "w-10" }
              ].map((metric) => (
                <div key={metric.label}>
                  <dt className="text-caption text-[var(--ft-text-muted)]">{metric.label}</dt>
                  <dd className="mt-1 font-mono text-xl font-semibold">
                    {loading ? <ValueSkeleton width={metric.width} /> : metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="grid gap-6 self-start">
          <section className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--ft-accent)]" />
              <h2 className="font-semibold">Desk Insights</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {loading ? (
                <LoadingBlock label="Loading insights" />
              ) : insights.length === 0 ? (
                <p className="text-caption text-[var(--ft-text-muted)]">
                  No desk insights yet — start a campaign to generate them.
                </p>
              ) : (
                insights.map((insight) => (
                  <div
                    className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                    key={insight.id}
                  >
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--ft-accent)]" />
                    <p className="text-caption leading-relaxed text-[var(--ft-text-secondary)]">
                      {insight.label}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <Link
                className="text-caption font-medium text-[var(--ft-accent)]"
                href="/os/notifications"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 grid gap-2">
              {notifLoading ? (
                <LoadingBlock label="Loading notifications" />
              ) : unreadNotifications.length === 0 ? (
                <p className="text-caption text-[var(--ft-text-muted)]">
                  You&apos;re all caught up.
                </p>
              ) : (
                unreadNotifications.map((notification) => (
                  <div
                    className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                    key={notification.id}
                  >
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-[var(--ft-accent)]" />
                    <div className="min-w-0">
                      <p className="text-caption leading-relaxed">{notification.title}</p>
                      <p className="text-micro mt-1 text-[var(--ft-text-muted)]">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
