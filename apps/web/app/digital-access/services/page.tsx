import { Filter, Search } from "lucide-react";

import { Badge, Panel } from "@fliptrybe/ui";

import { DigitalAccessShell, PageHeader } from "../components";
import { categories, services } from "../data";
import { RequestAccessButton } from "../request-modal";

export default function DigitalAccessServicesPage() {
  return (
    <DigitalAccessShell active="/digital-access/services">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              Search services
            </div>
            <button className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700">
              <Filter className="size-4" />
              Filters
            </button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Service catalog</Badge>
            <Badge tone="neutral">Admin priced</Badge>
          </>
        }
        title="Services"
      />

      <section className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700"
            key={category.slug}
          >
            <category.icon className={`size-4 ${category.tone}`} />
            {category.label}
          </button>
        ))}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <Panel className="p-4" key={service.id}>
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-md bg-zinc-100">
                <service.icon className="size-5 text-zinc-950" />
              </div>
              <Badge tone={service.featured ? "success" : "neutral"}>
                {service.featured ? "Featured" : service.deliveryEta}
              </Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-950">{service.name}</h2>
            <p className="mt-2 min-h-16 text-sm leading-6 text-zinc-500">{service.description}</p>
            <div className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Starting price</span>
                <span className="font-semibold text-zinc-950">{service.startingPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Delivery ETA</span>
                <span className="font-medium text-zinc-950">{service.deliveryEta}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Plans</span>
                <span className="font-medium text-zinc-950">{service.plans.length}</span>
              </div>
            </div>
            <div className="mt-4">
              <RequestAccessButton plans={service.plans} serviceName={service.name} />
            </div>
          </Panel>
        ))}
      </section>
    </DigitalAccessShell>
  );
}
