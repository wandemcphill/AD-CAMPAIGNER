import { BadgeDollarSign, Save } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader } from "../components";
import { pricingRows } from "../data";

export default function AdminOtpPricingPage() {
  return (
    <AdminOtpShell active="/otp/pricing">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Margin rules</Badge>}
        title="Pricing"
        action={
          <Button>
            <Save className="size-4" /> Update pricing
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Panel className="p-4">
          <BadgeDollarSign className="size-5 text-[var(--ft-text-primary)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
            Global guardrails
          </h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Minimum margin
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                defaultValue="NGN 75"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              High-risk surcharge
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                defaultValue="12%"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Auto-reprice interval
              <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]">
                <option>15 minutes</option>
                <option>30 minutes</option>
                <option>Hourly</option>
              </select>
            </label>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_0.8fr_0.6fr_0.5fr_0.6fr_0.6fr] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
            <div>Service</div>
            <div>Mode</div>
            <div>Base</div>
            <div>Markup</div>
            <div>User price</div>
            <div>Margin</div>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {pricingRows.map((row) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[1fr_0.8fr_0.6fr_0.5fr_0.6fr_0.6fr] lg:items-center"
                key={`${row.service}-${row.country}`}
              >
                <div>
                  <div className="font-semibold text-[var(--ft-text-primary)]">{row.service}</div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{row.country}</div>
                </div>
                <Badge tone="neutral">Auto</Badge>
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  Base{" "}
                  <span className="font-semibold text-[var(--ft-text-primary)]">{row.base}</span>
                </div>
                <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                  {row.markup}
                </div>
                <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                  {row.user}
                </div>
                <div className="font-mono text-sm text-[var(--ft-green)]">{row.margin}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminOtpShell>
  );
}
