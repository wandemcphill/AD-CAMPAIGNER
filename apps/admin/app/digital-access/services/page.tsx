import { ImagePlus, Plus, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminDigitalAccessShell, AdminPageHeader, ServiceStateBadge } from "../components";
import { services } from "../data";

export default function AdminDigitalAccessServicesPage() {
  return (
    <AdminDigitalAccessShell active="/digital-access/services">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              Search services
            </div>
            <Button>
              <Plus className="size-4" />
              Add service
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Dynamic catalog</Badge>
            <Badge tone="warning">Draft safe</Badge>
          </>
        }
        title="Service management"
      />

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <h2 className="text-lg font-semibold text-zinc-950">Service editor</h2>
          <div className="mt-5 grid gap-3">
            {["Service name", "Category", "Delivery ETA", "Thumbnail URL"].map((label) => (
              <label className="grid gap-2 text-sm font-medium text-zinc-700" key={label}>
                {label}
                <input className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950" />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Description
              <textarea className="min-h-24 rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-950" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary">
                <ImagePlus className="size-4" />
                Cloudinary
              </Button>
              <Button>Save draft</Button>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3">
          {services.map((service) => (
            <Panel className="p-4" key={service.id}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-950">{service.name}</h2>
                    <ServiceStateBadge state={service.state} />
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {service.category} · {service.eta}
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-950">{service.startingPrice}</div>
                <div className="flex gap-2">
                  <Button variant="secondary">Plans</Button>
                  <Button variant={service.state === "active" ? "danger" : "secondary"}>
                    {service.state === "active" ? "Pause" : "Activate"}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}
