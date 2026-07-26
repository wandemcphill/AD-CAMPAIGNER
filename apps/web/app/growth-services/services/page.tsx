"use client";

import { RefreshCw, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice, GrowthServicesShell, PageHeader } from "../components";
import { OrderGrowthServiceButton } from "../order-modal";
import { useGrowthData } from "../use-growth-data";

export default function GrowthServicesCatalogPage() {
  const { error, loading, refresh, services } = useGrowthData(false);

  return (
    <GrowthServicesShell active="/growth-services/services">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search catalog
            </div>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Customer catalog</Badge>
            <Badge tone="warning">Risk visible</Badge>
          </>
        }
        title="Browse services"
      />

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {services.map((service) => (
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
        ))}
      </section>
    </GrowthServicesShell>
  );
}
