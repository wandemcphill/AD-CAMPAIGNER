import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader } from "../components";
import { riskSignals } from "../data";

export default function AdminOtpRiskPage() {
  return (
    <AdminOtpShell active="/otp/risk">
      <AdminPageHeader
        eyebrow={<Badge tone="warning">Risk controls active</Badge>}
        title="Risk"
        action={
          <Button>
            <ShieldCheck className="size-4" /> Apply policy
          </Button>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Flagged users" value="17" detail="4 new this hour" tone="warning" />
        <MetricCard label="Review orders" value="9" detail="NGN 7,880 protected" tone="info" />
        <MetricCard
          label="Blocked routes"
          value="1"
          detail="SMS-Activate compatible"
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
          {riskSignals.map((signal) => (
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
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
