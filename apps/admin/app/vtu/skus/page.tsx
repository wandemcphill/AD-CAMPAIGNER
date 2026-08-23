"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, ChevronDown, ChevronRight, RefreshCcw, XCircle } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

type PricingSource = "LIVE_PROVIDER" | "RESEARCHED_PUBLIC_PRICE" | "MANUAL_OVERRIDE";

type SkuMapping = {
  id: string;
  providerName: string;
  providerSku: string;
  providerProductName?: string | null;
  costMinor: number;
  adminApproved: boolean;
  active: boolean;
  pricingSourceType: PricingSource;
  lastSyncedAt: string | null;
};

type CommercialSku = {
  id: string;
  displayName: string;
  category: string;
  network: string | null;
  productFamily?: string | null;
  sizeMb: number | null;
  validityDays: number | null;
  planType?: string | null;
  minMarginBps: number;
  active: boolean;
  adminApproved: boolean;
  sellingPriceMinor: number | null;
  floorPriceMinor: number | null;
  cheapestCostMinor: number | null;
  providerCount: number;
  providers: SkuMapping[];
};

const PRICING_SOURCE_LABEL: Record<PricingSource, string> = {
  LIVE_PROVIDER: "live",
  RESEARCHED_PUBLIC_PRICE: "public docs",
  MANUAL_OVERRIDE: "manual"
};

function fmt(minor: number | null) {
  return minor == null ? "—" : `₦${(minor / 100).toFixed(2)}`;
}

function pct(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function MappingRow({
  mapping,
  onToggleApproval,
  saving
}: {
  mapping: SkuMapping;
  onToggleApproval: (id: string, approved: boolean) => void | Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-sm">
      <div className="w-32 font-mono text-xs text-[var(--ft-text-muted)]">{mapping.providerSku}</div>
      <div className="w-28 font-medium">{mapping.providerName}</div>
      <div className="w-24 text-right font-mono">{fmt(mapping.costMinor)}</div>
      <div className="w-24">
        <Badge tone={mapping.pricingSourceType === "LIVE_PROVIDER" ? "success" : mapping.pricingSourceType === "MANUAL_OVERRIDE" ? "info" : "neutral"}>
          {PRICING_SOURCE_LABEL[mapping.pricingSourceType]}
        </Badge>
      </div>
      <div className="w-24 text-xs text-[var(--ft-text-muted)]">
        {mapping.lastSyncedAt ? new Date(mapping.lastSyncedAt).toLocaleDateString() : "never"}
      </div>
      <div className="flex min-w-[180px] flex-1 items-center justify-end gap-2">
        {mapping.adminApproved ? (
          <div className="flex items-center gap-1 text-[var(--ft-green)] text-xs font-medium">
            <CheckCircle className="size-3.5" /> approved
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[var(--ft-yellow)] text-xs font-medium">
            <XCircle className="size-3.5" /> pending
          </div>
        )}
        {!mapping.active && <Badge tone="neutral">inactive</Badge>}
        <Button
          disabled={saving}
          onClick={() => void onToggleApproval(mapping.id, !mapping.adminApproved)}
          variant={mapping.adminApproved ? "secondary" : "primary"}
        >
          {mapping.adminApproved ? "Revoke" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function SkuCard({
  sku,
  saving,
  onToggleApproval,
  onSave
}: {
  sku: CommercialSku;
  saving: boolean;
  onToggleApproval: (mappingId: string, approved: boolean) => void | Promise<void>;
  onSave: (id: string, patch: Record<string, unknown>) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(sku.sellingPriceMinor == null ? "" : String((sku.sellingPriceMinor / 100).toFixed(2)));
  const [margin, setMargin] = useState(String((sku.minMarginBps / 100).toFixed(2)));
  const [active, setActive] = useState(sku.active);
  const [approved, setApproved] = useState(sku.adminApproved);

  const save = async () => {
    const patch: Record<string, unknown> = {
      sellingPriceMinor: price.trim() ? Math.round(Number(price) * 100) : null,
      minMarginBps: Math.round(Number(margin) * 100),
      active,
      adminApproved: approved
    };
    await onSave(sku.id, patch);
    setEditing(false);
  };

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start">
        <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setExpanded((p) => !p)}>
          {expanded ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-[var(--ft-text-muted)]" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-[var(--ft-text-muted)]" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{sku.displayName}</span>
              <Badge tone="neutral">{sku.category}</Badge>
              {sku.network && <Badge tone="info">{sku.network}</Badge>}
              {!sku.active && <Badge tone="neutral">inactive</Badge>}
            </div>
            <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
              {sku.sizeMb != null && `${sku.sizeMb >= 1024 ? `${sku.sizeMb / 1024}GB` : `${sku.sizeMb}MB`}`}
              {sku.validityDays != null && ` · ${sku.validityDays}d`}
              {sku.planType && ` · ${sku.planType}`}
              {` · floor margin ${pct(sku.minMarginBps)}`}
            </div>
          </div>
        </button>

        <div className="grid grid-cols-3 gap-4 text-right text-sm lg:min-w-[420px]">
          <div>
            <div className="text-xs text-[var(--ft-text-muted)]">provider cost</div>
            <div className="font-mono font-medium">{fmt(sku.cheapestCostMinor)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ft-text-muted)]">min customer</div>
            <div className="font-mono font-medium">{fmt(sku.floorPriceMinor)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ft-text-muted)]">selling price</div>
            <div className="font-mono font-semibold text-[var(--ft-accent)]">{fmt(sku.sellingPriceMinor)}</div>
          </div>
        </div>

        <Button variant={editing ? "secondary" : "primary"} onClick={() => setEditing((p) => !p)}>
          {editing ? "Close" : "Edit price"}
        </Button>
      </div>

      {editing && (
        <div className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-4">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium">
              Selling price (NGN)
              <input className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg)] px-3 py-2 text-sm" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Auto from pricing rules" />
              <span className="font-normal text-[var(--ft-text-muted)]">Leave blank to use pricing rules.</span>
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Minimum margin (%)
              <input className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg)] px-3 py-2 text-sm" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
              <span className="font-normal text-[var(--ft-text-muted)]">Never sell below cost + this floor.</span>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Customer available
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> Commercially approved
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void save()}>Save product</Button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-[var(--ft-border)] px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--ft-text-muted)]">
            <span>{sku.providerCount} active provider mapping{sku.providerCount === 1 ? "" : "s"}</span>
            <span>Customer price: {sku.sellingPriceMinor == null ? "pricing-rule driven" : `manual override ${fmt(sku.sellingPriceMinor)}`}</span>
          </div>
          <div className="grid gap-2">
            {sku.providers.map((mapping) => (
              <MappingRow key={mapping.id} mapping={mapping} onToggleApproval={onToggleApproval} saving={saving} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function AdminVtuSkusPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [skus, setSkus] = useState<CommercialSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [networkFilter, setNetworkFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const refresh = useCallback(async () => {
    setError(undefined);
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (networkFilter) query.set("network", networkFilter);
      if (categoryFilter) query.set("category", categoryFilter);
      const data = await apiRequest<CommercialSku[]>(`/admin/vtu/commercial/products${query.toString() ? `?${query.toString()}` : ""}`);
      setSkus(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load VTU commercial products.");
    } finally {
      setLoading(false);
    }
  }, [networkFilter, categoryFilter]);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  async function updateProduct(id: string, patch: Record<string, unknown>) {
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest(`/admin/vtu/commercial/products/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update product.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleApproval(mappingId: string, adminApproved: boolean) {
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest(`/admin/vtu/skus/mappings/${encodeURIComponent(mappingId)}`, {
        method: "PATCH",
        body: JSON.stringify({ adminApproved })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update provider mapping.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="VTU commercial auth" />;
  }

  const networks = ["", "MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
  const categories = ["", "DATA", "AIRTIME", "CABLE", "ELECTRICITY", "BETTING", "EDUCATION", "EPIN"];
  const overridden = skus.filter((sku) => sku.sellingPriceMinor != null).length;
  const inactive = skus.filter((sku) => !sku.active).length;

  return (
    <AdminShell active="/vtu/skus/">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold">VTU Products & Pricing</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-secondary)]">
              Set customer prices, minimum margins, availability and commercial approval for canonical VTU products. Provider cost remains supplier-driven.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCcw className="size-4" /> Refresh</Button>
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--ft-text-muted)]">
          <span>{skus.length} products</span>
          <span>{overridden} price overrides</span>
          <span>{inactive} inactive</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-1">
            {networks.map((n) => (
              <button key={n} className={["rounded border px-2.5 py-1 text-xs font-medium", networkFilter === n ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-white" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)]"].join(" ")} onClick={() => setNetworkFilter(n)}>{n || "All networks"}</button>
            ))}
          </div>
          <select className="rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2.5 py-1 text-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
          </select>
        </div>

        {error && <div className="mt-4 rounded border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</div>}

        <div className="mt-4 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading VTU products…</Panel>
          ) : skus.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No canonical VTU products found.</Panel>
          ) : (
            skus.map((sku) => <SkuCard key={sku.id} sku={sku} saving={saving} onToggleApproval={toggleApproval} onSave={updateProduct} />)
          )}
        </div>
      </div>
    </AdminShell>
  );
}
