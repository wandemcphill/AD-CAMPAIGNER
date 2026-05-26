import { Bell, SlidersHorizontal } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, ProviderBadge, StatusBadge } from "./components";
import { healthBars, orders, overviewMetrics, providers } from "./data";

export default function AdminOtpPage() {
  return (
    <AdminOtpShell active="/otp">
      <AdminPageHeader
        eyebrow={
          <>
            <Badge tone="success">OTP systems nominal</Badge>
            <Badge tone="warning">1 paused route</Badge>
          </>
        }
        title="OTP operations"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Bell className="size-4" /> Alert team
            </Button>
            <Button>
              <SlidersHorizontal className="size-4" /> Controls
            </Button>
          </div>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewMetrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Provider health</h2>
            <ProviderBadge state={providers[0]?.state ?? "healthy"} />
          </div>
          <div className="mt-5 flex h-56 items-end gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
            {healthBars.map((value, index) => (
              <div className="flex flex-1 items-end" key={`${value}-${index}`}>
                <div
                  className="w-full rounded-t-sm bg-[var(--ft-bg-raised)]"
                  style={{ height: `${value}%` }}
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-4">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Order watch</h2>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {orders.slice(0, 4).map((order) => (
              <div
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                key={order.id}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{order.id}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">
                    {order.service} via {order.provider}
                  </div>
                </div>
                <StatusBadge status={order.status} />
                <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                  {order.amount}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminOtpShell>
  );
}
