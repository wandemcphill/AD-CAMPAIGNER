"use client";

import { RefreshCw, Search, ShieldAlert } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import {
  DeliveryMeter,
  ErrorNotice,
  GrowthServicesShell,
  GrowthStatusBadge,
  PageHeader
} from "./components";
import { growthEnabled } from "./data";
import { OrderGrowthServiceButton } from "./order-modal";
import { useGrowthData } from "./use-growth-data";

export default function GrowthServicesPage() {
  const { error, loading, orders, refresh, services } = useGrowthData();
  const activeServices = services.filter((service) => service.enabled);
  const highRiskServices = services.filter(
    (service) => service.riskTone === "danger" || service.riskTone === "warning"
  ).length;
  const activeOrders = orders.filter(
    (order) =>
      order.status === "PENDING" || order.status === "SUBMITTED" || order.status === "IN_PROGRESS"
  ).length;
  const completedOrders = orders.filter((order) => order.status === "COMPLETED").length;

  return (
    <GrowthServicesShell active="/growth-services">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search services
            </div>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone={growthEnabled ? "success" : "warning"}>
              {growthEnabled ? "Orders open" : "Setup mode"}
            </Badge>
            <Badge tone="info">Supplier routed</Badge>
          </>
        }
        title="Growth Services"
      /> 

      <ErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={growthEnabled ? "success" : "warning"}>
            {growthEnabled ? "Routing live" : "Setup mode"}
          </Badge>
          <Badge tone="info">Supplier routed</Badge>
          <Badge tone="neutral">Managed delivery</Badge>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--ft-text-muted)] uppercase">
              Growth services desk
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
              Order social growth, paid traffic support, and fulfillment routed through approved suppliers.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Each request moves through a managed delivery path so the team can keep pricing,
              risk, and status visible without exposing the supplier layer.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh desk
            </Button>
            <Button className="border-[var(--ft-border-strong)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)] hover:bg-[var(--ft-bg-muted)]">
              <Search className="size-4" />
              Explore services
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <SummaryStatStrip
            items={[
              {
                label: "services",
                value: loading ? "..." : String(activeServices.length),
                detail: "Enabled catalog"
              },
              {
                label: "active orders",
                value: loading ? "..." : String(activeOrders),
                detail: "Queued or running"
              },
              {
                label: "completed",
                value: loading ? "..." : String(completedOrders),
                detail: "Delivered orders"
              },
              {
                label: "risk flags",
                value: loading ? "..." : String(highRiskServices),
                detail: "Review required"
              }
            ]}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          detail="Available storefront items"
          label="Services"
          value={loading ? "..." : String(activeServices.length)}
          tone="info"
        />
        <MetricCard
          detail="Pending, submitted, or in delivery"
          label="Active orders"
          value={loading ? "..." : String(activeOrders)}
          tone="warning"
        />
        <MetricCard
          detail="Delivered orders"
          label="Completed"
          value={loading ? "..." : String(completedOrders)}
          tone="success"
        />
        <MetricCard
          detail="Require clear customer disclosure"
          label="Risk flags"
          value={loading ? "..." : String(highRiskServices)}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {activeServices.slice(0, 6).map((service) => (
            <Panel className="p-4" key={service.code}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                  <service.icon className="size-5 text-[var(--ft-text-primary)]" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge tone="info">{service.platform}</Badge>
                  <Badge tone={service.riskTone}>Risk</Badge>
                </div>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                {service.name}
              </h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--ft-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 grid gap-2 rounded-md bg-[var(--ft-bg-muted)] p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--ft-text-muted)]">Price</span>
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {service.price}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--ft-text-muted)]">Quantity</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">
                    {service.minimumQuantity.toLocaleString()}-
                    {service.maximumQuantity.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--ft-text-muted)]">ETA</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">
                    {service.expectedCompletion}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs leading-5 text-[var(--ft-text-muted)]">
                  {service.riskSummary}
                </span>
                <OrderGrowthServiceButton service={service} />
              </div>
            </Panel>
          ))}
        </div>

        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                Delivery tracker
              </h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Quantity ordered, delivered, and expected completion.
              </p>
            </div>
            <ShieldAlert className="size-5 text-[var(--ft-yellow)]" />
          </div>
          <div className="mt-5 grid gap-4">
            {loading ? (
              <QueueMessage label="Loading orders" />
            ) : orders.length === 0 ? (
              <QueueMessage label="No Growth orders yet" />
            ) : (
              orders.slice(0, 5).map((order) => (
                <div
                  className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                  key={order.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--ft-text-primary)]">
                        {order.serviceName}
                      </div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                        {order.expectedCompletionAt}
                      </div>
                    </div>
                    <GrowthStatusBadge status={order.status} />
                  </div>
                  <div className="mt-3">
                    <DeliveryMeter order={order} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </GrowthServicesShell>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="py-6 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
