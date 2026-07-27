"use client";

import { Download, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { EmptyState, OtpShell, PageHeader, StatusBadge } from "../components";
import { useOtpDashboard } from "../use-otp-dashboard";

export default function OtpOrdersPage() {
  const { data, isLoading, refresh } = useOtpDashboard();
  const orders = data?.orders ?? [];

  return (
    <OtpShell active="/otp/orders">
      <PageHeader
        eyebrow={<Badge tone="warning">Live verification queue</Badge>}
        title="Orders"
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
        <div className="hidden grid-cols-[0.75fr_0.8fr_1fr_0.75fr_0.6fr_0.6fr] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
          <div>Order</div>
          <div>Service</div>
          <div>Number</div>
          <div>Status</div>
          <div>Expiry</div>
          <div>Debit</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {isLoading ? (
            <EmptyState title="Loading orders" detail="Pulling your current OTP queue from the API." />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders found"
              detail="New OTP purchases will appear here with status, expiry, debit, and provider allocation."
            />
          ) : (
            orders.map((order) => (
              <Link
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-muted)] xl:grid-cols-[0.75fr_0.8fr_1fr_0.75fr_0.6fr_0.6fr] xl:items-center"
                href={`/otp/orders/${order.id}`}
                key={order.id}
              >
                <div>
                  <div className="font-semibold text-[var(--ft-text-primary)]">{order.id}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{order.requestedAt}</div>
                </div>
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{order.service}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{order.country}</div>
                </div>
                <div className="text-sm font-medium text-[var(--ft-text-secondary)]">
                  {order.number}
                </div>
                <StatusBadge status={order.status} />
                <div className="text-sm text-[var(--ft-text-secondary)]">{order.expiresIn}</div>
                <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                  {order.amount}
                </div>
              </Link>
            ))
          )}
        </div>
      </Panel>
    </OtpShell>
  );
}
