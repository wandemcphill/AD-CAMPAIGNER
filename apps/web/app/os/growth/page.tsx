"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import {
  DeliveryMeter,
  ErrorNotice,
  GrowthStatusBadge,
  PageHeader
} from "../../growth-services/components";
import { growthEnabled, navItems } from "../../growth-services/data";
import { OrderGrowthServiceButton } from "../../growth-services/order-modal";
import { useGrowthData } from "../../growth-services/use-growth-data";
import { SectionTabs } from "../section-tabs";

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
    <>
      <PageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone={growthEnabled ? "success" : "warning"}>
              {growthEnabled ? "Orders open" : "Setup mode"}
            </Badge>
            <Badge tone="info">Managed delivery</Badge>
          </>
        }
        title="Growth Services"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "services", value: loading ? "..." : String(activeServices.length) },
            { label: "active orders", value: loading ? "..." : String(activeOrders) },
            { label: "completed", value: loading ? "..." : String(completedOrders) },
            { label: "risk flags", value: loading ? "..." : String(highRiskServices) }
          ]}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          detail="Available storefront items"
          label="Services"
          tone="info"
          value={loading ? "..." : String(activeServices.length)}
        />
        <MetricCard
          detail="Pending, submitted, or in delivery"
          label="Active orders"
          tone="warning"
          value={loading ? "..." : String(activeOrders)}
        />
        <MetricCard
          detail="Delivered orders"
          label="Completed"
          tone="success"
          value={loading ? "..." : String(completedOrders)}
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
    </>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="py-6 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
