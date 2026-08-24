"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, FileSearch, Network, RefreshCcw, Users } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "./admin-shell";
import { useAdminDashboard } from "./use-admin-dashboard";

const QUICK_LINKS = [
  { label: "Campaign operations", href: "/campaign-ops/" },
  { label: "Users", href: "/users/" },
  { label: "Payments", href: "/campaign-ops/reports/" },
  { label: "Wallets", href: "/wallets/" },
  { label: "Products & Pricing", href: "/commercial/" },
  { label: "Providers", href: "/providers/" },
  { label: "Reconciliation", href: "/reconciliation/" },
  { label: "Audit", href: "/campaign-ops/activity/" }
];

export default function AdminPage() {
  const { data, error, isLoading, refresh } = useAdminDashboard();
  const metrics = data?.metrics ?? [];
  const queues = data?.queues ?? [];
  const risks = data?.risk ?? [];
  const audits = data?.audits ?? [];
  const providers = data?.providers ?? [];
  const healthyProviders = providers.filter((provider) => provider.healthy).length;

  return (
    <AdminShell active="/" subtitle="Operations command center">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data?.source === "api" ? "success" : "warning"}>
                {data?.source === "api" ? "Live API telemetry" : "Partial telemetry"}
              </Badge>
              <Badge tone="info">Platform administration</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
              Operations command
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              The control room for users, campaigns, money movement, product availability, provider health, and operator work.
            </p>
          </div>
          <Button disabled={isLoading} onClick={() => void refresh()} variant="secondary">
            <RefreshCcw className="size-4" />
            {isLoading ? "Refreshing" : "Refresh"}
          </Button>
        </header>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Command layer</Badge>
            <Badge tone={providers.length === 0 || healthyProviders === providers.length ? "success" : "warning"}>
              {providers.length === 0 ? "Provider health unavailable" : `${healthyProviders}/${providers.length} providers healthy`}
            </Badge>
          </div>
          <div className="mt-5">
            <SummaryStatStrip
              items={[
                { label: "open queues", value: String(queues.reduce((sum, queue) => sum + queue.depth, 0)) },
                { label: "risk items", value: String(risks.filter((item) => item.risk !== "Low").length) },
                { label: "providers", value: String(providers.length) },
                { label: "audit events", value: String(audits.length) }
              ]}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.length > 0 ? (
            metrics.map((metric) => (
              <MetricCard
                detail={metric.detail}
                key={metric.label}
                label={metric.label}
                tone={metric.tone}
                value={metric.value}
              />
            ))
          ) : (
            <>
              <MetricCard label="Users" value="Unavailable" detail="Waiting for admin telemetry" />
              <MetricCard label="Payment volume" value="Unavailable" detail="Waiting for admin telemetry" />
              <MetricCard label="Fraud signals" value="Unavailable" detail="Waiting for risk telemetry" />
              <MetricCard label="Operational queue" value="Unavailable" detail="Waiting for campaign operations telemetry" />
            </>
          )}
        </section>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Operational queues</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Work waiting for an operator or provider path.</p>
              </div>
              <Network className="size-5 text-[var(--ft-blue)]" />
            </div>

            <div className="mt-5 grid gap-3">
              {queues.map((queue) => (
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3" key={queue.name}>
                  <div className="font-medium text-[var(--ft-text-primary)]">{queue.name}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{queue.depth} items</div>
                  <Badge tone={queue.status === "healthy" ? "success" : "warning"}>{queue.status}</Badge>
                </div>
              ))}
              {queues.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-text-muted)]">
                  No queue telemetry is currently available.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Risk desk</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Exceptions surfaced from campaign operations.</p>
              </div>
              <AlertTriangle className="size-5 text-[var(--ft-accent)]" />
            </div>

            <div className="mt-5 divide-y divide-[var(--ft-border)]">
              {risks.map((item) => (
                <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]" key={`${item.item}-${item.reason}`}>
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{item.item}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{item.reason}</div>
                  </div>
                  <Badge tone={item.risk === "High" ? "danger" : item.risk === "Medium" ? "warning" : "success"}>
                    {item.risk}
                  </Badge>
                </div>
              ))}
              {risks.length === 0 ? <div className="py-6 text-sm text-[var(--ft-text-muted)]">No risk telemetry available.</div> : null}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
          <Panel className="p-4">
            <Users className="size-5 text-[var(--ft-text-primary)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">Account governance</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Search users, inspect memberships, and manage account status.</p>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)]" href="/users/">
              Open Users <ArrowRight className="size-4" />
            </Link>
          </Panel>

          <Panel className="p-4">
            <Banknote className="size-5 text-[var(--ft-text-primary)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">Money operations</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Payments, wallets, refunds, and reconciliation are kept behind dedicated desks.</p>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)]" href="/reconciliation/">
              Open Reconciliation <ArrowRight className="size-4" />
            </Link>
          </Panel>

          <Panel className="p-4">
            <FileSearch className="size-5 text-[var(--ft-text-primary)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">Audit trail</h2>
            <div className="mt-4 space-y-2">
              {audits.map((audit) => (
                <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]" key={audit}>
                  {audit}
                </div>
              ))}
              {audits.length === 0 ? <div className="text-sm text-[var(--ft-text-muted)]">No audit events returned.</div> : null}
            </div>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)]" href="/campaign-ops/activity/">
              Open Audit <ArrowRight className="size-4" />
            </Link>
          </Panel>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Admin workspaces</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Jump directly into the operational desks.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((item) => (
              <Link className="flex items-center justify-between rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm font-medium text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)] hover:text-[var(--ft-text-primary)]" href={item.href} key={item.href}>
                <span>{item.label}</span>
                <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
