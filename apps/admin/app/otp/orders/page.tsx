"use client";

import { Download, RefreshCcw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, EmptyState, StatusBadge } from "../components";
import { useAdminOtpDashboard } from "../use-admin-otp-dashboard";

export default function AdminOtpOrdersPage() {
  const { data, isLoading, refresh } = useAdminOtpDashboard();
  const orders = data?.orders ?? [];

  return (
    <AdminOtpShell active="/otp/orders">
      <AdminPageHeader
        eyebrow={<Badge tone="warning">Admin order review</Badge>}
        title="OTP orders"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Download className="size-4" /> Export
            </Button>
            <Button disabled={isLoading} onClick={() => void refresh()}>
              <RefreshCcw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[0.7fr_1.1fr_0.8fr_0.9fr_0.65fr_0.5fr_0.55fr] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
          <div>Order</div>
          <div>User</div>
          <div>Service</div>
          <div>Provider</div>
          <div>Status</div>
          <div>Risk</div>
          <div>GMV</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {isLoading ? (
            <EmptyState
              title="Loading admin orders"
              detail="Fetching live OTP orders from the marketplace API."
            />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No OTP orders yet"
              detail="Customer purchases will appear here with provider, risk, status, and GMV."
            />
          ) : (
            orders.map((order) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] xl:grid-cols-[0.7fr_1.1fr_0.8fr_0.9fr_0.65fr_0.5fr_0.55fr] xl:items-center"
                key={order.id}
              >
                <div className="font-semibold text-[var(--ft-text-primary)]">{order.id}</div>
                <div className="text-sm text-[var(--ft-text-secondary)]">{order.user}</div>
                <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                  {order.service}
                </div>
                <div className="text-sm text-[var(--ft-text-secondary)]">{order.provider}</div>
                <StatusBadge status={order.status} />
                <Badge
                  tone={
                    order.risk === "High"
                      ? "danger"
                      : order.risk === "Medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {order.risk}
                </Badge>
                <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                  {order.amount}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
