"use client";

import { ArrowRight, Clock, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip, ValueSkeleton } from "@fliptrybe/ui";

import { ErrorNotice, PageHeader, RequestStatus } from "../../digital-access/components";
import { accessEnabled, navItems } from "../../digital-access/data";
import { RequestAccessButton } from "../../digital-access/request-modal";
import { useDigitalAccessData } from "../../digital-access/use-digital-access-data";
import { SectionTabs } from "../section-tabs";

export default function DigitalAccessPage() {
  const { categories, error, loading, refresh, requests, services } = useDigitalAccessData();
  const featured = services.filter((service) => service.featured).slice(0, 3);
  const openRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "processing"
  ).length;
  const fulfilledRequests = requests.filter((request) => request.status === "fulfilled").length;

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search creator tools
            </div>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone={accessEnabled ? "success" : "warning"}>
              {accessEnabled ? "Requests open" : "Admin setup mode"}
            </Badge>
            <Badge tone="info">Managed access desk</Badge>
          </>
        }
        title="Digital Access Hub"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={accessEnabled ? "success" : "warning"}>
            {accessEnabled ? "Desk online" : "Admin setup"}
          </Badge>
          <Badge tone="info">Wallet-funded requests</Badge>
          <Badge tone="neutral">Manual fulfillment</Badge>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="font-mono text-micro tracking-[0.2em] text-[var(--ft-text-muted)] uppercase">
              Premium service gateway
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
              Request creator tools, paid infrastructure, and managed services from one desk.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Browse approved services, submit a wallet-paid request, and track fulfillment
              without exposing provider internals or administrative steps.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh desk
            </Button>
            <Button className="border-[var(--ft-border-strong)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)] hover:bg-[var(--ft-bg-muted)]">
              <ArrowRight className="size-4" />
              Open services
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <SummaryStatStrip
            items={[
              { label: "Open requests", value: loading ? <ValueSkeleton width="w-10" /> : String(openRequests) },
              { label: "Fulfilled", value: loading ? <ValueSkeleton width="w-10" /> : String(fulfilledRequests) },
              { label: "Catalog", value: loading ? <ValueSkeleton width="w-10" /> : String(services.length) },
              { label: "Access mode", value: accessEnabled ? "Live" : "Setup" }
            ]}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open requests"
          value={loading ? <ValueSkeleton width="w-10" /> : String(openRequests)}
          detail="Awaiting or in fulfillment"
          tone="info"
        />
        <MetricCard
          label="Fulfilled"
          value={loading ? <ValueSkeleton width="w-10" /> : String(fulfilledRequests)}
          detail="Completed manually"
          tone="success"
        />
        <MetricCard
          label="Catalog"
          value={loading ? <ValueSkeleton width="w-10" /> : String(services.length)}
          detail="Admin-priced services"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 text-[var(--ft-text-primary)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Creator infrastructure</Badge>
            <Badge tone="info">Wallet-ready</Badge>
          </div>
          <h2 className="mt-6 max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
            Request premium tools and infrastructure from one clean operations desk.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
            Browse approved services, submit a wallet-paid request, and track manual fulfillment
            without exposing operational details or provider internals.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="bg-[var(--ft-bg-muted)] text-[var(--ft-text-primary)] hover:bg-[var(--ft-bg-raised)]">
              Browse Services
              <ArrowRight className="size-4" />
            </Button>
            <Button
              className="border-[var(--ft-border-strong)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)] hover:bg-[var(--ft-bg-muted)]"
              variant="secondary"
            >
              View Requests
            </Button>
          </div>
        </div>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Request queue</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Live state from the fulfillment desk.
              </p>
            </div>
            <ShieldCheck className="size-5 text-[var(--ft-green)]" />
          </div>
          <div className="mt-5 divide-y divide-[var(--ft-border)]">
            {loading ? (
              <QueueMessage label="Loading request queue" />
            ) : requests.length === 0 ? (
              <QueueMessage label="No requests yet" />
            ) : (
              requests.slice(0, 4).map((request) => (
                <div
                  className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  key={request.id}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">
                      {request.service}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {request.updatedAt}
                    </div>
                  </div>
                  <RequestStatus request={request} />
                  <div className="font-mono text-sm font-medium text-[var(--ft-text-primary)]">
                    {request.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Categories</h2>
          <Badge tone="neutral">Admin-controlled catalog</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] md:col-span-2 xl:col-span-4">
              Loading catalog
            </Panel>
          ) : categories.length === 0 ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] md:col-span-2 xl:col-span-4">
              No active categories
            </Panel>
          ) : (
            categories.map((category) => (
              <Panel className="p-4" key={category.slug}>
                <category.icon className={`size-5 ${category.tone}`} />
                <div className="mt-4 font-semibold text-[var(--ft-text-primary)]">
                  {category.label}
                </div>
                <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                  {services.filter((service) => service.category === category.slug).length} services
                </div>
              </Panel>
            ))
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Featured access</h2>
          <Badge tone="success">Fast manual review</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {loading ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] xl:col-span-3">
              Loading services
            </Panel>
          ) : featured.length === 0 ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] xl:col-span-3">
              No featured services
            </Panel>
          ) : (
            featured.map((service) => (
              <Panel className="p-4" key={service.id}>
                <div className="flex items-start justify-between">
                  <service.icon className="size-5 text-[var(--ft-text-primary)]" />
                  <Badge tone="info">{service.deliveryEta}</Badge>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                  {service.name}
                </h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--ft-text-muted)]">
                  {service.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--ft-border)] pt-4">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                      {service.startingPrice}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ft-text-muted)]">
                      <Clock className="size-3" />
                      {service.plans.length} plans
                    </div>
                  </div>
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
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
            <Wallet className="size-5 text-[var(--ft-blue)]" />
            Wallet payment
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
            Requests are paid upfront from your FlipTrybe wallet and automatically reversed if the
            admin team marks them failed or cancelled.
          </p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
            <ShieldCheck className="size-5 text-[var(--ft-green)]" />
            Operational privacy
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
            The storefront shows service details, pricing, ETA, and request state only. Fulfillment
            methods stay inside the admin desk.
          </p>
        </Panel>
      </section>
    </>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="py-6 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
