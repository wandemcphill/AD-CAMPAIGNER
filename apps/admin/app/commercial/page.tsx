"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, ExternalLink, Network, Plus, RefreshCw, SlidersHorizontal, Tags } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { AdminAuthState } from "../ui/admin-auth-state";
import { useApiSession } from "../lib/use-session";

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
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";
  priority: number;
};

type GrowthService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  price: string;
  marginBps: number;
  preferredSupplier: string;
  routingStrategy: string;
};

const PRODUCT_AREAS = [
  {
    title: "Growth Services",
    detail: "Customer-facing social and growth catalogue. Edit margin, availability, supplier and quantity controls.",
    href: "/growth-services/services/",
    icon: Boxes
  },
  {
    title: "VTU",
    detail: "Airtime, data, cable, betting and education product operations, including provider and SKU controls.",
    href: "/vtu/",
    icon: SlidersHorizontal
  },
  {
    title: "Virtual Numbers",
    detail: "5SIM-backed verification numbers, margin analytics, FX and purchase limits.",
    href: "/digital-products/",
    icon: Tags
  },
  {
    title: "Providers & Routing",
    detail: "Provider registry, capability grants, provider priority and domain-level pricing rules.",
    href: "/providers/",
    icon: Network
  }
] as const;

const DOMAINS = [
  "VIRTUAL_NUMBER",
  "VTU",
  "GIFT_CARD",
  "AIRTIME_CASHOUT",
  "CRYPTO",
  "RMB",
  "VIRTUAL_ACCOUNT",
  "VIRTUAL_CARD",
  "REMITTANCE",
  "TELECOM"
] as const;

export default function CommercialControlPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [growthServices, setGrowthServices] = useState<GrowthService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savingRule, setSavingRule] = useState(false);
  const [busyRule, setBusyRule] = useState<string>();

  const [domain, setDomain] = useState<(typeof DOMAINS)[number]>(DOMAINS[0]);
  const [countryCode, setCountryCode] = useState("");
  const [network, setNetwork] = useState("");
  const [productType, setProductType] = useState("");
  const [providerName, setProviderName] = useState("");
  const [markupBps, setMarkupBps] = useState("200");

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [rulesRes, providersRes, growthRes] = await Promise.all([
        apiRequest<PricingRule[]>("/admin/providers/pricing-rules"),
        apiRequest<Provider[]>("/admin/providers/registry"),
        apiRequest<GrowthService[]>("/admin/growth/services")
      ]);
      setRules(rulesRes);
      setProviders(providersRes);
      setGrowthServices(growthRes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load commercial controls.");
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

  const activeRules = useMemo(() => rules.filter((rule) => rule.active), [rules]);
  const enabledGrowth = useMemo(() => growthServices.filter((service) => service.enabled).length, [growthServices]);

  async function createRule() {
    const parsed = Number(markupBps);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Markup must be a whole, non-negative number of basis points.");
      return;
    }
    setSavingRule(true);
    setError(undefined);
    try {
      await apiRequest("/admin/providers/pricing-rules", {
        method: "POST",
        body: JSON.stringify({
          domain,
          ...(countryCode.trim() ? { countryCode: countryCode.trim().toUpperCase() } : {}),
          ...(network.trim() ? { network: network.trim().toUpperCase() } : {}),
          ...(productType.trim() ? { productType: productType.trim().toUpperCase() } : {}),
          ...(providerName.trim() ? { providerName: providerName.trim() } : {}),
          markupBps: parsed
        })
      });
      setCountryCode("");
      setNetwork("");
      setProductType("");
      setProviderName("");
      setMarkupBps("200");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create pricing rule.");
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRule(rule: PricingRule) {
    setBusyRule(rule.id);
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
      setBusyRule(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Commercial controls auth" />;
  }

  return (
    <AdminShell active="/commercial/" subtitle="Products & commercial controls">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Commercial control plane</Badge>
              <Badge tone="warning">Pricing + routing</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-[var(--ft-text-primary)]">Products & Pricing</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-muted)]">
              One place to manage commercial rules, see the live product surfaces, and jump into the vertical controls that own the actual catalogue records.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Active pricing rules</div>
            <div className="mt-2 text-3xl font-bold">{activeRules.length}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Domain/country/network/product rules currently applying.</div>
          </Panel>
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Enabled growth services</div>
            <div className="mt-2 text-3xl font-bold">{enabledGrowth}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Growth products available to the customer catalogue.</div>
          </Panel>
          <Panel className="p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Providers in registry</div>
            <div className="mt-2 text-3xl font-bold">{providers.length}</div>
            <div className="mt-1 text-sm text-[var(--ft-text-muted)]">Configured providers across commercial domains.</div>
          </Panel>
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Product operations</h2>
              <p className="text-sm text-[var(--ft-text-muted)]">Each vertical keeps its own detailed controls, but this page is the commercial front door.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRODUCT_AREAS.map((area) => (
              <Panel className="flex h-full flex-col p-5" key={area.title}>
                <area.icon className="size-5 text-[var(--ft-accent)]" />
                <h3 className="mt-3 font-semibold">{area.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ft-text-muted)]">{area.detail}</p>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)] hover:underline"
                  href={area.href}
                >
                  Open controls <ExternalLink className="size-4" />
                </Link>
              </Panel>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Create pricing rule</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Rules remain provider-domain aware and are resolved by the backend pricing engine.</p>
              </div>
              <Plus className="size-5 text-[var(--ft-accent)]" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Domain
                <select className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" value={domain} onChange={(event) => setDomain(event.target.value as (typeof DOMAINS)[number])}>
                  {DOMAINS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Markup (bps)
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" min={0} step={100} type="number" value={markupBps} onChange={(event) => setMarkupBps(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Country (optional)
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" placeholder="NG" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Network (optional)
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" placeholder="MTN" value={network} onChange={(event) => setNetwork(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Product type (optional)
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" placeholder="DATA" value={productType} onChange={(event) => setProductType(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Provider (optional)
                <input className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3" placeholder="GSUBZ" value={providerName} onChange={(event) => setProviderName(event.target.value)} />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <Button disabled={savingRule} onClick={() => void createRule()}>
                <Tags className="size-4" />
                {savingRule ? "Saving…" : "Create rule"}
              </Button>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Current pricing rules</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">The backend resolves specificity when multiple rules match.</p>
              </div>
              <Link className="text-sm text-[var(--ft-accent)] hover:underline" href="/providers/">Open provider controls</Link>
            </div>

            <div className="mt-4 grid gap-2">
              {rules.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--ft-border)] p-6 text-sm text-[var(--ft-text-muted)]">No pricing rules returned.</div>
              ) : (
                rules.slice(0, 12).map((rule) => (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--ft-border)] p-3" key={rule.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{rule.domain}</span>
                        <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Off"}</Badge>
                        <span className="text-xs text-[var(--ft-text-muted)]">{rule.specificity} specificity</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                        {[rule.countryCode, rule.network, rule.productType, rule.providerName].filter(Boolean).join(" · ") || "Default domain rule"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{(rule.markupBps / 100).toFixed(2)}%</span>
                      <Button disabled={busyRule === rule.id} onClick={() => void toggleRule(rule)} variant="secondary">
                        {rule.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>
      </div>
    </AdminShell>
  );
}
