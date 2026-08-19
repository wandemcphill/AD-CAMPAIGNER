"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, RefreshCcw, Trash2 } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

type PricingSource = "SYNC" | "MANUAL";

type EducationPlan = {
  id: string;
  providerName: string;
  productCode: string;
  displayName: string;
  costMinor: number;
  currency: string;
  active: boolean;
  pricingSource: PricingSource;
  lastSyncedAt: string;
  updatedAt: string;
};

// Providers whose exam-PIN catalog cannot be discovered automatically. SirpData
// has no pricing endpoint at all — its documented API returns cost only as
// `amountCharged` on the purchase response, after the money is spent — so its
// plans exist ONLY if entered here. TopupWizard is listed as a suggestion for
// the provider field but its prices normally come from
// education_catalog_sync; a MANUAL row here still overrides that going forward.
const SUGGESTED_PROVIDERS = ["sirpdata", "topupwizard"];

// SirpData's documented examType values (Native API Documentation | SIRP DATA,
// Educational PINs, retrieved 2026-08-15). Kept here only to prefill the form —
// the server enforces this same list for sirpdata (VtuService.adminUpsertEducationPlan
// / PROVIDER_EDUCATION_CODES) and will reject anything else regardless of the UI.
const SIRPDATA_PRODUCT_CODES = ["waec_pin", "neco_pin", "utme_pin", "nabteb_pin"];

function fmtNaira(minor: number) {
  return `₦${(minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function nairaInputToMinor(value: string) {
  const normalized = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.round(normalized * 100);
}

export default function AdminVtuEducationPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [plans, setPlans] = useState<EducationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const [providerName, setProviderName] = useState(SUGGESTED_PROVIDERS[0]!);
  const [productCode, setProductCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await apiRequest<EducationPlan[]>("/admin/vtu/education/plans");
      setPlans(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load education plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  const groups = useMemo(() => {
    const byProvider = new Map<string, EducationPlan[]>();
    for (const plan of plans) {
      const list = byProvider.get(plan.providerName) ?? [];
      list.push(plan);
      byProvider.set(plan.providerName, list);
    }
    for (const list of byProvider.values()) {
      list.sort((a, b) => a.productCode.localeCompare(b.productCode));
    }
    return [...byProvider.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plans]);

  async function submitPlan() {
    setFormError(undefined);
    const costMinor = nairaInputToMinor(priceInput);
    if (!providerName.trim()) {
      setFormError("Provider is required.");
      return;
    }
    if (!productCode.trim()) {
      setFormError("Product code is required.");
      return;
    }
    if (!displayName.trim()) {
      setFormError("Display name is required.");
      return;
    }
    if (costMinor <= 0) {
      setFormError("Enter a price greater than ₦0.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest<EducationPlan>("/admin/vtu/education/plans", {
        method: "PUT",
        body: JSON.stringify({
          providerName: providerName.trim(),
          productCode: productCode.trim(),
          displayName: displayName.trim(),
          costMinor
        })
      });
      setProductCode("");
      setDisplayName("");
      setPriceInput("");
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save this plan.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivatePlan(plan: EducationPlan) {
    setBusyId(plan.id);
    setError(undefined);
    try {
      await apiRequest<EducationPlan>(
        `/admin/vtu/education/plans/${encodeURIComponent(plan.id)}`,
        { method: "DELETE" }
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate this plan.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="VTU education auth" />;
  }

  return (
    <AdminShell active="/vtu/">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Education plan pricing</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/vtu/"
              className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              ← VTU routing
            </a>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          SYNC plans come from education_catalog_sync and are overwritten by the next run. MANUAL
          plans are entered here and the sync leaves them alone — the only path for a provider like
          SirpData, which sells exam PINs but publishes no pricing endpoint of its own, so its price
          is not knowable until an admin sets one.
        </p>

        {error && (
          <div className="mt-4 rounded border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <Panel className="mt-4 p-4">
          <div className="font-semibold text-[var(--ft-text-primary)]">Add or reprice a plan</div>
          <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
            Saving an existing (provider, product code) pair updates its price and marks it MANUAL.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-[var(--ft-text-secondary)]">
              Provider
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={saving}
                list="education-provider-suggestions"
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="sirpdata"
                value={providerName}
              />
              <datalist id="education-provider-suggestions">
                {SUGGESTED_PROVIDERS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-1 text-sm font-medium text-[var(--ft-text-secondary)]">
              Product code
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={saving}
                list={providerName.trim().toLowerCase() === "sirpdata" ? "education-code-suggestions" : undefined}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="waec_pin"
                value={productCode}
              />
              <datalist id="education-code-suggestions">
                {SIRPDATA_PRODUCT_CODES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-1 text-sm font-medium text-[var(--ft-text-secondary)]">
              Display name
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={saving}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="WAEC Result Checker PIN"
                value={displayName}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-[var(--ft-text-secondary)]">
              Price (₦)
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={saving}
                inputMode="decimal"
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="3450"
                value={priceInput}
              />
            </label>
          </div>

          {formError && <p className="mt-2 text-sm text-[var(--ft-red)]">{formError}</p>}

          <div className="mt-3 flex justify-end">
            <Button disabled={saving} onClick={() => void submitPlan()}>
              {saving ? "Saving…" : "Save plan"}
            </Button>
          </div>
        </Panel>

        <div className="mt-4 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading education plans…</Panel>
          ) : groups.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              No education plans yet. ClubKonnect and TopupWizard populate from
              education_catalog_sync; SirpData needs a MANUAL price entered above.
            </Panel>
          ) : (
            groups.map(([provider, providerPlans]) => (
              <Panel className="p-4" key={provider}>
                <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
                  {provider}
                  <span className="text-xs font-normal text-[var(--ft-text-muted)]">
                    {providerPlans.length} plan{providerPlans.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="flex items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)]">
                    <div className="w-32">Code</div>
                    <div className="flex-1">Name</div>
                    <div className="w-24 text-right">Price</div>
                    <div className="w-20">Source</div>
                    <div className="w-24">Status</div>
                    <div className="w-10" />
                  </div>
                  {providerPlans.map((plan) => (
                    <div
                      className="flex items-center gap-3 rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-sm"
                      key={plan.id}
                    >
                      <div className="w-32 truncate font-mono text-xs text-[var(--ft-text-muted)]" title={plan.productCode}>
                        {plan.productCode}
                      </div>
                      <div className="flex-1 truncate">{plan.displayName}</div>
                      <div className="w-24 text-right font-mono">{fmtNaira(plan.costMinor)}</div>
                      <div className="w-20">
                        <Badge tone={plan.pricingSource === "MANUAL" ? "info" : "neutral"}>
                          {plan.pricingSource === "MANUAL" ? "manual" : "sync"}
                        </Badge>
                      </div>
                      <div className="w-24">
                        {plan.active ? (
                          <Badge tone="success">active</Badge>
                        ) : (
                          <Badge tone="neutral">inactive</Badge>
                        )}
                      </div>
                      <div className="w-10 text-right">
                        {plan.active && (
                          <button
                            className="text-[var(--ft-text-muted)] hover:text-[var(--ft-red)] transition-colors disabled:opacity-50"
                            disabled={busyId === plan.id}
                            onClick={() => void deactivatePlan(plan)}
                            title="Deactivate"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
