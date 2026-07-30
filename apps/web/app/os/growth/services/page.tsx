"use client";

import { RefreshCw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice, PageHeader } from "../../../growth-services/components";
import { navItems } from "../../../growth-services/data";
import { OrderGrowthServiceButton } from "../../../growth-services/order-modal";
import { useGrowthData } from "../../../growth-services/use-growth-data";
import { SectionTabs } from "../../section-tabs";

export default function GrowthServicesCatalogPage() {
  const { error, loading, refresh, services } = useGrowthData(false);

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
            <Badge tone="info">Customer catalog</Badge>
            <Badge tone="warning">Risk visible</Badge>
          </>
        }
        title="Browse services"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {loading ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)]">Loading catalog</Panel>
        ) : services.length === 0 ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)]">
            No growth services are available yet.
          </Panel>
        ) : (
          services.map((service) => (
            <Panel
              className={service.enabled ? "p-4" : "border-dashed p-4 opacity-70"}
              key={service.code}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                  <service.icon className="size-5 text-[var(--ft-text-primary)]" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge tone={service.enabled ? "success" : "neutral"}>
                    {service.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge tone={service.riskTone}>Risk</Badge>
                </div>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                {service.name}
              </h2>
              <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--ft-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 divide-y divide-[var(--ft-border)] rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-sm">
                {[
                  ["Platform", service.platform],
                  ["Price", service.price],
                  [
                    "Quantity",
                    `${service.minimumQuantity.toLocaleString()}-${service.maximumQuantity.toLocaleString()}`
                  ],
                  ["ETA", service.expectedCompletion]
                ].map(([label, value]) => (
                  <div className="flex justify-between gap-3 px-3 py-2" key={label}>
                    <span className="text-[var(--ft-text-muted)]">{label}</span>
                    <span className="text-right font-medium text-[var(--ft-text-primary)]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 min-h-10 text-xs leading-5 text-[var(--ft-text-muted)]">
                {service.riskSummary}
              </p>
              <div className="mt-4">
                <OrderGrowthServiceButton service={service} />
              </div>
            </Panel>
          ))
        )}
      </section>
    </>
  );
}
