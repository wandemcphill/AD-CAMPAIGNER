import {
  AlertTriangle,
  Banknote,
  Bell,
  Boxes,
  FileSearch,
  LockKeyhole,
  Network,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  Users
} from "lucide-react";

import { Badge, Button, MetricCard, Panel, ThemeToggle } from "@fliptrybe/ui";

const queues = [
  { name: "campaigns", depth: 18, status: "healthy" },
  { name: "smm fulfillment", depth: 43, status: "healthy" },
  { name: "notifications", depth: 9, status: "healthy" },
  { name: "analytics ingestion", depth: 126, status: "watch" }
];

const moderation = [
  { item: "TikTok LIVE boost", risk: "Medium", reason: "Destination freshness" },
  { item: "Manual bank transfer", risk: "High", reason: "Payment proof review" },
  { item: "Supplier API order", risk: "Low", reason: "Velocity anomaly" }
];

const audits = [
  "campaign.created by Demo Operator",
  "payment.completed via mock-payments",
  "wallet.hold.created for campaign reserve",
  "team.invitation.sent to finance ops"
];

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-[var(--ft-accent)] text-sm font-semibold text-[var(--ft-text-inverse)]">
              FA
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">FlipTrybe Admin</div>
              <div className="text-xs text-[var(--ft-text-muted)]">Governance console</div>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {[
              { label: "Overview", icon: Radar },
              { label: "Moderation", icon: ShieldCheck },
              { label: "Payments", icon: Banknote },
              { label: "Suppliers", icon: Boxes },
              { label: "Audit", icon: FileSearch },
              { label: "Access", icon: LockKeyhole }
            ].map((item) => (
              <button
                className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                key={item.label}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <ThemeToggle className="mt-4 w-full justify-center" />
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">Systems nominal</Badge>
                <Badge tone="warning">18 moderation items</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
                Operations command
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary">
                <Bell className="size-4" />
                Notify team
              </Button>
              <Button>
                <SlidersHorizontal className="size-4" />
                Controls
              </Button>
            </div>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active users" value="18.4k" detail="+9.2% weekly growth" tone="success" />
            <MetricCard label="Payment volume" value="NGN 482.5M" detail="Mock ledger reconciled" />
            <MetricCard label="Fraud signals" value="7" detail="2 require escalation" tone="warning" />
            <MetricCard label="Queue depth" value="196" detail="All workers healthy" tone="info" />
          </section>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">System monitoring</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-muted)]">API, queues, providers, and realtime channels.</p>
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
                    <Badge tone={queue.status === "healthy" ? "success" : "warning"}>{queue.status}</Badge>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Risk desk</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Moderation, fraud, disputes, and suspicious activity.</p>
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
                    <Badge tone={item.risk === "High" ? "danger" : item.risk === "Medium" ? "warning" : "success"}>
                      {item.risk}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Panel className="p-4">
              <Users className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">User management</h2>
              <div className="mt-3 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
                <div className="flex justify-between"><span>New accounts</span><span className="font-medium text-[var(--ft-text-primary)]">842</span></div>
                <div className="flex justify-between"><span>Suspended</span><span className="font-medium text-[var(--ft-text-primary)]">13</span></div>
                <div className="flex justify-between"><span>Team invites</span><span className="font-medium text-[var(--ft-text-primary)]">91</span></div>
              </div>
            </Panel>

            <Panel className="p-4">
              <Banknote className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">Fee controls</h2>
              <div className="mt-4 grid gap-3">
                {["Korapay", "Paystack", "Stripe", "Manual transfer"].map((rail) => (
                  <div className="flex h-10 items-center justify-between rounded-md border border-[var(--ft-border)] px-3 text-sm text-[var(--ft-text-secondary)]" key={rail}>
                    <span>{rail}</span>
                    <span className="font-medium text-[var(--ft-text-primary)]">adapter</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <FileSearch className="size-5 text-[var(--ft-text-primary)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">Audit trail</h2>
              <div className="mt-4 space-y-3">
                {audits.map((audit) => (
                  <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]" key={audit}>
                    {audit}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}
