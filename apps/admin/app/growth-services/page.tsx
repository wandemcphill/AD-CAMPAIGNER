"use client";

import { RefreshCw } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  AdminEmptyState,
  AdminErrorNotice,
  AdminGrowthShell,
  AdminGrowthStatusBadge,
  AdminPageHeader,
  SupplierHealthBadge
} from "./components";
import { useAdminGrowthData } from "./use-admin-growth-data";

export default function AdminGrowthOverviewPage() {
  const { error, loading, metrics, orders, refresh, risks, suppliers } = useAdminGrowthData();

  return (
    <AdminGrowthShell active="/growth-services">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Growth marketplace</Badge>
            <Badge tone="warning">Risk governed</Badge>
          </>
        }
        title="Growth Services operations"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            value={loading ? "..." : metric.value}
            {...(metric.tone === undefined ? {} : { tone: metric.tone })}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Recent orders</h2>
            <Badge tone="info">Lifecycle</Badge>
          </div>
          <div className="mt-4 divide-y divide-[var(--ft-border)]">
            {orders.length === 0 ? (
              <div className="py-4">
                <AdminEmptyState
                  title="No growth orders yet"
                  detail="Customer growth-service purchases will appear here once submitted through the marketplace."
                />
              </div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div
                  className="grid gap-3 py-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                  key={order.id}
                >
                  <div>
                    <div className="font-semibold text-[var(--ft-text-primary)]">
                      {order.serviceName}
                    </div>
                    <div className="mt-1 text-sm break-all text-[var(--ft-text-muted)]">
                      {order.destinationUrl}
                    </div>
                  </div>
                  <AdminGrowthStatusBadge status={order.status} />
                  <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                    {order.quantityDelivered.toLocaleString()} /{" "}
                    {order.quantityOrdered.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                Supplier health
              </h2>
              <Badge tone="neutral">{suppliers.length} providers</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {suppliers.length === 0 ? (
                <AdminEmptyState
                  title="No suppliers returned"
                  detail="Configure live supplier credentials to populate routing health."
                />
              ) : (
                suppliers.slice(0, 4).map((supplier) => (
                  <div
                    className="grid gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                    key={supplier.name}
                  >
                    <div>
                      <div className="font-semibold text-[var(--ft-text-primary)]">
                        {supplier.name}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                        {supplier.routingRole} - {supplier.mode}
                      </div>
                    </div>
                    <SupplierHealthBadge status={supplier.reliability} />
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Risk watch</h2>
              <Badge tone="danger">Policy exposure</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {risks.length === 0 ? (
                <AdminEmptyState
                  title="No risk report returned"
                  detail="Risk exposure will appear after the admin risk endpoint returns service assessments."
                />
              ) : (
                risks.slice(0, 3).map((risk) => (
                  <div
                    className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                    key={risk.serviceCode}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-[var(--ft-text-primary)]">
                        {risk.serviceName}
                      </div>
                      <Badge tone="danger">{risk.platformPolicyRisk}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
                      {risk.summary}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>
    </AdminGrowthShell>
  );
}
