"use client";

import { ArrowRight, Copy, Search, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { createOtpOrder } from "./api";
import { EmptyState, OtpShell, PageHeader, StatusBadge } from "./components";
import { useOtpDashboard } from "./use-otp-dashboard";

export default function OtpPage() {
  const { data, error, isLoading, refresh } = useOtpDashboard();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const services = data?.services ?? [];
  const orders = data?.orders ?? [];
  const quickStats = data?.quickStats ?? [];
  const selectedService = services[selectedIndex] ?? services[0];

  async function buyOtp() {
    if (!selectedService) {
      return;
    }

    setIsCreating(true);
    try {
      await createOtpOrder(selectedService);
      await refresh();
    } finally {
      setIsCreating(false);
    }
  }

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
            <Button disabled={!selectedService || isCreating} onClick={() => void buyOtp()}>
              <Smartphone className="size-4" />
              {isCreating ? "Buying..." : "Buy OTP"}
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
              <select
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
                value={selectedIndex}
              >
                {services.map((service, index) => (
                  <option key={`${service.name}-${service.country}`} value={index}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Country
              <select
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                disabled
                value={selectedService?.country ?? ""}
              >
                <option>{selectedService?.country ?? "Select a service"}</option>
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
          {error ? (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
              {error}
            </div>
          ) : null}
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
            {isLoading ? (
              <EmptyState
                title="Loading live OTP orders"
                detail="Checking your marketplace wallet and current provider queue."
              />
            ) : orders.length === 0 ? (
              <EmptyState
                title="No live OTP orders yet"
                detail="Buy a number to start a real verification order from the API-backed marketplace."
              />
            ) : (
              orders.slice(0, 4).map((order) => (
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
              ))
            )}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
