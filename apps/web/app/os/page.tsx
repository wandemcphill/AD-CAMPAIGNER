"use client";

import {
  ArrowRight,
  BarChart3,
  Bell,
  CreditCard,
  Film,
  Globe,
  Image,
  Megaphone,
  Palette,
  Sparkles,
  TrendingUp,
  Wallet
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@fliptrybe/ui";

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
import { formatNotificationTime } from "../notifications/api";
import { useNotificationsData } from "../notifications/use-notifications-data";

const QUICK_ACTIONS = [
  { icon: Megaphone, label: "Create Campaign", href: "/os/campaigns/new", color: "var(--ft-accent)" },
  { icon: Film, label: "Generate Video", href: "/os/studio", color: "var(--ft-blue)" },
  { icon: Image, label: "Create Flyer", href: "/os/studio", color: "var(--ft-green)" },
  { icon: CreditCard, label: "Recharge Wallet", href: "/os/wallet", color: "var(--ft-yellow)" },
  { icon: Globe, label: "Launch SEO", href: "/os/growth", color: "var(--ft-purple)" },
  { icon: Palette, label: "Motion Graphic", href: "/os/studio", color: "var(--ft-red)" },
];

export default function DashboardPage() {
  const { aiInsights, analytics, campaigns, loading, wallet } = useCampaignDashboardData();
  const { loading: notifLoading, notifications } = useNotificationsData();

  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const spend = formatCampaignMoney({ amountMinor: totalBudgetMinor(campaigns), currency: budgetCurrency });
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE" || c.status === "RUNNING");
  const pendingReview = campaigns.filter((c) => c.status === "PENDING_REVIEW").length;
  const impressions = metricValue(analytics, "impressions");
  const clicks = metricValue(analytics, "clicks");
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.schedule.startsAt).getTime() - new Date(a.schedule.startsAt).getTime())
    .slice(0, 3);
  const insights = aiInsights?.items.slice(0, 3) ?? [];
  const unreadNotifications = notifications.filter((n) => !n.readAt).slice(0, 3);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero */}
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-gradient-to-br from-[var(--ft-bg-raised)] to-[var(--ft-bg-surface)] p-8 shadow-[var(--shadow-lg)]"
        initial={{ opacity: 0, y: 12 }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sm text-[var(--ft-text-muted)]">
            <Sparkles className="size-4 text-[var(--ft-accent)]" />
            <span>Your growth desk</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {loading ? "Loading your workspace..." : `${activeCampaigns.length} campaigns live right now`}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ft-text-secondary)]">
            One view for briefs, launch prep, live spend, and reports across your workspace.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-[var(--ft-accent)]/5 blur-3xl" />
      </motion.section>

      {/* Quick Actions */}
      <section className="mt-6">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map((action, i) => (
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="grid gap-6">
          {/* Recent campaigns */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Continue Working</h2>
              <a className="text-xs font-medium text-[var(--ft-accent)]" href="/os/campaigns">View all</a>
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
                  <a
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
                        {formatCampaignMoney(campaign.budget)} · Starts {formatDateTime(campaign.schedule.startsAt)}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
                  </a>
                ))
              )}
            </div>
          </section>

          {/* Revenue Snapshot */}
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Impressions", value: loading ? "..." : formatCompact(impressions), icon: BarChart3 },
              { label: "Active Campaigns", value: loading ? "..." : String(activeCampaigns.length), icon: Megaphone },
              { label: "Wallet Balance", value: loading ? "..." : (wallet ? formatCampaignMoney(wallet.availableBalance) : "—"), icon: Wallet },
              { label: "Pending review", value: loading ? "..." : String(pendingReview), icon: TrendingUp },
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
                <div className="mt-1 font-mono text-lg">{loading ? "..." : formatCompact(impressions)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Clicks</div>
                <div className="mt-1 font-mono text-lg">{loading ? "..." : formatCompact(clicks)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Portfolio spend</div>
                <div className="mt-1 font-mono text-lg">{loading ? "..." : spend}</div>
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
              <a className="text-xs font-medium text-[var(--ft-accent)]" href="/os/notifications">View all</a>
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

          {/* Wallet */}
          <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Wallet</h2>
              <a className="text-xs font-medium text-[var(--ft-accent)]" href="/os/wallet">View all</a>
            </div>
            <div className="mt-3">
              <div className="text-xs text-[var(--ft-text-muted)]">Available balance</div>
              <div className="mt-1 font-mono text-2xl">
                {loading ? "..." : wallet ? formatCampaignMoney(wallet.availableBalance) : "—"}
              </div>
              {wallet && wallet.heldBalance.amountMinor > 0 ? (
                <div className="mt-2 text-xs text-[var(--ft-text-muted)]">
                  {formatCampaignMoney(wallet.heldBalance)} held for active campaigns
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
