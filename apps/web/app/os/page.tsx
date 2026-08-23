"use client";

import {
  ArrowRight,
  BarChart3,
  Bell,
  Gift,
  Megaphone,
  Phone,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge, ValueSkeleton } from "@fliptrybe/ui";

import {
  fallbackCurrency,
  formatCampaignMoney,
  formatCompact,
  formatDateTime,
  metricValue,
  totalBudgetMinor
} from "../campaigns/api";
import { EmptyState, LoadingBlock } from "../campaigns/components";
import { useCampaignDashboardData } from "../campaigns/use-campaign-dashboard-data";
import { useFeatureFlags } from "../lib/feature-flags";
import { formatNotificationTime } from "../notifications/api";
import { useNotificationsData } from "../notifications/use-notifications-data";
import Link from "next/link";

type QuickAction = { icon: LucideIcon; label: string; href: string; color: string; flag?: string };

// Cross-domain quick actions — not campaign-only. Flag-gated entries only appear
// when the vertical is switched on for this workspace, so we never link to a
// service that answers 503 (matches the shell sidebar gating).
const QUICK_ACTIONS: QuickAction[] = [
  { icon: Megaphone, label: "New Campaign", href: "/os/campaigns/new", color: "var(--ft-accent)" },
  { icon: Plus, label: "Fund Wallet", href: "/os/wallet", color: "var(--ft-yellow)" },
  { icon: Phone, label: "Buy Airtime", href: "/os/airtime/airtime", color: "var(--ft-green)", flag: "vtu" },
  { icon: Gift, label: "Gift Cards", href: "/os/digital-value", color: "var(--ft-purple)", flag: "giftCardSell" },
  { icon: Send, label: "Send Money", href: "/os/financial-products/remittance", color: "var(--ft-blue)", flag: "remittance" },
  { icon: Sparkles, label: "AI Studio", href: "/os/studio", color: "var(--ft-red)" },
];

export default function DashboardPage() {
  const { aiInsights, analytics, campaigns, loading, wallet } = useCampaignDashboardData();
  const { loading: notifLoading, notifications } = useNotificationsData();
  const { flags, ready: flagsReady } = useFeatureFlags();

  const visibleQuickActions = QUICK_ACTIONS.filter(
    (action) => !action.flag || (flagsReady && flags[action.flag] === true)
  );

  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const availableBalance = wallet?.availableBalance ?? null;
  const heldBalance = wallet?.heldBalance ?? null;
  const spend = formatCampaignMoney({ amountMinor: totalBudgetMinor(campaigns), currency: budgetCurrency });
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE" || c.status === "RUNNING");
  const pendingReview = campaigns.filter((c) => c.status === "PENDING_REVIEW").length;
  const impressions = metricValue(analytics, "impressions");
  const clicks = metricValue(analytics, "clicks");
  const recentCampaigns = [...campaigns]
    .sort(
      (a, b) =>
        new Date(b.schedule?.startsAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.schedule?.startsAt ?? a.createdAt ?? 0).getTime()
    )
    .slice(0, 3);
  const insights = aiInsights?.items.slice(0, 3) ?? [];
  const unreadNotifications = notifications.filter((n) => !n.readAt).slice(0, 3);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Wallet summary + quick actions — the command-centre band */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Wallet Summary */}
        <section>
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Wallet summary</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-gradient-to-br from-[var(--ft-bg-raised)] to-[var(--ft-bg-surface)] p-5 shadow-[var(--shadow-md)]"
              initial={{ opacity: 0, y: 8 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--ft-text-muted)]">Available balance</span>
                <Wallet className="size-4 text-[var(--ft-accent)]" />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">
                {loading ? <ValueSkeleton width="w-24" /> : availableBalance ? formatCampaignMoney(availableBalance) : "—"}
              </div>
              <Link className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--ft-accent)]" href="/os/wallet">
                Manage wallet <ArrowRight className="size-3" />
              </Link>
              <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[var(--ft-accent)]/5 blur-3xl" />
            </motion.div>
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5"
              initial={{ opacity: 0, y: 8 }}
              transition={{ delay: 0.04 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--ft-text-muted)]">Held for campaigns</span>
                <TrendingUp className="size-4 text-[var(--ft-text-muted)]" />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">
                {loading
                  ? "..."
                  : formatCampaignMoney(heldBalance ?? { amountMinor: 0, currency: budgetCurrency })}
              </div>
              <div className="mt-3 text-xs text-[var(--ft-text-muted)]">Reserved budget across active campaigns</div>
            </motion.div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Quick actions</h2>
          <div className="grid grid-cols-3 gap-2">
            {visibleQuickActions.map((action, i) => (
              <motion.a
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
                href={action.href}
                initial={{ opacity: 0, y: 8 }}
                key={action.label}
                transition={{ delay: i * 0.03 }}
              >
                <div
                  className="grid size-10 place-items-center rounded-[var(--radius-md)] transition group-hover:scale-110"
                  style={{ backgroundColor: `color-mix(in srgb, ${action.color} 12%, transparent)` }}
                >
                  <action.icon className="size-5" style={{ color: action.color }} />
                </div>
                <span className="text-center text-xs font-medium">{action.label}</span>
              </motion.a>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="grid gap-6">
          {/* Recent campaigns */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Continue Working</h2>
              <Link className="text-xs font-medium text-[var(--ft-accent)]" href="/os/campaigns">View all</Link>
            </div>
            <div className="mt-4 grid gap-2">
              {loading ? (
                <LoadingBlock label="Loading campaigns" />
              ) : recentCampaigns.length === 0 ? (
                <EmptyState
                  copy="Start a campaign to see it tracked here."
                  icon={Megaphone}
                  title="No campaigns yet"
                />
              ) : (
                recentCampaigns.map((campaign) => (
                  <Link
                    className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 transition hover:border-[var(--ft-accent)]/30"
                    href={`/os/campaigns/${campaign.id}`}
                    key={campaign.id}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <Badge tone={campaign.status === "ACTIVE" || campaign.status === "RUNNING" ? "success" : "neutral"}>
                          {campaign.status.toLowerCase()}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                        {formatCampaignMoney(campaign.budget)} · Starts {formatDateTime(campaign.schedule?.startsAt ?? campaign.createdAt)}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Revenue Snapshot */}
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Impressions", value: loading ? <ValueSkeleton width="w-16" /> : formatCompact(impressions), icon: BarChart3 },
              { label: "Active Campaigns", value: loading ? <ValueSkeleton width="w-10" /> : String(activeCampaigns.length), icon: Megaphone },
              { label: "Wallet Balance", value: loading ? <ValueSkeleton width="w-24" /> : (wallet ? formatCampaignMoney(wallet.availableBalance) : "—"), icon: Wallet },
              { label: "Pending review", value: loading ? <ValueSkeleton width="w-10" /> : String(pendingReview), icon: TrendingUp },
            ].map((m) => (
              <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4" key={m.label}>
                <m.icon className="size-4 text-[var(--ft-text-muted)]" />
                <div className="mt-2 text-xl font-bold">{m.value}</div>
                <div className="mt-0.5 text-[11px] text-[var(--ft-text-muted)]">{m.label}</div>
              </div>
            ))}
          </section>

          {/* Portfolio metrics */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[var(--ft-accent)]" />
              <h2 className="font-semibold">Portfolio snapshot</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Impressions</div>
                <div className="mt-1 font-mono text-lg">{loading ? <ValueSkeleton width="w-16" /> : formatCompact(impressions)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Clicks</div>
                <div className="mt-1 font-mono text-lg">{loading ? <ValueSkeleton width="w-16" /> : formatCompact(clicks)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Portfolio spend</div>
                <div className="mt-1 font-mono text-lg">{loading ? <ValueSkeleton width="w-24" /> : spend}</div>
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="grid gap-6 self-start">
          {/* Desk insights */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--ft-accent)]" />
              <h2 className="font-semibold">Desk Insights</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {loading ? (
                <LoadingBlock label="Loading insights" />
              ) : insights.length === 0 ? (
                <p className="text-xs text-[var(--ft-text-muted)]">
                  No desk insights yet — start a campaign to generate them.
                </p>
              ) : (
                insights.map((insight) => (
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3" key={insight.id}>
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--ft-accent)]" />
                      <p className="text-xs leading-relaxed text-[var(--ft-text-secondary)]">{insight.label}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <Link className="text-xs font-medium text-[var(--ft-accent)]" href="/os/notifications">View all</Link>
            </div>
            <div className="mt-3 grid gap-2">
              {notifLoading ? (
                <LoadingBlock label="Loading notifications" />
              ) : unreadNotifications.length === 0 ? (
                <p className="text-xs text-[var(--ft-text-muted)]">You&apos;re all caught up.</p>
              ) : (
                unreadNotifications.map((n) => (
                  <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3" key={n.id}>
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-[var(--ft-accent)]" />
                    <div>
                      <p className="text-xs leading-relaxed">{n.title}</p>
                      <p className="mt-1 text-[10px] text-[var(--ft-text-muted)]">{formatNotificationTime(n.createdAt)}</p>
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
