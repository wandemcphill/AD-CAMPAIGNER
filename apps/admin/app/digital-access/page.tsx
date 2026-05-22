import { Bell, CheckCircle2, Search, SlidersHorizontal } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
  AdminPageHeader,
  RequestStatus,
  ServiceStateBadge
} from "./components";
import { adminAccessEnabled, metrics, requests, services, timeline } from "./data";

export default function AdminDigitalAccessPage() {
  return (
    <AdminDigitalAccessShell active="/digital-access">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Bell className="size-4" />
              Notify ops
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
            <Badge tone="info">Manual fulfillment</Badge>
          </>
        }
        title="Digital Access command"
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            value={metric.value}
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
            {requests.slice(0, 3).map((request) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"
                key={request.id}
              >
                <div>
                  <div className="font-medium text-zinc-950">{request.service}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {request.customer} · {request.contact} · {request.age}
                  </div>
                </div>
                <RequestStatus request={request} />
                <Button variant="secondary">Open</Button>
              </div>
            ))}
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
          {services.slice(0, 3).map((service) => (
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
          ))}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}
