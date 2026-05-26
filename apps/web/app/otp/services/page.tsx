import { Filter, Plus, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { OtpShell, PageHeader } from "../components";
import { services } from "../data";

export default function OtpServicesPage() {
  return (
    <OtpShell active="/otp/services">
      <PageHeader
        eyebrow={<Badge tone="info">Marketplace inventory</Badge>}
        title="Services"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Filter className="size-4" /> Filters
            </Button>
            <Button>
              <Plus className="size-4" /> New order
            </Button>
          </div>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--ft-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
            <Search className="size-4" />
            Search service or country
          </div>
          <Badge tone="success">Auto-priced</Badge>
        </div>
        <div className="hidden grid-cols-[1.2fr_0.8fr_0.65fr_0.65fr_0.65fr_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
          <div>Service</div>
          <div>Route</div>
          <div>Stock</div>
          <div>Success</div>
          <div>Median</div>
          <div>Price</div>
        </div>
        <div className="grid gap-0 divide-y divide-[var(--ft-border)]">
          {services.map((service) => (
            <div
              className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr_0.65fr_0.65fr_0.65fr_auto] lg:items-center"
              key={`${service.name}-${service.country}`}
            >
              <div>
                <div className="font-semibold text-[var(--ft-text-primary)]">{service.name}</div>
                <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{service.country}</div>
              </div>
              <Badge tone={service.tag === "Guarded" ? "warning" : "info"}>{service.tag}</Badge>
              <div className="text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">{service.stock}</span>{" "}
                numbers
              </div>
              <div className="text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">
                  {service.success}
                </span>{" "}
                success
              </div>
              <div className="text-sm text-[var(--ft-text-secondary)]">
                <span className="font-semibold text-[var(--ft-text-primary)]">{service.eta}</span>{" "}
                median
              </div>
              <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                {service.price}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </OtpShell>
  );
}
