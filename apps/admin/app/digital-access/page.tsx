"use client";

import { Bell, CheckCircle2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
  AdminErrorNotice,
  AdminPageHeader,
  RequestStatus,
  ServiceStateBadge
} from "./components";
import { adminAccessEnabled, timeline } from "./data";
import { useAdminDigitalAccessData } from "./use-admin-digital-access-data";

export default function AdminDigitalAccessPage() {
  const { error, loading, metrics, refresh, requests, services, source } =
    useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Bell className="size-4" />
              Notify ops
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button>
              <SlidersHorizontal className="size-4" />
              Controls
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone={adminAccessEnabled ? "success" : "warning"}>
              {adminAccessEnabled ? "Admin live" : "Flag off"}
            </Badge>
            {process.env.NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE === "true" ? (
              <Badge tone={source === "api" ? "success" : "info"}>
                {source === "api" ? "API data" : source === "disabled" ? "Setup preview" : "No API data"}
              </Badge>
            ) : null}
          </>
        }
        title="Digital Access command"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={adminAccessEnabled ? "success" : "warning"}>
            {adminAccessEnabled ? "Admin live" : "Flag off"}
          </Badge>
          <Badge tone="info">Fulfillment desk</Badge>
          <Badge tone="neutral">{requests.length} requests</Badge>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--ft-text-muted)] uppercase">
              Digital access command
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
              Review requests, service states, and catalog health from one controlled access desk.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Operators can inspect incoming requests and service readiness without switching out
              of the workflow console.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh desk
            </Button>
            <Button>
              <SlidersHorizontal className="size-4" />
              Open controls
            </Button>
          </div>
        </div>
        <div className="mt-6">
          <SummaryStatStrip
            items={[
              { label: "requests", value: loading ? "..." : String(requests.length), detail: "Live queue" },
              { label: "services", value: loading ? "..." : String(services.length), detail: "Catalog health" },
              { label: "metrics", value: loading ? "..." : String(metrics.length), detail: "Dashboard stats" },
              { label: "source", value: source === "api" ? "API" : "Cached", detail: "Telemetry mode" }
            ]}
          />
        </div>
      </section>

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

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                Incoming requests
              </h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Contact details are visible to operators.
              </p>
            </div>
            <div className="flex h-10 min-w-56 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search queue
            </div>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {loading ? (
              <PanelMessage label="Loading request queue" />
            ) : requests.length === 0 ? (
              <PanelMessage label="No requests yet" />
            ) : (
              requests.slice(0, 3).map((request) => (
                <div
                  className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"
                  key={request.id}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">
                      {request.service}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {request.customer} - {request.contact} - {request.age}
                    </div>
                  </div>
                  <RequestStatus request={request} />
                  <Button variant="secondary">Open</Button>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Workflow</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Wallet-paid manual fulfillment states.
              </p>
            </div>
            <CheckCircle2 className="size-5 text-[var(--ft-green)]" />
          </div>
          <div className="mt-5 grid gap-4">
            {timeline.map((item) => (
              <div className="grid grid-cols-[32px_1fr] gap-3" key={item.label}>
                <div className="flex size-8 items-center justify-center rounded-md bg-[var(--ft-bg-raised)]">
                  <item.icon className="size-4 text-[var(--ft-text-primary)]" />
                </div>
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{item.label}</div>
                  <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Catalog health</h2>
          <Badge tone="neutral">Drafts stay hidden from users</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {loading ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] xl:col-span-3">
              Loading catalog
            </Panel>
          ) : services.length === 0 ? (
            <Panel className="p-4 text-sm text-[var(--ft-text-muted)] xl:col-span-3">
              No services available
            </Panel>
          ) : (
            services.slice(0, 3).map((service) => (
              <Panel className="p-4" key={service.id}>
                <div className="flex items-center justify-between">
                  <ServiceStateBadge state={service.state} />
                  <div className="text-sm text-[var(--ft-text-muted)]">
                    {service.demand} requests
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                  {service.name}
                </h3>
                <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{service.category}</div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--ft-border)] pt-4 text-sm">
                  <span className="text-[var(--ft-text-muted)]">{service.plans} plans</span>
                  <span className="font-semibold text-[var(--ft-text-primary)]">
                    {service.startingPrice}
                  </span>
                </div>
              </Panel>
            ))
          )}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}

function PanelMessage({ label }: { label: string }) {
  return <div className="p-4 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
