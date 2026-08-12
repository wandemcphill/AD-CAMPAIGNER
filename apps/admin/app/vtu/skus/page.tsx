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
  costMinor: number;
  adminApproved: boolean;
  active: boolean;
  pricingSourceType: PricingSource;
  lastSyncedAt: string | null;
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
  adminApproved: boolean;
  providerMappings: SkuMapping[];
};

const PRICING_SOURCE_LABEL: Record<PricingSource, string> = {
  LIVE_PROVIDER: "live",
  RESEARCHED_PUBLIC_PRICE: "public docs",
  MANUAL_OVERRIDE: "manual"
};

function fmt(minor: number) {
  return `₦${(minor / 100).toFixed(2)}`;
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
    <div className="flex items-center gap-3 rounded border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-sm">
      <div className="w-32 font-mono text-xs text-[var(--ft-text-muted)]">{mapping.providerSku}</div>
      <div className="w-28 font-medium">{mapping.providerName}</div>
      <div className="w-24 text-right font-mono">{fmt(mapping.costMinor)}</div>
      <div className="w-24">
        <Badge tone={mapping.pricingSourceType === "LIVE_PROVIDER" ? "success" : mapping.pricingSourceType === "MANUAL_OVERRIDE" ? "info" : "neutral"}>
          {PRICING_SOURCE_LABEL[mapping.pricingSourceType]}
        </Badge>
      </div>
      <div className="w-32 text-xs text-[var(--ft-text-muted)]">
        {mapping.lastSyncedAt
          ? new Date(mapping.lastSyncedAt).toLocaleDateString()
          : "never"}
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        {!mapping.active && (
          <Badge tone="neutral">inactive</Badge>
        )}
        {mapping.adminApproved ? (
          <div className="flex items-center gap-1 text-[var(--ft-green)] text-xs font-medium">
            <CheckCircle className="size-3.5" />
            approved
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[var(--ft-yellow)] text-xs font-medium">
            <XCircle className="size-3.5" />
            pending
          </div>
        )}
        <Button
          disabled={saving}
          onClick={() => { void onToggleApproval(mapping.id, !mapping.adminApproved); }}
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
  onToggleApproval,
  saving
}: {
  sku: CanonicalSku;
  onToggleApproval: (mappingId: string, approved: boolean) => void | Promise<void>;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const approvedCount = sku.providerMappings.filter((m) => m.adminApproved && m.active).length;
  const cheapest = sku.providerMappings
    .filter((m) => m.active)
    .sort((a, b) => a.costMinor - b.costMinor)[0];

  return (
    <Panel className="overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--ft-bg-hover)] transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <ChevronDown className="size-4 text-[var(--ft-text-muted)] shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-[var(--ft-text-muted)] shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{sku.displayName}</span>
            {sku.network && (
              <Badge tone="info">{sku.network}</Badge>
            )}
            {!sku.active && <Badge tone="neutral">inactive</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">
            {sku.sizeMb != null && `${sku.sizeMb >= 1024 ? `${sku.sizeMb / 1024}GB` : `${sku.sizeMb}MB`}`}
            {sku.validityDays != null && ` · ${sku.validityDays}d`}
            {` · min margin ${sku.minMarginBps / 100}%`}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm shrink-0">
          {cheapest && (
            <div className="text-right">
              <div className="text-xs text-[var(--ft-text-muted)]">cheapest</div>
              <div className="font-mono font-medium">{fmt(cheapest.costMinor)}</div>
            </div>
          )}
          <div className="text-right">
            <div className="text-xs text-[var(--ft-text-muted)]">providers</div>
            <div className="font-medium">
              {approvedCount}/{sku.providerMappings.length} approved
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--ft-border)] px-4 pb-4 pt-3">
          {sku.providerMappings.length === 0 ? (
            <p className="text-sm text-[var(--ft-text-muted)]">
              No provider mappings yet. Run the seed script or wait for a price_sync job.
            </p>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ft-text-muted)]">
                <div className="w-32">Provider SKU</div>
                <div className="w-28">Provider</div>
                <div className="w-24 text-right">Cost</div>
                <div className="w-24">Source</div>
                <div className="w-32">Synced</div>
                <div className="flex-1" />
              </div>
              {sku.providerMappings
                .sort((a, b) => a.costMinor - b.costMinor)
                .map((m) => (
                  <MappingRow
                    key={m.id}
                    mapping={m}
                    onToggleApproval={onToggleApproval}
                    saving={saving}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function AdminVtuSkusPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [skus, setSkus] = useState<CanonicalSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<string>("");

  const refresh = useCallback(async () => {
    setError(undefined);
    setLoading(true);
    try {
      const params = networkFilter ? `?network=${encodeURIComponent(networkFilter)}` : "";
      const data = await apiRequest<CanonicalSku[]>(`/admin/vtu/skus${params}`);
      setSkus(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load canonical SKUs.");
    } finally {
      setLoading(false);
    }
  }, [networkFilter]);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  async function toggleApproval(mappingId: string, approved: boolean) {
    setSaving(true);
    setError(undefined);
    try {
      const updated = await apiRequest<SkuMapping>(
        `/admin/vtu/skus/mappings/${encodeURIComponent(mappingId)}`,
        { method: "PATCH", body: JSON.stringify({ adminApproved: approved }) }
      );
      setSkus((prev) =>
        prev.map((sku) => ({
          ...sku,
          providerMappings: sku.providerMappings.map((m) =>
            m.id === updated.id ? updated : m
          )
        }))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update mapping.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="VTU SKUs auth" />;
  }

  const networks = ["", "MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
  const totalApproved = skus.reduce(
    (sum, s) => sum + s.providerMappings.filter((m) => m.adminApproved && m.active).length,
    0
  );
  const totalMappings = skus.reduce((sum, s) => sum + s.providerMappings.length, 0);

  return (
    <AdminShell active="/vtu/skus/">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Canonical SKU Management</h1>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Approve provider SKU mappings to enable multi-provider cost-comparison routing.
              Only approved mappings are used by the router.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {!loading && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--ft-text-muted)]">Network:</span>
              {networks.map((n) => (
                <button
                  key={n}
                  className={[
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    networkFilter === n
                      ? "bg-[var(--ft-accent)] text-white"
                      : "bg-[var(--ft-bg-surface)] text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)] border border-[var(--ft-border)]"
                  ].join(" ")}
                  onClick={() => setNetworkFilter(n)}
                >
                  {n || "All"}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-[var(--ft-text-muted)]">
              {totalApproved}/{totalMappings} mappings approved · {skus.length} SKUs
            </span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading SKUs…</Panel>
          ) : skus.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              No canonical SKUs found. Run{" "}
              <code className="font-mono text-xs">pnpm --filter @fliptrybe/database tsx prisma/seed-vtu.ts</code>{" "}
              to seed them.
            </Panel>
          ) : (
            skus.map((sku) => (
              <SkuCard
                key={sku.id}
                sku={sku}
                onToggleApproval={toggleApproval}
                saving={saving}
              />
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
