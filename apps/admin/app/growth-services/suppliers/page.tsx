"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, Route } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { apiRequest } from "../../lib/api-client";
import {
  AdminEmptyState,
  AdminErrorNotice,
  AdminGrowthShell,
  AdminPageHeader,
  SupplierHealthBadge
} from "../components";
import { useAdminGrowthData } from "../use-admin-growth-data";

// The pricing/catalog concept this domain now runs on is /admin/growth/*
// (see suppliers above, sourced from /admin/growth/supplier-audit). "smm" is
// the earlier, still-live router underneath it — its own balance/services
// reads were never surfaced anywhere. Kept separate and clearly labeled
// rather than merged into the cards above, since they're genuinely different
// data sources describing overlapping but not identical things.
type SmmBalance = { supplierName: string; amount: { amountMinor: number; currency: string } };
type SmmSupplierService = {
  supplierName: string;
  serviceId: string;
  name: string;
  category?: string;
  rate: { amountMinor: number; currency: string };
  min: number;
  max: number;
};
type SmmPricingService = { kind: string; label: string; startsAtMinor: number; delivery: string };
type SmmHealth = { status: string; suppliers: Array<{ name: string; healthy: boolean; latencyMs?: number }> };

function LegacySmmRouterPanel() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<SmmHealth>();
  const [balance, setBalance] = useState<SmmBalance[]>();
  const [supplierServices, setSupplierServices] = useState<SmmSupplierService[]>();
  const [pricingServices, setPricingServices] = useState<SmmPricingService[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open || balance !== undefined) return;
    setLoading(true);
    setError(undefined);
    Promise.all([
      apiRequest<SmmHealth>("/smm/health"),
      apiRequest<SmmBalance>("/smm/balance").then((b) => [b]),
      apiRequest<SmmSupplierService[]>("/smm/supplier-services"),
      apiRequest<SmmPricingService[]>("/smm/services")
    ])
      .then(([healthRow, balanceRows, services, pricing]) => {
        setHealth(healthRow);
        setBalance(balanceRows);
        setSupplierServices(services);
        setPricingServices(pricing);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load router diagnostics."))
      .finally(() => setLoading(false));
  }, [open, balance]);

  return (
    <Panel className="p-4">
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <h2 className="font-semibold text-[var(--ft-text-primary)]">Legacy SMM router diagnostics</h2>
        <ChevronDown className={`size-4 text-[var(--ft-text-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        loading ? (
          <p className="mt-3 text-sm text-[var(--ft-text-muted)]">Loading...</p>
        ) : error ? (
          <p className="mt-3 text-sm text-[var(--ft-red)]">{error}</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {health ? (
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                  Router health — {health.status}
                </h3>
                <div className="mt-2 grid gap-1">
                  {health.suppliers.map((supplier) => (
                    <div className="text-sm text-[var(--ft-text-secondary)]" key={supplier.name}>
                      {supplier.name}: {supplier.healthy ? "healthy" : "unhealthy"}
                      {supplier.latencyMs !== undefined ? ` (${supplier.latencyMs}ms)` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                Supplier balance
              </h3>
              <div className="mt-2 grid gap-1">
                {(balance ?? []).map((row) => (
                  <div className="text-sm text-[var(--ft-text-secondary)]" key={row.supplierName}>
                    {row.supplierName}: {(row.amount.amountMinor / 100).toLocaleString()} {row.amount.currency}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                Raw supplier services ({(supplierServices ?? []).length})
              </h3>
              <div className="mt-2 max-h-64 overflow-y-auto text-xs text-[var(--ft-text-secondary)]">
                {(supplierServices ?? []).slice(0, 100).map((service) => (
                  <div className="border-b border-[var(--ft-border)] py-1" key={`${service.supplierName}-${service.serviceId}`}>
                    #{service.serviceId} {service.name} — {(service.rate.amountMinor / 100).toFixed(2)}{" "}
                    {service.rate.currency} ({service.min}-{service.max})
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                Internal pricing rules
              </h3>
              <div className="mt-2 grid gap-1">
                {(pricingServices ?? []).map((service) => (
                  <div className="text-sm text-[var(--ft-text-secondary)]" key={service.kind}>
                    {service.label}: from {(service.startsAtMinor / 100).toLocaleString()} · {service.delivery}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : null}
    </Panel>
  );
}

export default function AdminGrowthSuppliersPage() {
  const { error, loading, refresh, suppliers } = useAdminGrowthData();

  return (
    <AdminGrowthShell active="/growth-services/suppliers/">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Supplier audit</Badge>
            <Badge tone="warning">No secrets exposed</Badge>
          </>
        }
        title="Supplier routing"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {suppliers.length === 0 ? (
          <AdminEmptyState
            title="No supplier routes returned"
            detail="Configured SMM suppliers, routing roles, service-map coverage, and latency checks will appear here."
          />
        ) : (
          suppliers.map((supplier) => (
          <Panel className="p-4" key={supplier.name}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Route className="size-5 text-[var(--ft-blue)]" />
                  <h2 className="font-semibold text-[var(--ft-text-primary)]">{supplier.name}</h2>
                </div>
                <div className="mt-2 text-sm text-[var(--ft-text-muted)]">
                  {supplier.mode} provider
                </div>
              </div>
              <SupplierHealthBadge status={supplier.reliability} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AuditStat label="Configured" value={supplier.configured ? "Yes" : "No"} />
              <AuditStat label="Routing role" value={supplier.routingRole} />
              <AuditStat label="Service map" value={String(supplier.serviceMapCoverage)} />
              <AuditStat label="Latency" value={`${supplier.latencyMs}ms`} />
            </div>
          </Panel>
          ))
        )}
      </section>

      <section className="mt-4">
        <LegacySmmRouterPanel />
      </section>
    </AdminGrowthShell>
  );
}

function AuditStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
      <div className="font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
        {value}
      </div>
    </div>
  );
}
