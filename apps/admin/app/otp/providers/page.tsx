"use client";

import { PauseCircle, PlayCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, EmptyState, ProviderBadge } from "../components";
import { useAdminOtpDashboard } from "../use-admin-otp-dashboard";

export default function AdminOtpProvidersPage() {
  const { data, isLoading, refresh } = useAdminOtpDashboard();
  const providers = data?.providers ?? [];

  return (
    <AdminOtpShell active="/otp/providers">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Provider routing</Badge>}
        title="Providers"
        action={
          <Button disabled={isLoading} onClick={() => void refresh()}>
            <PlayCircle className="size-4" /> Refresh
          </Button>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
          <div>Provider</div>
          <div>State</div>
          <div>Fill</div>
          <div>Latency</div>
          <div>Stock</div>
          <div>Refund</div>
          <div>Action</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {isLoading ? (
            <EmptyState
              title="Loading providers"
              detail="Checking provider controls and health from the admin API."
            />
          ) : providers.length === 0 ? (
            <EmptyState
              title="No OTP providers configured"
              detail="Set live provider credentials to expose routable OTP suppliers here."
            />
          ) : (
            providers.map((provider) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] xl:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] xl:items-center"
                key={provider.name}
              >
                <div>
                  <div className="font-semibold text-[var(--ft-text-primary)]">{provider.name}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{provider.spend} route</div>
                </div>
                <ProviderBadge state={provider.state} />
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {provider.fill}
                  </span>{" "}
                  fill
                </div>
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {provider.latency}
                  </span>{" "}
                  latency
                </div>
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {provider.stock}
                  </span>{" "}
                  stock
                </div>
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {provider.refund}
                  </span>{" "}
                  refund
                </div>
                <Button
                  className="px-3"
                  variant={provider.state === "paused" ? "secondary" : "ghost"}
                >
                  <PauseCircle className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
