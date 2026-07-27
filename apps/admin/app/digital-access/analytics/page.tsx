"use client";

import { Activity, BarChart3, RefreshCw, TrendingUp } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
  AdminEmptyState,
  AdminErrorNotice,
  AdminPageHeader
} from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

export default function AdminDigitalAccessAnalyticsPage() {
  const { error, loading, metrics, refresh, services } = useAdminDigitalAccessData();
  const maxDemand = Math.max(1, ...services.map((service) => service.demand));

  return (
    <AdminDigitalAccessShell active="/digital-access/analytics">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Demand insights</Badge>
            <Badge tone="success">Fulfillment tracking</Badge>
          </>
        }
        title="Digital Access analytics"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                Service demand
              </h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Top requested services from live admin data.
              </p>
            </div>
            <BarChart3 className="size-5 text-[var(--ft-blue)]" />
          </div>
          {loading ? (
            <div className="mt-5">
              <AdminEmptyState title="Loading demand" detail="Refreshing service demand metrics." />
            </div>
          ) : services.length === 0 ? (
            <div className="mt-5">
              <AdminEmptyState
                title="No demand data returned"
                detail="Service demand bars will appear when catalog rows include request counts."
              />
            </div>
          ) : (
            <div className="mt-5 flex h-56 items-end gap-3">
              {services.slice(0, 6).map((service, index) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={service.id}>
                  <div
                    className="w-full rounded-t-md bg-[var(--ft-accent)]"
                    style={{ height: `${Math.max(20, (service.demand / maxDemand) * 180)}px` }}
                  />
                  <div className="text-xs text-[var(--ft-text-muted)]">{index + 1}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                Top categories
              </h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Demand, conversion, and queue pressure.
              </p>
            </div>
            <TrendingUp className="size-5 text-[var(--ft-green)]" />
          </div>
          <div className="mt-5 divide-y divide-[var(--ft-border)]">
            {services.length === 0 ? (
              <AdminEmptyState
                title="No categories returned"
                detail="Category pressure will appear after services are available."
              />
            ) : (
              services.slice(0, 5).map((service) => (
                <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={service.id}>
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{service.name}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {service.category}
                    </div>
                  </div>
                  <Badge tone={service.demand > 30 ? "success" : "info"}>
                    {service.demand} requests
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel className="mt-6 p-4">
        <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
          <Activity className="size-5 text-[var(--ft-accent)]" />
          Operational analytics
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
          Track service demand, conversion, refund rate, fulfillment time, top plans, and customer
          return behavior without exposing internal fulfillment workflows.
        </p>
      </Panel>
    </AdminDigitalAccessShell>
  );
}
