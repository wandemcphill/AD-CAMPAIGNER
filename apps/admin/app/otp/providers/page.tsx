import { PauseCircle, PlayCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, ProviderBadge } from "../components";
import { providers } from "../data";

export default function AdminOtpProvidersPage() {
  return (
    <AdminOtpShell active="/otp/providers">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Provider routing</Badge>}
        title="Providers"
        action={
          <Button>
            <PlayCircle className="size-4" /> Add route
          </Button>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
          <div>Provider</div>
          <div>State</div>
          <div>Fill</div>
          <div>Latency</div>
          <div>Stock</div>
          <div>Refund</div>
          <div>Action</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {providers.map((provider) => (
            <div
              className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] xl:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] xl:items-center"
              key={provider.name}
            >
              <div>
                <div className="font-semibold text-[var(--ft-text-primary)]">{provider.name}</div>
                <div className="text-sm text-[var(--ft-text-muted)]">
                  {provider.spend} processed today
                </div>
              </div>
              <ProviderBadge state={provider.state} />
              <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">{provider.fill}</span>{" "}
                fill
              </div>
              <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">
                  {provider.latency}
                </span>{" "}
                latency
              </div>
              <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">
                  {provider.stock}
                </span>{" "}
                stock
              </div>
              <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">
                  {provider.refund}
                </span>{" "}
                refund
              </div>
              <Button
                className="px-3"
                variant={provider.state === "paused" ? "secondary" : "ghost"}
              >
                <PauseCircle className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
