import { Activity, BarChart3, TrendingUp } from "lucide-react";

import { Badge, MetricCard, Panel } from "@fliptrybe/ui";

import { AdminDigitalAccessShell, AdminPageHeader } from "../components";
import { metrics, services } from "../data";

const bars = [42, 31, 28, 18, 14, 9];

export default function AdminDigitalAccessAnalyticsPage() {
  return (
    <AdminDigitalAccessShell active="/digital-access/analytics">
      <AdminPageHeader
        eyebrow={
          <>
            <Badge tone="info">Demand insights</Badge>
            <Badge tone="success">Fulfillment tracking</Badge>
          </>
        }
        title="Digital Access analytics"
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

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Service demand</h2>
              <p className="mt-1 text-sm text-zinc-500">Top requested services this week.</p>
            </div>
            <BarChart3 className="size-5 text-sky-600" />
          </div>
          <div className="mt-5 flex h-56 items-end gap-3">
            {bars.map((height, index) => (
              <div className="flex flex-1 flex-col items-center gap-2" key={height}>
                <div
                  className="w-full rounded-t-md bg-zinc-950"
                  style={{ height: `${Math.max(20, height * 3)}px` }}
                />
                <div className="text-xs text-zinc-500">{index + 1}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Top categories</h2>
              <p className="mt-1 text-sm text-zinc-500">Demand, conversion, and queue pressure.</p>
            </div>
            <TrendingUp className="size-5 text-green-600" />
          </div>
          <div className="mt-5 divide-y divide-zinc-200">
            {services.slice(0, 5).map((service) => (
              <div className="grid grid-cols-[1fr_auto] gap-3 py-3" key={service.id}>
                <div>
                  <div className="font-medium text-zinc-950">{service.name}</div>
                  <div className="mt-1 text-sm text-zinc-500">{service.category}</div>
                </div>
                <Badge tone={service.demand > 30 ? "success" : "info"}>
                  {service.demand} requests
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel className="mt-6 p-4">
        <div className="flex items-center gap-2 font-semibold text-zinc-950">
          <Activity className="size-5 text-orange-600" />
          Operational analytics
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Track service demand, conversion, refund rate, fulfillment time, top plans, and customer
          return behavior without exposing internal fulfillment workflows.
        </p>
      </Panel>
    </AdminDigitalAccessShell>
  );
}
