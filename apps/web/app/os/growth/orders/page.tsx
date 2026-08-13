"use client";

import { RefreshCw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  DeliveryMeter,
  ErrorNotice,
  GrowthStatusBadge,
  PageHeader
} from "../../../growth-services/components";
import { navItems } from "../../../growth-services/data";
import { useGrowthData } from "../../../growth-services/use-growth-data";
import { SectionTabs } from "../../section-tabs";

export default function GrowthOrdersPage() {
  const { error, loading, orders, refresh } = useGrowthData();

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
            <Badge tone="info">Delivery transparency</Badge>
            <Badge tone="warning">Live status</Badge>
          </>
        }
        title="Order tracking"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-3">
        {loading ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)]">Loading orders</Panel>
        ) : orders.length === 0 ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)]">No Growth orders yet</Panel>
        ) : (
          orders.map((order) => (
            <Panel className="p-4" key={order.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--ft-text-primary)]">
                      {order.serviceName}
                    </h2>
                    <Badge tone="info">{order.platform}</Badge>
                  </div>
                  <div className="mt-2 text-sm break-all text-[var(--ft-text-muted)]">
                    {order.destinationUrl}
                  </div>
                </div>
                <DeliveryMeter order={order} />
                <div className="grid gap-2 text-sm lg:min-w-44">
                  <GrowthStatusBadge status={order.status} />
                  <div className="font-mono font-semibold text-[var(--ft-text-primary)]">
                    {order.amount}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    ETA {order.expectedCompletionAt}
                  </div>
                </div>
              </div>
            </Panel>
          ))
        )}
      </section>
    </>
  );
}
