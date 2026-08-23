"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, Plus, RefreshCw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

type Country = {
  isoCode: string;
  name: string;
  dialPrefix: string;
  enabled: boolean;
  sortOrder: number;
};

type PricingRule = {
  id: string;
  domain: string;
  countryCode: string | null;
  network: string | null;
  productType: string | null;
  providerName: string | null;
  markupBps: number;
  active: boolean;
  specificity: number;
};

type Provider = {
  id: string;
  name: string;
  domain: string;
  status: string;
  priority: number;
};

export default function VirtualNumberCommercialPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [countries, setCountries] = useState<Country[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [country, setCountry] = useState("");
  const [providerName, setProviderName] = useState("");
  const [markupBps, setMarkupBps] = useState("3500");

  const refresh = useCallback(async () => {
    setError(undefined);
    setLoading(true);
    try {
      const [countryRes, ruleRes, providerRes] = await Promise.all([
        apiRequest<Country[]>("/virtual-numbers/countries"),
        apiRequest<PricingRule[]>("/admin/providers/pricing-rules?domain=VIRTUAL_NUMBER"),
        apiRequest<Provider[]>("/admin/providers/registry?domain=VIRTUAL_NUMBER")
      ]);
      setCountries(countryRes);
      setRules(ruleRes);
      setProviders(providerRes);
      if (!country && countryRes[0]) setCountry(countryRes[0].isoCode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load virtual-number commercial controls.");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  const activeRules = useMemo(() => rules.filter((r) => r.active), [rules]);
  const countryRules = useMemo(
    () => rules.filter((r) => r.countryCode === country),
    [rules, country]
  );

  async function createRule() {
    const parsed = Number(markupBps);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Markup must be a non-negative whole number of basis points.");
      return;
    }
    if (!country) {
      setError("Select a country before creating a country-specific number price rule.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest("/admin/providers/pricing-rules", {
        method: "POST",
        body: JSON.stringify({
          domain: "VIRTUAL_NUMBER",
          countryCode: country,
          ...(providerName.trim() ? { providerName: providerName.trim() } : {}),
          markupBps: parsed
        })
      });
      setProviderName("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create pricing rule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: PricingRule) {
    setBusyId(rule.id);
    setError(undefined);
    try {
      await apiRequest(`/admin/providers/pricing-rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update pricing rule.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Virtual number pricing auth" />;
  }

  return (
    <AdminShell active="/commercial/" subtitle="Virtual number commercial controls">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="info">Virtual Numbers</Badge>
              <Badge tone="warning">5SIM verification catalogue</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold">Virtual Number Pricing & Availability</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-muted)]">
              Country-specific commercial control over the verification-number catalogue. Customer cost is still provider-driven; markup rules determine the FlipTrybe selling price.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/commercial/" className="inline-flex items-center gap-2 rounded-md border border-[var(--ft-border)] px-3 text-sm">
              <ArrowLeft className="size-4" /> Back
            </Link>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Live countries</div>
            <div className="mt-2 text-3xl font-bold">{countries.filter((c) => c.enabled).length}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Countries currently enabled in the 5SIM-backed catalogue.</div>
          </Panel>
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Active markup rules</div>
            <div className="mt-2 text-3xl font-bold">{activeRules.length}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Virtual-number rules resolved by the pricing engine.</div>
          </Panel>
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Provider registry</div>
            <div className="mt-2 text-3xl font-bold">{providers.length}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Configured verification-number providers.</div>
          </Panel>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-[var(--ft-accent)]" />
              <h2 className="font-semibold">Country commercial settings</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Set the markup used for a country, optionally restricted to a provider.</p>

            <label className="mt-5 grid gap-2 text-sm font-medium">
              Country
              <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" value={country} onChange={(e) => setCountry(e.target.value)}>
                {countries.map((item) => <option key={item.isoCode} value={item.isoCode}>{item.isoCode} · {item.name}</option>)}
              </select>
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium">
              Provider (optional)
              <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" value={providerName} onChange={(e) => setProviderName(e.target.value)}>
                <option value="">All virtual-number providers</option>
                {providers.map((p) => <option key={p.id} value={p.name}>{p.name} · {p.status}</option>)}
              </select>
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium">
              Markup (basis points)
              <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" min={0} step={100} type="number" value={markupBps} onChange={(e) => setMarkupBps(e.target.value)} />
              <span className="text-xs text-[var(--ft-text-muted)]">{(Number(markupBps || 0) / 100).toFixed(2)}% markup over provider cost.</span>
            </label>

            <div className="mt-5 flex justify-end">
              <Button disabled={saving || loading} onClick={() => void createRule()}>
                <Plus className="size-4" /> {saving ? "Saving…" : "Add pricing rule"}
              </Button>
            </div>
          </Panel>

          <Panel className="p-5">
            <div>
              <h2 className="font-semibold">Rules for {country || "selected country"}</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-muted)]">More-specific rules override the general virtual-number fallback according to backend specificity.</p>
            </div>

            <div className="mt-4 grid gap-2">
              {countryRules.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--ft-border)] p-6 text-sm text-[var(--ft-text-muted)]">
                  No country-specific rule exists. The platform fallback currently applies the configured VIRTUAL_NUMBER markup.
                </div>
              ) : countryRules.map((rule) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--ft-border)] p-3" key={rule.id}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.countryCode}</span>
                      <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Off"}</Badge>
                      {rule.providerName ? <Badge tone="info">{rule.providerName}</Badge> : <Badge tone="neutral">All providers</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">specificity {rule.specificity}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong>{(rule.markupBps / 100).toFixed(2)}%</strong>
                    <Button disabled={busyId === rule.id} onClick={() => void toggleRule(rule)} variant="secondary">
                      {rule.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 p-5">
          <h2 className="font-semibold">Important commercial boundary</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
            The customer-facing virtual-number catalogue remains supplier-backed. This screen controls FlipTrybe's commercial markup and provider-specific pricing rules. It does not invent wholesale costs, and it does not reduce the live 5SIM country universe.
          </p>
        </Panel>
      </div>
    </AdminShell>
  );
}
