"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, RefreshCw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  createAdminDigitalAccessPlan,
  loadAdminDigitalAccessPlans,
  updateAdminDigitalAccessPlan,
  type AdminDigitalAccessPlan
} from "../api";
import {
  AdminDigitalAccessShell,
  AdminEmptyState,
  AdminErrorNotice,
  AdminPageHeader,
  ServiceStateBadge
} from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

function priceToMinor(value: string) {
  const normalized = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.round(normalized * 100);
}

export default function AdminDigitalAccessPricingPage() {
  const { error, loading, refresh, services } = useAdminDigitalAccessData();
  const [selectedServiceId, setSelectedServiceId] = useState<string>();
  const [plans, setPlans] = useState<AdminDigitalAccessPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string>();

  const [planName, setPlanName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  async function loadPlans(serviceId: string) {
    setPlansLoading(true);
    setPlansError(undefined);
    try {
      setPlans(await loadAdminDigitalAccessPlans(serviceId));
    } catch (caught) {
      setPlansError(caught instanceof Error ? caught.message : "Could not load plans for this service.");
    } finally {
      setPlansLoading(false);
    }
  }

  useEffect(() => {
    if (selectedServiceId) void loadPlans(selectedServiceId);
  }, [selectedServiceId]);

  async function handleCreatePlan() {
    if (!selectedServiceId || !planName.trim() || !duration.trim()) {
      setSaveError("Choose a service, then fill in plan name and duration.");
      return;
    }
    setSaving(true);
    setSaveError(undefined);
    try {
      await createAdminDigitalAccessPlan({
        serviceId: selectedServiceId,
        planName: planName.trim(),
        duration: duration.trim(),
        priceMinor: priceToMinor(price)
      });
      setPlanName("");
      setDuration("");
      setPrice("");
      await loadPlans(selectedServiceId);
      await refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not create this plan.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePlanActive(plan: AdminDigitalAccessPlan) {
    setSaveError(undefined);
    try {
      await updateAdminDigitalAccessPlan(plan.id, { isActive: !plan.isActive });
      if (selectedServiceId) await loadPlans(selectedServiceId);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not update this plan.");
    }
  }

  return (
    <AdminDigitalAccessShell active="/digital-access/pricing/">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
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
          {!selectedServiceId ? (
            <p className="mt-3 text-sm text-[var(--ft-text-muted)]">
              Select a service from the list to manage its plans.
            </p>
          ) : (
            <>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Plan name
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    disabled={saving}
                    onChange={(event) => setPlanName(event.target.value)}
                    value={planName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Duration
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    disabled={saving}
                    onChange={(event) => setDuration(event.target.value)}
                    placeholder="e.g. 1 month, 30 days"
                    value={duration}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Price in NGN
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    disabled={saving}
                    inputMode="decimal"
                    onChange={(event) => setPrice(event.target.value)}
                    value={price}
                  />
                </label>
                {saveError ? (
                  <p className="text-sm text-[var(--ft-red)]">{saveError}</p>
                ) : null}
                <Button disabled={saving} onClick={() => void handleCreatePlan()}>
                  <Plus className="size-4" />
                  {saving ? "Adding..." : "Add plan"}
                </Button>
              </div>

              <div className="mt-5 grid gap-2">
                {plansLoading ? (
                  <p className="text-sm text-[var(--ft-text-muted)]">Loading plans...</p>
                ) : plansError ? (
                  <p className="text-sm text-[var(--ft-red)]">{plansError}</p>
                ) : plans.length === 0 ? (
                  <p className="text-sm text-[var(--ft-text-muted)]">No plans yet for this service.</p>
                ) : (
                  plans.map((plan) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded-md border border-[var(--ft-border)] p-2 text-sm"
                      key={plan.id}
                    >
                      <div>
                        <span className="font-medium text-[var(--ft-text-primary)]">{plan.planName}</span>
                        <span className="ml-2 text-xs text-[var(--ft-text-muted)]">
                          {plan.duration} · ₦{(plan.priceMinor / 100).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        className="h-7 px-2 text-xs"
                        onClick={() => void togglePlanActive(plan)}
                        variant={plan.isActive ? "secondary" : "primary"}
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
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
              <Panel
                className={`cursor-pointer p-4 ${selectedServiceId === service.id ? "border-[var(--ft-accent)]" : ""}`}
                key={service.id}
                onClick={() => setSelectedServiceId(service.id)}
              >
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
