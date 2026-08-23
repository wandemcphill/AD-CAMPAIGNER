"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { asHref } from "../../lib/nav";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

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

type ProviderMapping = {
  id: string;
  providerName: string;
  costMinor: number;
  active: boolean;
  adminApproved: boolean;
  pricingSourceType: string;
};

type CanonicalSku = {
  id: string;
  displayName: string;
  category: string;
  network: string | null;
  sizeMb: number | null;
  validityDays: number | null;
  minMarginBps: number;
  active: boolean;
  providerMappings: ProviderMapping[];
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
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";
  priority: number;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  status: "ACTIVE" | "INACTIVE" | "REVIEW";
  commercialSource: string;
  supplier: string;
  marginBps: number | null;
  costMinor: number | null;
  href: string;
};

function money(minor: number | null) {
  if (minor === null) return "—";
  return `₦${(minor / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function pct(bps: number | null) {
  return bps === null ? "—" : `${(bps / 100).toFixed(2)}%`;
}

export default function CommercialProductsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [growth, setGrowth] = useState<GrowthService[]>([]);
  const [skus, setSkus] = useState<CanonicalSku[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [growthResult, skuResult, rulesResult, providerResult] = await Promise.all([
        apiRequest<GrowthService[]>("/admin/growth/services"),
        apiRequest<CanonicalSku[]>("/admin/vtu/skus"),
        apiRequest<PricingRule[]>("/admin/providers/pricing-rules"),
        apiRequest<Provider[]>("/admin/providers/registry")
      ]);
      setGrowth(growthResult);
      setSkus(skuResult);
      setRules(rulesResult);
      setProviders(providerResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the commercial catalogue.");
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

  const products = useMemo<ProductRow[]>(() => {
    const rows: ProductRow[] = [];

    for (const service of growth) {
      rows.push({
        id: `growth:${service.code}`,
        name: service.name,
        category: "Growth",
        subcategory: service.platform,
        status: service.enabled ? "ACTIVE" : "INACTIVE",
        commercialSource: "Growth service controls",
        supplier: service.preferredSupplier || "Auto route",
        marginBps: service.marginBps,
        costMinor: null,
        href: `/commercial/products/growth/detail?code=${encodeURIComponent(service.code)}`
      });
    }

    for (const sku of skus) {
      const active = sku.providerMappings.filter((mapping) => mapping.active);
      const approved = active.filter((mapping) => mapping.adminApproved);
      const cheapest = active.slice().sort((a, b) => a.costMinor - b.costMinor)[0];
      rows.push({
        id: `vtu:${sku.id}`,
        name: sku.displayName,
        category: "VTU",
        subcategory: sku.network ?? sku.category,
        status: !sku.active ? "INACTIVE" : approved.length === 0 ? "REVIEW" : "ACTIVE",
        commercialSource: "Canonical SKU mappings",
        supplier: approved[0]?.providerName ?? cheapest?.providerName ?? "Unmapped",
        marginBps: sku.minMarginBps,
        costMinor: cheapest?.costMinor ?? null,
        href: "/vtu/skus/"
      });
    }

    return rows;
  }, [growth, skus]);

  const filtered = products.filter((product) => {
    const normalized = `${product.name} ${product.category} ${product.subcategory} ${product.supplier}`.toLowerCase();
    const matchesQuery = !query.trim() || normalized.includes(query.trim().toLowerCase());
    const matchesCategory = category === "ALL" || product.category === category;
    return matchesQuery && matchesCategory;
  });

  const categories = ["ALL", ...Array.from(new Set(products.map((product) => product.category)))];
  const healthyProviders = providers.filter((provider) => provider.status === "HEALTHY").length;
  const activeRules = rules.filter((rule) => rule.active).length;

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Commercial product auth" />;
  }

  return (
    <AdminShell active="/commercial/">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-accent)]">
              <ShieldCheck className="size-4" />
              Products & Pricing
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[var(--ft-text-primary)]">Unified product catalogue</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-secondary)]">
              One commercial view over the domain-specific product engines. Prices and routing remain owned by their existing authoritative APIs.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCcw className="size-4" />
            Refresh catalogue
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Panel className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Products</div><div className="mt-1 text-2xl font-bold">{products.length}</div></Panel>
          <Panel className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Active pricing rules</div><div className="mt-1 text-2xl font-bold">{activeRules}</div></Panel>
          <Panel className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Healthy providers</div><div className="mt-1 text-2xl font-bold">{healthyProviders}/{providers.length}</div></Panel>
          <Panel className="p-4"><div className="text-xs uppercase tracking-wide text-[var(--ft-text-muted)]">Requires review</div><div className="mt-1 text-2xl font-bold">{products.filter((p) => p.status === "REVIEW").length}</div></Panel>
        </div>

        <Panel className="mt-6 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
              <input
                aria-label="Search products"
                className="h-11 w-full rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] pl-9 pr-3 text-sm text-[var(--ft-text-primary)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, networks, suppliers..."
                value={query}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${category === item ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]" : "border-[var(--ft-border)] text-[var(--ft-text-secondary)]"}`}
                  key={item}
                  onClick={() => setCategory(item)}
                  type="button"
                >
                  {item === "ALL" ? "All" : item}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <div className="mt-4 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading commercial catalogue…</Panel>
          ) : filtered.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No products match the current filter.</Panel>
          ) : (
            filtered.map((product) => (
              <Panel className="p-4" key={product.id}>
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--ft-text-primary)]">{product.name}</h2>
                      <Badge tone={product.status === "ACTIVE" ? "success" : product.status === "REVIEW" ? "warning" : "neutral"}>{product.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                      {product.category} · {product.subcategory} · {product.supplier}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--ft-text-muted)]">Cost</div>
                    <div className="font-mono text-sm">{money(product.costMinor)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--ft-text-muted)]">Margin / rule</div>
                    <div className="font-mono text-sm">{pct(product.marginBps)}</div>
                  </div>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--ft-border)] px-3 py-2 text-xs font-semibold text-[var(--ft-text-primary)] hover:bg-[var(--ft-bg-muted)]"
                    href={asHref(product.href)}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Manage
                  </Link>
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
