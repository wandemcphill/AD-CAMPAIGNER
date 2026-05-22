import { ArrowRight, Copy, Search, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { OtpShell, PageHeader, StatusBadge } from "./components";
import { orders, quickStats, services } from "./data";

export default function OtpPage() {
  return (
    <OtpShell active="/otp">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="success">Wallet funded</Badge>
            <Badge tone="info">Compliant beta routes</Badge>
          </>
        }
        title="OTP marketplace"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              Search service, country, order
            </div>
            <Button>
              <Smartphone className="size-4" />
              Buy OTP
            </Button>
          </div>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickStats.map((stat) => (
          <MetricCard
            detail={stat.detail}
            key={stat.label}
            label={stat.label}
            tone={stat.tone}
            value={stat.value}
          />
        ))}
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Fast purchase</h2>
              <p className="mt-1 text-sm text-zinc-500">Assign a number from healthy routes.</p>
            </div>
            <ShieldCheck className="size-5 text-green-600" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Service
              <select className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950">
                {services.map((service) => (
                  <option key={service.name}>{service.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Country
              <select className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950">
                {services.map((service) => (
                  <option key={service.country}>{service.country}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 grid gap-2">
            {services.slice(0, 3).map((service) => (
              <div
                className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                key={service.name}
              >
                <div>
                  <div className="font-medium text-zinc-950">{service.name}</div>
                  <div className="text-sm text-zinc-500">{service.country} route</div>
                </div>
                <div className="text-sm font-semibold text-zinc-950">{service.price}</div>
                <Badge tone="success">{service.success}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <h2 className="text-lg font-semibold text-zinc-950">Live orders</h2>
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 hover:text-zinc-950"
              href="/otp/orders"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-200">
            {orders.slice(0, 4).map((order) => (
              <Link
                className="grid gap-3 p-4 transition hover:bg-zinc-50 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                href={`/otp/orders/${order.id}`}
                key={order.id}
              >
                <div>
                  <div className="font-medium text-zinc-950">{order.service}</div>
                  <div className="text-sm text-zinc-500">{order.number}</div>
                </div>
                <StatusBadge status={order.status} />
                <Button className="pointer-events-none px-3" variant="secondary">
                  <Copy className="size-4" />
                </Button>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
