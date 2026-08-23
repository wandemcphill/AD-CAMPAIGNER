"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Save, ShieldCheck } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";
import { AdminShell } from "../../../../admin-shell";
import { apiRequest } from "../../../../lib/api-client";
import { useApiSession } from "../../../../lib/use-session";
import { AdminAuthState } from "../../../../ui/admin-auth-state";

type GrowthService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  baseRate: { amount: number; currency: string };
  pricingModel: "PER_1000" | "FLAT";
  marginBps: number;
  maximumQuantity: number;
  expectedCompletion: string;
  supplierRouting: {
    strategy: string;
    preferredSupplier?: string;
    fallbackSuppliers: string[];
  };
  risk: {
    platformPolicyRisk: string;
    accountRisk: string;
    refundRisk: string;
    reputationRisk: string;
    summary: string;
  };
};

type Supplier = {
  name: string;
  configured: boolean;
  mode: string;
  routingRole: string;
};

export function GrowthProductEditorClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const hasCode = code.trim().length > 0;

  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [service, setService] = useState<GrowthService>();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [enabled, setEnabled] = useState(false);
  const [marginBps, setMarginBps] = useState(0);
  const [maximumQuantity, setMaximumQuantity] = useState(1);
  const [expectedCompletion, setExpectedCompletion] = useState("");
  const [preferredSupplier, setPreferredSupplier] = useState("");

  const refresh = useCallback(async () => {
    if (!hasCode) {
      setLoading(false);
      setError("No product code provided.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const [services, audit] = await Promise.all([
        apiRequest<GrowthService[]>("/admin/growth/services"),
        apiRequest<{ supportedProviders: Supplier[] }>("/admin/growth/supplier-audit")
      ]);
      const found = services.find((item) => item.code === decodeURIComponent(code));
      if (!found) throw new Error("Growth service not found.");
      setService(found);
      setSuppliers(audit.supportedProviders);
      setEnabled(found.enabled);
      setMarginBps(found.marginBps);
      setMaximumQuantity(found.maximumQuantity);
      setExpectedCompletion(found.expectedCompletion);
      setPreferredSupplier(found.supplierRouting.preferredSupplier ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load product.");
    } finally {
      setLoading(false);
    }
  }, [code, hasCode]);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  async function save() {
    if (!service) return;
    if (!Number.isInteger(marginBps) || marginBps < 0) {
      setError("Margin must be a non-negative whole number of basis points.");
      return;
    }
    if (!Number.isInteger(maximumQuantity) || maximumQuantity < 1) {
      setError("Maximum quantity must be at least 1.");
      return;
    }
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await apiRequest(`/admin/growth/services/${encodeURIComponent(service.code)}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled,
          marginBps,
          maximumQuantity,
          preferredSupplier,
          expectedCompletion
        })
      });
      setMessage("Commercial settings saved.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save commercial settings.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return (
      <AdminAuthState error={sessionError} loading={sessionLoading} title="Product editor auth" />
    );
  }

  return (
    <AdminShell active="/commercial/" subtitle="Product editor">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm text-[var(--ft-accent)] hover:underline"
              href="/commercial/products"
            >
              <ArrowLeft className="size-4" /> Back to catalogue
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="info">Growth</Badge>
              {service ? (
                <Badge tone={service.enabled ? "success" : "neutral"}>
                  {service.enabled ? "Customer visible" : "Disabled"}
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold">{service?.name ?? "Product editor"}</h1>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
              Commercial controls for service {code}.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>

        {error ? (
          <div className="mt-5 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-5 rounded-md border border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] p-3 text-sm text-[var(--ft-blue)]">
            {message}
          </div>
        ) : null}

        {loading ? (
          <Panel className="mt-6 p-6 text-sm text-[var(--ft-text-muted)]">
            Loading product controls…
          </Panel>
        ) : service ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <Panel className="p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">Commercial settings</h2>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Customer availability
                  <span className="flex h-11 items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3">
                    <input
                      checked={enabled}
                      className="size-4"
                      onChange={(event) => setEnabled(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="ml-2">{enabled ? "Enabled" : "Disabled"}</span>
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Margin (bps)
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3"
                    min={0}
                    step={100}
                    type="number"
                    value={marginBps}
                    onChange={(event) => setMarginBps(Number(event.target.value))}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Preferred supplier
                  <select
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3"
                    value={preferredSupplier}
                    onChange={(event) => setPreferredSupplier(event.target.value)}
                  >
                    <option value="">Auto route</option>
                    {suppliers.map((supplier) => (
                      <option
                        disabled={!supplier.configured}
                        key={supplier.name}
                        value={supplier.name}
                      >
                        {supplier.name}
                        {supplier.configured ? "" : " (not configured)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Maximum quantity
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3"
                    min={1}
                    type="number"
                    value={maximumQuantity}
                    onChange={(event) => setMaximumQuantity(Number(event.target.value))}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  Expected completion
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3"
                    value={expectedCompletion}
                    onChange={(event) => setExpectedCompletion(event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-6 flex justify-end">
                <Button disabled={saving} onClick={() => void save()}>
                  <Save className="size-4" /> {saving ? "Saving…" : "Save commercial settings"}
                </Button>
              </div>
            </Panel>

            <div className="grid gap-6">
              <Panel className="p-6">
                <h2 className="font-semibold">Current provider/routing state</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--ft-text-muted)]">Pricing model</span>
                    <span>{service.pricingModel}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--ft-text-muted)]">Base rate</span>
                    <span>
                      {service.baseRate.currency} {service.baseRate.amount}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--ft-text-muted)]">Routing</span>
                    <span>{service.supplierRouting.strategy}</span>
                  </div>
                  <div>
                    <div className="text-[var(--ft-text-muted)]">Fallback suppliers</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {service.supplierRouting.fallbackSuppliers.length ? (
                        service.supplierRouting.fallbackSuppliers.map((name) => (
                          <Badge key={name} tone="neutral">
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm">None configured</span>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>
              <Panel className="p-6">
                <h2 className="font-semibold">Risk controls</h2>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Platform policy</span>
                    <Badge tone={service.risk.platformPolicyRisk === "LOW" ? "success" : "warning"}>
                      {service.risk.platformPolicyRisk}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Account</span>
                    <Badge tone={service.risk.accountRisk === "LOW" ? "success" : "warning"}>
                      {service.risk.accountRisk}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund</span>
                    <Badge tone={service.risk.refundRisk === "LOW" ? "success" : "warning"}>
                      {service.risk.refundRisk}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Reputation</span>
                    <Badge tone={service.risk.reputationRisk === "LOW" ? "success" : "warning"}>
                      {service.risk.reputationRisk}
                    </Badge>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-[var(--ft-text-muted)]">
                  {service.risk.summary}
                </p>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
