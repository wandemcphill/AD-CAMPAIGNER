"use client";

import { ImagePlus, Plus, RefreshCw, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
  AdminEmptyState,
  AdminErrorNotice,
  AdminPageHeader,
  ServiceStateBadge
} from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

export default function AdminDigitalAccessServicesPage() {
  const { error, loading, refresh, services } = useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access/services">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search services
            </div>
            <Button>
              <Plus className="size-4" />
              Add service
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
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

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Service editor</h2>
          <div className="mt-5 grid gap-3">
            {["Service name", "Category", "Delivery ETA", "Thumbnail URL"].map((label) => (
              <label
                className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]"
                key={label}
              >
                {label}
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]" />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Description
              <textarea className="min-h-24 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary">
                <ImagePlus className="size-4" />
                Cloudinary
              </Button>
              <Button>Update service draft</Button>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3">
          {loading ? (
            <AdminEmptyState title="Loading services" detail="Refreshing the Digital Access catalog." />
          ) : services.length === 0 ? (
            <AdminEmptyState
              title="No services returned"
              detail="Configured Digital Access services will appear here after the admin API returns catalog rows."
            />
          ) : (
            services.map((service) => (
              <Panel className="p-4" key={service.id}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-[var(--ft-text-primary)]">
                        {service.name}
                      </h2>
                      <ServiceStateBadge state={service.state} />
                    </div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {service.category} - {service.eta}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                    {service.startingPrice}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary">Plans</Button>
                    <Button variant={service.state === "active" ? "danger" : "secondary"}>
                      {service.state === "active" ? "Pause" : "Activate"}
                    </Button>
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}
