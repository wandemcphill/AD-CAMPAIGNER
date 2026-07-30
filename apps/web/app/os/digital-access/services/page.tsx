"use client";

import { Filter, RefreshCw, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice, PageHeader } from "../../../digital-access/components";
import { RequestAccessButton } from "../../../digital-access/request-modal";
import { useDigitalAccessData } from "../../../digital-access/use-digital-access-data";
import { navItems } from "../../../digital-access/data";
import { SectionTabs } from "../../section-tabs";

export default function DigitalAccessServicesPage() {
  const { categories, error, loading, refresh, services } = useDigitalAccessData({
    includeRequests: false
  });

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search services
            </div>
            <Button variant="secondary">
              <Filter className="size-4" />
              Filters
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Service catalog</Badge>
            <Badge tone="neutral">Managed catalog</Badge>
          </>
        }
        title="Services"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {loading ? (
          <div className="text-sm text-[var(--ft-text-muted)]">Loading categories</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-[var(--ft-text-muted)]">No active categories</div>
        ) : (
          categories.map((category) => (
            <button
              className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm font-medium text-[var(--ft-text-secondary)]"
              key={category.slug}
            >
              <category.icon className={`size-4 ${category.tone}`} />
              {category.label}
            </button>
          ))
        )}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)] md:col-span-2 xl:col-span-3">
            Loading services
          </Panel>
        ) : services.length === 0 ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)] md:col-span-2 xl:col-span-3">
            No services available
          </Panel>
        ) : (
          services.map((service) => (
            <Panel className="p-4" key={service.id}>
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-md bg-[var(--ft-bg-raised)]">
                  <service.icon className="size-5 text-[var(--ft-text-primary)]" />
                </div>
                <Badge tone={service.featured ? "success" : "neutral"}>
                  {service.featured ? "Featured" : service.deliveryEta}
                </Badge>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                {service.name}
              </h2>
              <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--ft-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 grid gap-2 border-t border-[var(--ft-border)] pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--ft-text-muted)]">Starting price</span>
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {service.startingPrice}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ft-text-muted)]">Delivery ETA</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">
                    {service.deliveryEta}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ft-text-muted)]">Plans</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">
                    {service.plans.length}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <RequestAccessButton
                  plans={service.plans}
                  serviceId={service.id}
                  serviceName={service.name}
                  serviceSlug={service.slug}
                />
              </div>
            </Panel>
          ))
        )}
      </section>
    </>
  );
}
