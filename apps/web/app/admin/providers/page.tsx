"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock, Server, XCircle } from "lucide-react";

import { Badge } from "@fliptrybe/ui";
import { StatusDot } from "@fliptrybe/ui/components";

type Provider = {
  id: string;
  name: string;
  type: string;
  status: "healthy" | "degraded" | "down";
  latency: string;
  uptime: string;
  lastChecked: string;
  endpoints: Array<{ name: string; status: "healthy" | "degraded" | "down"; latency: string }>;
};

const MOCK_PROVIDERS: Provider[] = [
  {
    id: "1", name: "Korapay", type: "Payment Gateway", status: "healthy", latency: "142ms", uptime: "99.97%", lastChecked: "30s ago",
    endpoints: [
      { name: "Checkout", status: "healthy", latency: "120ms" },
      { name: "Webhooks", status: "healthy", latency: "89ms" },
      { name: "Disbursement", status: "healthy", latency: "210ms" },
    ],
  },
  {
    id: "2", name: "Paystack", type: "Payment Gateway", status: "degraded", latency: "2.1s", uptime: "99.82%", lastChecked: "30s ago",
    endpoints: [
      { name: "Charge", status: "degraded", latency: "2.1s" },
      { name: "Verify", status: "healthy", latency: "180ms" },
      { name: "Transfer", status: "healthy", latency: "320ms" },
    ],
  },
  {
    id: "3", name: "VTPass", type: "Digital Products", status: "healthy", latency: "340ms", uptime: "99.91%", lastChecked: "1m ago",
    endpoints: [
      { name: "Airtime", status: "healthy", latency: "280ms" },
      { name: "Data", status: "healthy", latency: "340ms" },
      { name: "Electricity", status: "healthy", latency: "410ms" },
    ],
  },
  {
    id: "4", name: "Reloadly", type: "Gift Cards", status: "down", latency: "—", uptime: "98.5%", lastChecked: "30s ago",
    endpoints: [
      { name: "Catalog", status: "down", latency: "—" },
      { name: "Orders", status: "down", latency: "—" },
    ],
  },
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
};

export default function ProvidersPage() {
  const healthyCount = MOCK_PROVIDERS.filter((p) => p.status === "healthy").length;
  const degradedCount = MOCK_PROVIDERS.filter((p) => p.status === "degraded").length;
  const downCount = MOCK_PROVIDERS.filter((p) => p.status === "down").length;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Provider Monitoring</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Real-time health dashboard for all service providers</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--ft-text-muted)]">
          <Activity className="size-4" />
          Auto-refreshing every 30s
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Healthy", count: healthyCount, icon: CheckCircle2, color: "var(--ft-green)" },
          { label: "Degraded", count: degradedCount, icon: AlertTriangle, color: "var(--ft-yellow)" },
          { label: "Down", count: downCount, icon: XCircle, color: "var(--ft-red)" },
        ].map((s) => (
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4" key={s.label}>
            <s.icon className="size-5" style={{ color: s.color }} />
            <div>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-xs text-[var(--ft-text-muted)]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Provider cards */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {MOCK_PROVIDERS.map((provider) => (
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5"
            key={provider.id}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="size-5 text-[var(--ft-text-secondary)]" />
                <div>
                  <div className="font-semibold">{provider.name}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">{provider.type}</div>
                </div>
              </div>
              <Badge tone={STATUS_TONE[provider.status] ?? "neutral"}>
                <StatusDot status={provider.status} />
                {provider.status}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3">
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Latency</div>
                <div className="font-mono text-sm font-medium">{provider.latency}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Uptime</div>
                <div className="font-mono text-sm font-medium">{provider.uptime}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--ft-text-muted)]">Last check</div>
                <div className="flex items-center gap-1 font-mono text-sm font-medium">
                  <Clock className="size-3" />{provider.lastChecked}
                </div>
              </div>
            </div>

            <div className="mt-3 divide-y divide-[var(--ft-border)]">
              {provider.endpoints.map((ep) => (
                <div className="flex items-center justify-between py-2" key={ep.name}>
                  <div className="flex items-center gap-2 text-sm">
                    <StatusDot status={ep.status} />
                    {ep.name}
                  </div>
                  <span className="font-mono text-xs text-[var(--ft-text-muted)]">{ep.latency}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
