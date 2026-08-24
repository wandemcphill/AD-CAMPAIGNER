"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Smartphone, WalletCards } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type ProductTab = "overview" | "growth" | "vtu" | "virtual_numbers";

type GrowthService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  price: string;
  marginBps: number;
  preferredSupplier: string;
  routingStrategy: string;
  maxQuantity?: number | null;
  minQuantity?: number | null;
};

type VtuProduct = {
  id: string;
  displayName: string;
  category: string;
  network: string;
  productFamily: string | null;
  sizeMb: number | null;
  validityDays: number | null;
  planType: string | null;
  active: boolean;
  adminApproved: boolean;
  sellingPriceMinor: number | null;
  minMarginBps: number;
  floorPriceMinor: number | null;
  cheapestCostMinor: number | null;
  providerCount: number;
};

type NumberMarginRow = {
  countryCode: string;
  serviceKey: string;
  providerName: string | null;
  orders: number;
  revenueMinor: number;
  supplierCostMinor: number;
  marginMinor: number;
  currency: string;
};

function formatNgn(minor: number | null | undefined) {
  if (minor === null || minor === undefined) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(minor / 100);
}

function formatMarginBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export default function ProductGovernancePage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState<ProductTab>("overview");
  const [growth, setGrowth] = useState<GrowthService[]>([]);
  const [vtu, setVtu] = useState<VtuProduct[]>([]);
  const [numbers, setNumbers] = useState<NumberMarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [growthRes, vtuRes, numberRes] = await Promise.all([
        apiRequest<GrowthService[]>("/admin/growth/services"),
        apiRequest<VtuProduct[]>("/admin/vtu/commercial/products"),
        apiRequest<NumberMarginRow[]>("/admin/digital-products/margin-analytics?days=30&limit=100")
      ]);
      setGrowth(growthRes);
      setVtu(vtuRes);
      setNumbers(numberRes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load product governance data.");
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

  async function updateGrowth(service: GrowthService, patch: Partial<GrowthService>) {
    setSaving(`growth:${service.code}`);
    setError(undefined);
    try {
      const updated = await apiRequest<GrowthService>(
        `/admin/growth/services/${encodeURIComponent(service.code)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setGrowth((rows) => rows.map((row) => (row.code === updated.code ? updated : row)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this Growth service.");
    } finally {
      setSaving(undefined);
    }
  }

  async function updateVtu(product: VtuProduct, patch: Record<string, unknown>) {
    setSaving(`vtu:${product.id}`);
    setError(undefined);
    try {
      const updated = await apiRequest<VtuProduct>(
        `/admin/vtu/commercial/products/${encodeURIComponent(product.id)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setVtu((rows) => rows.map((row) => (row.id === product.id ? { ...row, ...updated } : row)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this VTU product.");
    } finally {
      setSaving(undefined);
    }
  }

  const metrics = useMemo(() => {
    const growthEnabled = growth.filter((item) => item.enabled).length;
    const vtuLive = vtu.filter((item) => item.active && item.adminApproved).length;
    const vtuNeedsApproval = vtu.filter((item) => item.active && !item.adminApproved).length;
    const numberMargin = numbers.reduce((sum, row) => sum + row.marginMinor, 0);
    return { growthEnabled, vtuLive, vtuNeedsApproval, numberMargin };
  }, [growth, vtu, numbers]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Product governance auth" />;
  }

  return (
    <AdminShell active="/product-governance/" subtitle="Product lifecycle & commercial control">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Product control plane</Badge>
              <Badge tone="warning">Commercial + lifecycle</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold">Product Governance</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Operate customer-facing products from one desk while keeping provider cost, minimum margin,
              approval and availability rules owned by their vertical services.
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

        <div className="mt-6">
          <SummaryStatStrip
            items={[
              { label: "Growth enabled", value: String(metrics.growthEnabled) },
              { label: "VTU live", value: String(metrics.vtuLive) },
              { label: "VTU approval queue", value: String(metrics.vtuNeedsApproval) },
              { label: "Virtual Number margin · 30d", value: formatNgn(metrics.numberMargin) }
            ]}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {([
            ["overview", "Overview", Boxes],
            ["growth", "Growth", Boxes],
            ["vtu", "VTU", Smartphone],
            ["virtual_numbers", "Virtual Numbers", WalletCards]
          ] as const).map(([value, label, Icon]) => (
            <Button
              key={value}
              onClick={() => setTab(value)}
              variant={tab === value ? "primary" : "secondary"}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Panel className="p-5">
              <Boxes className="size-5 text-[var(--ft-accent)]" />
              <h2 className="mt-3 font-semibold">Growth</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                Availability, margin, preferred supplier and routing strategy are controlled per customer-facing service.
              </p>
              <div className="mt-4 text-sm">{growth.length} services · {metrics.growthEnabled} enabled</div>
            </Panel>
            <Panel className="p-5">
              <Smartphone className="size-5 text-[var(--ft-accent)]" />
              <h2 className="mt-3 font-semibold">VTU</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                Canonical products stay above the cheapest active provider cost plus the configured minimum margin.
              </p>
              <div className="mt-4 text-sm">{vtu.length} SKUs · {metrics.vtuNeedsApproval} awaiting approval</div>
            </Panel>
            <Panel className="p-5">
              <WalletCards className="size-5 text-[var(--ft-accent)]" />
              <h2 className="mt-3 font-semibold">Virtual Numbers</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                Margin analytics show supplier cost and customer revenue by country, service and provider.
              </p>
              <div className="mt-4 text-sm">{numbers.length} margin rows · {formatNgn(metrics.numberMargin)} margin in period</div>
            </Panel>
          </div>
        ) : null}

        {tab === "growth" ? (
          <Panel className="mt-6 overflow-hidden p-0">
            <div className="border-b border-[var(--ft-border)] p-4">
              <div className="flex items-center gap-2"><Boxes className="size-5 text-[var(--ft-accent)]" /><h2 className="font-semibold">Growth service catalogue</h2></div>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Toggle availability or open the vertical editor for deeper routing controls.</p>
            </div>
            <div className="divide-y divide-[var(--ft-border)]">
              {growth.map((service) => (
                <div className="grid gap-3 p-4 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center" key={service.code}>
                  <div><div className="font-semibold">{service.name}</div><div className="font-mono text-xs text-[var(--ft-text-muted)]">{service.code} · {service.platform}</div></div>
                  <div className="text-sm"><span className="text-[var(--ft-text-muted)]">Price:</span> {service.price}</div>
                  <div className="text-sm"><span className="text-[var(--ft-text-muted)]">Margin:</span> {formatMarginBps(service.marginBps)}</div>
                  <div><Badge tone={service.enabled ? "success" : "neutral"}>{service.enabled ? "customer live" : "disabled"}</Badge></div>
                  <Button disabled={saving === `growth:${service.code}`} onClick={() => void updateGrowth(service, { enabled: !service.enabled })} variant={service.enabled ? "secondary" : "primary"}>{service.enabled ? "Disable" : "Enable"}</Button>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {tab === "vtu" ? (
          <Panel className="mt-6 overflow-hidden p-0">
            <div className="border-b border-[var(--ft-border)] p-4">
              <div className="flex items-center gap-2"><Smartphone className="size-5 text-[var(--ft-accent)]" /><h2 className="font-semibold">VTU canonical products</h2></div>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Live status is the combination of active + admin-approved. Selling price cannot fall below the minimum margin floor.</p>
            </div>
            <div className="divide-y divide-[var(--ft-border)]">
              {vtu.map((product) => {
                const belowFloor = product.sellingPriceMinor !== null && product.floorPriceMinor !== null && product.sellingPriceMinor < product.floorPriceMinor;
                return (
                  <div className="grid gap-3 p-4 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center" key={product.id}>
                    <div><div className="font-semibold">{product.displayName}</div><div className="font-mono text-xs text-[var(--ft-text-muted)]">{product.network} · {product.category} · {product.providerCount} providers</div></div>
                    <div className="text-sm"><span className="text-[var(--ft-text-muted)]">Cost:</span> {formatNgn(product.cheapestCostMinor)}</div>
                    <div className="text-sm"><span className="text-[var(--ft-text-muted)]">Floor:</span> {formatNgn(product.floorPriceMinor)}</div>
                    <div className="flex flex-wrap gap-1"><Badge tone={product.active ? "success" : "neutral"}>{product.active ? "active" : "inactive"}</Badge><Badge tone={product.adminApproved ? "info" : "warning"}>{product.adminApproved ? "approved" : "needs approval"}</Badge>{belowFloor ? <Badge tone="danger">below floor</Badge> : null}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={saving === `vtu:${product.id}`} onClick={() => void updateVtu(product, { active: !product.active })} variant="secondary">{product.active ? "Disable" : "Enable"}</Button>
                      <Button disabled={saving === `vtu:${product.id}`} onClick={() => void updateVtu(product, { adminApproved: !product.adminApproved })}>{product.adminApproved ? "Unapprove" : "Approve"}</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {tab === "virtual_numbers" ? (
          <Panel className="mt-6 overflow-hidden p-0">
            <div className="border-b border-[var(--ft-border)] p-4">
              <div className="flex items-center gap-2"><WalletCards className="size-5 text-[var(--ft-accent)]" /><h2 className="font-semibold">Virtual Number margin analytics</h2></div>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Last 30 days. This desk is read-only here; pricing and purchase limits stay in the dedicated Virtual Numbers controls.</p>
            </div>
            <div className="divide-y divide-[var(--ft-border)]">
              {numbers.length === 0 ? <div className="p-6 text-sm text-[var(--ft-text-secondary)]">No margin rows returned.</div> : numbers.map((row) => (
                <div className="grid gap-2 p-4 md:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.8fr] md:items-center" key={`${row.countryCode}:${row.serviceKey}:${row.providerName ?? "all"}`}>
                  <div><div className="font-semibold">{row.countryCode}</div><div className="font-mono text-xs text-[var(--ft-text-muted)]">{row.serviceKey}</div></div>
                  <div className="text-sm">{row.providerName ?? "all providers"}</div>
                  <div className="text-sm">{row.orders.toLocaleString()} orders</div>
                  <div className="text-sm">Revenue {formatNgn(row.revenueMinor)}</div>
                  <div className="text-sm font-semibold">Margin {formatNgn(row.marginMinor)}</div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </AdminShell>
  );
}
