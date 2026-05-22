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
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
            <Search className="size-4" />
            Search service or country
          </div>
          <Badge tone="success">Auto-priced</Badge>
        </div>
        <div className="grid gap-0 divide-y divide-zinc-200">
          {services.map((service) => (
            <div
              className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr_0.65fr_0.65fr_0.65fr_auto] lg:items-center"
              key={`${service.name}-${service.country}`}
            >
              <div>
                <div className="font-semibold text-zinc-950">{service.name}</div>
                <div className="mt-1 text-sm text-zinc-500">{service.country}</div>
              </div>
              <Badge tone={service.tag === "Guarded" ? "warning" : "info"}>{service.tag}</Badge>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{service.stock}</span> numbers
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{service.success}</span> success
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{service.eta}</span> median
              </div>
              <div className="text-sm font-semibold text-zinc-950">{service.price}</div>
            </div>
          ))}
        </div>
      </Panel>
    </OtpShell>
  );
}
