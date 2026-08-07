"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  AdminEmptyState,
  AdminErrorNotice,
  AdminGrowthShell,
  AdminPageHeader
} from "../components";
import { useAdminGrowthData } from "../use-admin-growth-data";

export default function AdminGrowthRiskPage() {
  const { error, loading, refresh, risks } = useAdminGrowthData();

  return (
    <AdminGrowthShell active="/growth-services/risk/">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="danger">Policy risk</Badge>
            <Badge tone="warning">Refund exposure</Badge>
          </>
        }
        title="Risk report"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4">
        {risks.length === 0 ? (
          <AdminEmptyState
            title="No risk assessments returned"
            detail="Service policy, account, refund, and reputation risk checks will appear once the API returns assessments."
          />
        ) : (
          risks.map((risk) => (
          <Panel className="p-4" key={risk.serviceCode}>
            <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr] xl:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="size-5 text-[var(--ft-yellow)]" />
                  <h2 className="font-semibold text-[var(--ft-text-primary)]">
                    {risk.serviceName}
                  </h2>
                  <Badge tone="info">{risk.platform}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--ft-text-muted)]">{risk.summary}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <RiskStat label="Platform" value={risk.platformPolicyRisk} />
                <RiskStat label="Account" value={risk.accountRisk} />
                <RiskStat label="Refund" value={risk.refundRisk} />
                <RiskStat label="Reputation" value={risk.reputationRisk} />
              </div>
            </div>
          </Panel>
          ))
        )}
      </section>
    </AdminGrowthShell>
  );
}

function RiskStat({ label, value }: { label: string; value: string }) {
  const tone =
    value === "CRITICAL" || value === "HIGH"
      ? "text-[var(--ft-red)]"
      : value === "MEDIUM"
        ? "text-[var(--ft-yellow)]"
        : "text-[var(--ft-green)]";

  return (
    <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
      <div className="font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
