"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { loadAdminOtpRisk, type AdminOtpRiskData } from "../api";
import { AdminOtpShell, AdminPageHeader, EmptyState } from "../components";

function moneyMinor(value: number) {
  return `NGN ${(value / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminOtpRiskPage() {
  const [data, setData] = useState<AdminOtpRiskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadAdminOtpRisk());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load OTP risk data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AdminOtpShell active="/otp/risk">
      <AdminPageHeader
        eyebrow={<Badge tone="warning">Risk controls active</Badge>}
        title="Risk"
        action={
          <Button disabled={isLoading} onClick={() => void refresh()}>
            <ShieldCheck className="size-4" /> Refresh policy
          </Button>
        }
      />

      {error ? (
        <div className="mt-6 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Flagged users"
          value={String(data?.metrics.flaggedUsers ?? 0)}
          detail="High-risk OTP orders"
          tone="warning"
        />
        <MetricCard
          label="Review orders"
          value={String(data?.metrics.reviewOrders ?? 0)}
          detail={`${moneyMinor(data?.metrics.protectedAmountMinor ?? 0)} protected`}
          tone="info"
        />
        <MetricCard
          label="Blocked routes"
          value={String(data?.metrics.blockedRoutes ?? 0)}
          detail="Provider controls and health"
          tone="warning"
        />
      </section>

      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--ft-border)] p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--ft-text-primary)]">
            <ShieldAlert className="size-5 text-[var(--ft-accent)]" />
            Signals
          </h2>
        </div>
        <div className="hidden grid-cols-[1fr_1fr_auto_1fr] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
          <div>Signal</div>
          <div>Entity</div>
          <div>Severity</div>
          <div>Action</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {isLoading ? (
            <EmptyState title="Loading risk signals" detail="Reading live OTP risk telemetry." />
          ) : data?.signals.length === 0 ? (
            <EmptyState
              title="No OTP risk signals"
              detail="Provider or order risk issues will appear here when detected."
            />
          ) : (
            data?.signals.map((signal) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[1fr_1fr_auto_1fr] lg:items-center"
                key={`${signal.label}-${signal.entity}`}
              >
                <div className="font-semibold text-[var(--ft-text-primary)]">{signal.label}</div>
                <div className="text-sm text-[var(--ft-text-secondary)]">{signal.entity}</div>
                <Badge
                  tone={
                    signal.severity === "High"
                      ? "danger"
                      : signal.severity === "Medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {signal.severity}
                </Badge>
                <div className="text-sm font-medium text-[var(--ft-text-secondary)]">
                  {signal.action}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
