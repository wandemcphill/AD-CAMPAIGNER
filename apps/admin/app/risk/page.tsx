"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type RiskOverview = {
  generatedAt: string;
  totals: {
    campaignReviews: number;
    campaignHighRisk: number;
    openReconciliation: number;
    failedPayments24h: number;
    suspendedUsers: number;
    kycPending: number;
  };
  severity: "NORMAL" | "WATCH" | "HIGH";
  recentAudit: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: unknown;
    createdAt: string;
  }>;
};

type CampaignReview = {
  id: string;
  score: number;
  action: string;
  tier: string | null;
  categories: string[];
  reasons: string[];
  campaign: {
    id: string;
    name: string;
    status: string;
    workspaceId: string;
    budgetMinor: number;
    currency: string;
    riskAction: string | null;
    riskScore: number | null;
  };
};

const severityTone = {
  NORMAL: "success",
  WATCH: "warning",
  HIGH: "danger"
} as const;

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amountMinor / 100);
}

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminRiskPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [overview, setOverview] = useState<RiskOverview>();
  const [reviews, setReviews] = useState<CampaignReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextReviews] = await Promise.all([
        apiRequest<RiskOverview>("/admin/risk/overview"),
        apiRequest<CampaignReview[]>("/admin/risk/campaign-reviews?limit=100")
      ]);
      setOverview(nextOverview);
      setReviews(nextReviews);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the risk desk.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Risk auth" />;
  }

  const totals = overview?.totals;

  return (
    <AdminShell active="/risk/" subtitle="Risk & security operations">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Risk & Security</h1>
              {overview ? <Badge tone={severityTone[overview.severity]}>{overview.severity.toLowerCase()}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              One desk for campaign risk, payment exceptions, account security and verification workload.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/40 bg-[var(--ft-red)]/10 p-3 text-sm text-[var(--ft-red)]">{error}</p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Campaign reviews", totals?.campaignReviews ?? 0, "Requires operator decision"],
            ["High-risk campaigns", totals?.campaignHighRisk ?? 0, "Score ≥ 80"],
            ["Reconciliation", totals?.openReconciliation ?? 0, "Open or investigating"],
            ["Failed payments", totals?.failedPayments24h ?? 0, "Last 24 hours"],
            ["Suspended users", totals?.suspendedUsers ?? 0, "Account access restricted"],
            ["KYC pending", totals?.kycPending ?? 0, "Pending or action required"]
          ].map(([label, value, detail]) => (
            <Panel className="p-4" key={String(label)}>
              <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">{detail}</div>
            </Panel>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Panel className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
              <div>
                <div className="font-semibold">Campaigns needing review</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Highest scores first</div>
              </div>
              <Badge tone="warning">{reviews.length}</Badge>
            </div>
            {reviews.length === 0 ? (
              <div className="p-6 text-sm text-[var(--ft-text-secondary)]">
                <BadgeCheck className="mr-2 inline size-4 text-[var(--ft-green)]" />
                No campaign risk reviews are currently open.
              </div>
            ) : (
              reviews.map((review) => (
                <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={review.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{review.campaign.name}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{review.campaign.id} · {review.campaign.workspaceId}</div>
                    </div>
                    <Badge tone={review.score >= 80 ? "danger" : "warning"}>score {review.score}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div><span className="text-[var(--ft-text-muted)]">Status</span><div>{review.campaign.status}</div></div>
                    <div><span className="text-[var(--ft-text-muted)]">Budget</span><div>{money(review.campaign.budgetMinor, review.campaign.currency)}</div></div>
                    <div><span className="text-[var(--ft-text-muted)]">Tier</span><div>{review.tier ?? "—"}</div></div>
                  </div>
                  {review.reasons.length ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {review.reasons.slice(0, 5).map((reason) => <Badge key={reason} tone="neutral">{reason}</Badge>)}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-[var(--ft-green)]" /> Recent privileged activity</div>
            <div className="mt-3 grid gap-3">
              {(overview?.recentAudit ?? []).map((entry) => (
                <div className="border-t border-[var(--ft-border)] pt-3 first:border-t-0 first:pt-0" key={entry.id}>
                  <div className="text-sm font-medium">{entry.action}</div>
                  <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{entry.entityType}:{entry.entityId}</div>
                  <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">{when(entry.createdAt)}</div>
                </div>
              ))}
              {(overview?.recentAudit?.length ?? 0) === 0 ? (
                <div className="text-sm text-[var(--ft-text-secondary)]"><AlertTriangle className="mr-2 inline size-4" />No privileged events returned.</div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
