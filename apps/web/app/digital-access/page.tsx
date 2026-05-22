import { ArrowRight, Clock, Search, ShieldCheck, Wallet } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { DigitalAccessShell, PageHeader } from "./components";
import { accessEnabled, categories, requests, services } from "./data";
import { RequestAccessButton } from "./request-modal";

export default function DigitalAccessPage() {
  const featured = services.filter((service) => service.featured);

  return (
    <DigitalAccessShell active="/digital-access">
      <PageHeader
        action={
          <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
            <Search className="size-4" />
            Search creator tools
          </div>
        }
        eyebrow={
          <>
            <Badge tone={accessEnabled ? "success" : "warning"}>
              {accessEnabled ? "Requests open" : "Admin setup mode"}
            </Badge>
            <Badge tone="info">Manual fulfillment</Badge>
          </>
        }
        title="Digital Access Hub"
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Wallet model" value="Upfront" detail="No escrow or peer-to-peer flows" />
        <MetricCard
          label="Fulfillment"
          value="Manual"
          detail="Handled by FlipTrybe operations"
          tone="info"
        />
        <MetricCard
          label="Refund safety"
          value="Auto"
          detail="Failed or cancelled requests reverse"
          tone="success"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Creator infrastructure</Badge>
            <Badge tone="info">Wallet-ready</Badge>
          </div>
          <h2 className="mt-6 max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
            Request premium tools and infrastructure from one clean operations desk.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
            Browse approved services, submit a wallet-paid request, and track manual fulfillment
            without exposing operational details or provider internals.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="bg-white text-zinc-950 hover:bg-zinc-100">
              Browse Services
              <ArrowRight className="size-4" />
            </Button>
            <Button
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              variant="secondary"
            >
              View Requests
            </Button>
          </div>
        </div>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Request queue</h2>
              <p className="mt-1 text-sm text-zinc-500">Live state from the fulfillment desk.</p>
            </div>
            <ShieldCheck className="size-5 text-green-600" />
          </div>
          <div className="mt-5 divide-y divide-zinc-200">
            {requests.map((request) => (
              <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto]" key={request.id}>
                <div>
                  <div className="font-medium text-zinc-950">{request.service}</div>
                  <div className="mt-1 text-sm text-zinc-500">{request.updatedAt}</div>
                </div>
                <div className="text-sm font-medium text-zinc-700">{request.amount}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">Categories</h2>
          <Badge tone="neutral">Admin-controlled catalog</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => (
            <Panel className="p-4" key={category.slug}>
              <category.icon className={`size-5 ${category.tone}`} />
              <div className="mt-4 font-semibold text-zinc-950">{category.label}</div>
              <div className="mt-1 text-sm text-zinc-500">
                {services.filter((service) => service.category === category.slug).length} services
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">Featured access</h2>
          <Badge tone="success">Fast manual review</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {featured.map((service) => (
            <Panel className="p-4" key={service.id}>
              <div className="flex items-start justify-between">
                <service.icon className="size-5 text-zinc-950" />
                <Badge tone="info">{service.deliveryEta}</Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950">{service.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-500">{service.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{service.startingPrice}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="size-3" />
                    {service.plans.length} plans
                  </div>
                </div>
                <RequestAccessButton plans={service.plans} serviceName={service.name} />
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <div className="flex items-center gap-2 font-semibold text-zinc-950">
            <Wallet className="size-5 text-sky-600" />
            Wallet payment
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Requests are paid upfront from your FlipTrybe wallet and automatically reversed if the
            admin team marks them failed or cancelled.
          </p>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 font-semibold text-zinc-950">
            <ShieldCheck className="size-5 text-green-600" />
            Operational privacy
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            The storefront shows service details, pricing, ETA, and request state only. Fulfillment
            methods stay inside the admin desk.
          </p>
        </Panel>
      </section>
    </DigitalAccessShell>
  );
}
