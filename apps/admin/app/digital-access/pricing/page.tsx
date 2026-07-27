"use client";

import { Calculator, CheckCircle2, RefreshCw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  AdminDigitalAccessShell,
  AdminEmptyState,
  AdminErrorNotice,
  AdminPageHeader,
  ServiceStateBadge
} from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

export default function AdminDigitalAccessPricingPage() {
  const { error, loading, refresh, services } = useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access/pricing">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button>
              <CheckCircle2 className="size-4" />
              Publish selected
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Pricing controls</Badge>
            <Badge tone="warning">Inactive seeds require review</Badge>
          </>
        }
        title="Plans and pricing"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
            <Calculator className="size-5 text-[var(--ft-blue)]" />
            Plan editor
          </div>
          <div className="mt-5 grid gap-3">
            {["Plan name", "Duration", "Price in NGN"].map((label) => (
              <label
                className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]"
                key={label}
              >
                {label}
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]" />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Plan description
              <textarea className="min-h-24 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]" />
            </label>
            <Button>Update plan draft</Button>
          </div>
        </Panel>

        <div className="grid gap-3">
          {loading ? (
            <AdminEmptyState title="Loading pricing" detail="Refreshing Digital Access service plans." />
          ) : services.length === 0 ? (
            <AdminEmptyState
              title="No pricing rows returned"
              detail="Service plan counts and starting prices will appear after the admin catalog API responds."
            />
          ) : (
            services.map((service) => (
              <Panel className="p-4" key={service.id}>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <div className="font-semibold text-[var(--ft-text-primary)]">
                      {service.name}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {service.plans} plans - {service.eta}
                    </div>
                  </div>
                  <ServiceStateBadge state={service.state} />
                  <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                    {service.startingPrice}
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
