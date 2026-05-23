"use client";

import { Bell, CheckCircle2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
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
            <Badge tone={source === "api" ? "success" : "info"}>
              {source === "api" ? "API data" : source === "disabled" ? "Demo mode" : "Fallback"}
            </Badge>
          </>
        }
        title="Digital Access command"
      />

      {error ? (
        <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

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
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Incoming requests</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Contact details are visible to operators.
              </p>
            </div>
            <div className="flex h-10 min-w-56 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              Search queue
            </div>
          </div>
          <div className="divide-y divide-zinc-200">
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
                    <div className="font-medium text-zinc-950">{request.service}</div>
                    <div className="mt-1 text-sm text-zinc-500">
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
              <h2 className="text-lg font-semibold text-zinc-950">Workflow</h2>
              <p className="mt-1 text-sm text-zinc-500">Wallet-paid manual fulfillment states.</p>
            </div>
            <CheckCircle2 className="size-5 text-green-600" />
          </div>
          <div className="mt-5 grid gap-4">
            {timeline.map((item) => (
              <div className="grid grid-cols-[32px_1fr] gap-3" key={item.label}>
                <div className="flex size-8 items-center justify-center rounded-md bg-zinc-100">
                  <item.icon className="size-4 text-zinc-950" />
                </div>
                <div>
                  <div className="font-medium text-zinc-950">{item.label}</div>
                  <div className="mt-1 text-sm text-zinc-500">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">Catalog health</h2>
          <Badge tone="neutral">Drafts stay hidden from users</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {loading ? (
            <Panel className="p-4 text-sm text-zinc-500 xl:col-span-3">Loading catalog</Panel>
          ) : services.length === 0 ? (
            <Panel className="p-4 text-sm text-zinc-500 xl:col-span-3">No services available</Panel>
          ) : (
            services.slice(0, 3).map((service) => (
              <Panel className="p-4" key={service.id}>
                <div className="flex items-center justify-between">
                  <ServiceStateBadge state={service.state} />
                  <div className="text-sm text-zinc-500">{service.demand} requests</div>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950">{service.name}</h3>
                <div className="mt-1 text-sm text-zinc-500">{service.category}</div>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-sm">
                  <span className="text-zinc-500">{service.plans} plans</span>
                  <span className="font-semibold text-zinc-950">{service.startingPrice}</span>
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
  return <div className="p-4 text-sm text-zinc-500">{label}</div>;
}
