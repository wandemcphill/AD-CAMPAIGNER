"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Boxes,
  FileSearch,
  Gift,
  Globe,
  LockKeyhole,
  Network,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Store,
  Users
} from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip, ThemeToggle } from "@fliptrybe/ui";

import { useApiSession } from "./lib/use-session";
import { useAdminDashboard } from "./use-admin-dashboard";
import { AdminAuthState } from "./ui/admin-auth-state";

export default function AdminPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const { data, error, isLoading, refresh } = useAdminDashboard();
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [selectedRail, setSelectedRail] = useState<string | null>(null);
  const metrics = data?.metrics ?? [];
  const queues = data?.queues ?? [];
  const moderation = data?.risk ?? [];
  const audits = data?.audits ?? [];
  const rails = data?.rails ?? [];
  const pendingReviews = metrics.find((metric) => metric.label === "Fraud signals")?.detail ?? "Loading";
  const selectedRailDetails = useMemo(
    () => rails.find((rail) => rail.name === selectedRail),
    [rails, selectedRail]
  );

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
    }
  }, [sessionLoading, session]);

  if (sessionLoading) {
    return <AdminAuthState loading />;
  }

  if (!session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={false} />;
  }

  return (
    <main className="ft-shell min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-4 xl:border-r xl:border-b-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[var(--ft-accent)] text-sm font-semibold text-[var(--ft-text-inverse)]">
              FA
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                FlipTrybe Admin
              </div>
              <div className="text-xs text-[var(--ft-text-muted)]">Governance console</div>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {[
              { label: "Overview", href: "/", icon: Radar },
              { label: "Moderation", href: "/campaign-ops/", icon: ShieldCheck },
              { label: "Payments", href: "/campaign-ops/reports/", icon: Banknote },
              { label: "Growth", href: "/growth-services/", icon: Boxes },
              { label: "Audit", href: "/campaign-ops/activity/", icon: FileSearch },
              { label: "Access", href: "/digital-access/", icon: LockKeyhole },
              { label: "VTU", href: "/vtu/", icon: Smartphone },
              { label: "Digital Products", href: "/digital-products/", icon: Globe },
              { label: "Rewards", href: "/rewards/", icon: Gift },
              { label: "Marketplace", href: "/marketplace/applications/", icon: Store }
            ].map((item) => (
              <a
                className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                href={item.href}
                key={item.label}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <ThemeToggle className="mt-4 w-full justify-center" />
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">Systems nominal</Badge>
                <button
                  className="rounded-[var(--radius-sm)]"
                  onBlur={() => setTelemetryOpen(false)}
                  onClick={() => setTelemetryOpen((value) => !value)}
                  onFocus={() => setTelemetryOpen(true)}
                  onMouseEnter={() => setTelemetryOpen(true)}
                  onMouseLeave={() => setTelemetryOpen(false)}
                  type="button"
                >
                  <Badge tone={data?.source === "partial" ? "warning" : "info"}>
                    {data?.source === "partial" ? "Partial telemetry" : "API telemetry"}
                  </Badge>
                </button>
              </div>
              {telemetryOpen ? (
                <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-sm text-[var(--ft-text-secondary)]">
                  <div className="font-medium text-[var(--ft-text-primary)]">Telemetry detail</div>
                  <div className="mt-2 grid gap-1">
                    <div>Payments: {data?.source === "api" ? "live" : "delayed 4m"}</div>
                    <div>Campaign queue: {queues.length > 0 ? "OK" : "waiting"}</div>
                    <div>Audit trail: {audits.length > 0 ? "OK" : "waiting"}</div>
                  </div>
                </div>
              ) : null}
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
                Operations command
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                Monitor campaign health, billing rails, moderation, and access desks from one
                control surface.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary">
                <Bell className="size-4" />
                Notify team
              </Button>
              <Button disabled={isLoading} onClick={() => void refresh()}>
                <RefreshCcw className="size-4" />
                Refresh
              </Button>
            </div>
          </header>

          <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Admin command layer</Badge>
              <Badge tone="neutral">Live telemetry</Badge>
              <Badge tone={data?.source === "partial" ? "warning" : "success"}>
                {data?.source === "partial" ? "Partial data" : "Connected"}
              </Badge>
            </div>
            <div className="mt-5">
              <SummaryStatStrip
                items={[
                  { label: "queues", value: String(queues.length) },
                  { label: "risk items", value: String(moderation.length) },
                  { label: "audits", value: String(audits.length) },
                  { label: "fraud signals", value: String(pendingReviews) }
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
                <MetricCard label="Active users" value="Loading" detail="Waiting for API telemetry" />
                <MetricCard label="Payment volume" value="Loading" detail="Waiting for payment telemetry" />
                <MetricCard label="Fraud signals" value="Loading" detail={pendingReviews} />
                <MetricCard label="Queue depth" value="Loading" detail="Waiting for queue telemetry" />
              </>
            )}
          </section>

          {error ? (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                    System monitoring
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                    API, queues, providers, and realtime channels.
                  </p>
                </div>
                <Network className="size-5 text-[var(--ft-blue)]" />
              </div>

              <div className="mt-5 grid gap-3">
                {queues.map((queue) => (
                  <div
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                    key={queue.name}
                  >
                    <div className="font-medium text-[var(--ft-text-primary)]">{queue.name}</div>
                    <div className="text-sm text-[var(--ft-text-muted)]">{queue.depth} jobs</div>
                    <Badge tone={queue.status === "healthy" ? "success" : "warning"}>
                      {queue.status}
                    </Badge>
                  </div>
                ))}
                {queues.length === 0 ? (
                  <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 text-sm text-[var(--ft-text-muted)]">
                    Queue telemetry will appear here when the admin APIs respond.
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Risk desk</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
                    Moderation, fraud, disputes, and suspicious activity.
                  </p>
                </div>
                <AlertTriangle className="size-5 text-[var(--ft-accent)]" />
              </div>

              <div className="mt-5 divide-y divide-[var(--ft-border)]">
                {moderation.map((item) => (
                  <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]" key={item.item}>
                    <div>
                      <div className="font-medium text-[var(--ft-text-primary)]">{item.item}</div>
                      <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{item.reason}</div>
                    </div>
                    <Badge
                      tone={
                        item.risk === "High"
                          ? "danger"
                          : item.risk === "Medium"
                            ? "warning"
                            : "success"
                      }
                    >
                      {item.risk}
                    </Badge>
                  </div>
                ))}
                {moderation.length === 0 ? (
                  <div className="py-6 text-sm text-[var(--ft-text-muted)]">
                    No campaign risks returned by the API.
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Panel className="p-4">
              <Users className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                User management
              </h2>
              <div className="mt-3 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
                <div className="flex justify-between">
                  <span>New accounts</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">842</span>
                </div>
                <div className="flex justify-between">
                  <span>Suspended</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">13</span>
                </div>
                <div className="flex justify-between">
                  <span>Team invites</span>
                  <span className="font-medium text-[var(--ft-text-primary)]">91</span>
                </div>
              </div>
            </Panel>

            <Panel className="p-4">
              <Banknote className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                Fee controls
              </h2>
              <div className="mt-4 grid gap-3">
                {rails.map((rail) => (
                  <button
                    className={`flex h-10 items-center justify-between rounded-md border px-3 text-sm transition ${
                      selectedRail === rail.name
                        ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
                        : "border-[var(--ft-border)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
                    }`}
                    key={rail.name}
                    onClick={() => setSelectedRail(rail.name)}
                    type="button"
                  >
                    <span>{rail.name}</span>
                    <span className="font-medium text-[var(--ft-text-primary)]">{rail.status}</span>
                  </button>
                ))}
                {rails.length === 0 ? (
                  <div className="rounded-md border border-[var(--ft-border)] px-3 py-3 text-sm text-[var(--ft-text-muted)]">
                    Payment rail status is waiting on admin telemetry.
                  </div>
                ) : null}
              </div>
              {selectedRailDetails ? (
                <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]">
                  <div className="font-medium text-[var(--ft-text-primary)]">{selectedRailDetails.name}</div>
                  <div className="mt-1">Masked secret: ************</div>
                  <div>Webhook: healthy</div>
                  <div>Last successful transaction: just now</div>
                </div>
              ) : null}
            </Panel>

            <Panel className="p-4">
              <FileSearch className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
                Audit trail
              </h2>
              <div className="mt-4 space-y-3">
                {audits.map((audit) => (
                  <div
                    className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]"
                    key={audit}
                  >
                    {audit}
                  </div>
                ))}
                {audits.length === 0 ? (
                  <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-muted)]">
                    Audit activity will appear after the first workspace event.
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}
