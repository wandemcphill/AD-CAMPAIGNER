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
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
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
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Buy a number</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                Choose a compliant route, then copy the OTP from your live order once it arrives.
              </p>
            </div>
            <ShieldCheck className="size-5 text-[var(--ft-green)]" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Service
              <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]">
                {services.map((service) => (
                  <option key={service.name}>{service.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Country
              <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]">
                {services.map((service) => (
                  <option key={service.country}>{service.country}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 grid gap-2">
            {services.slice(0, 3).map((service) => (
              <div
                className="grid gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                key={service.name}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{service.name}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{service.country} route</div>
                </div>
                <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                  {service.price}
                </div>
                <Badge tone="success">{service.success}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            Status guide: healthy routes show higher delivery confidence, pending orders are still waiting for an OTP,
            and expired orders should be replaced with a fresh number.
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Live orders</h2>
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
              href="/otp/orders"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {orders.slice(0, 4).map((order) => (
              <Link
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-muted)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
                href={`/otp/orders/${order.id}`}
                key={order.id}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{order.service}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{order.number}</div>
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
