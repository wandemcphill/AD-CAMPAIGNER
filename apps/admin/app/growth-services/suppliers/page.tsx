"use client";

import { RefreshCw, Route } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  AdminEmptyState,
  AdminErrorNotice,
  AdminGrowthShell,
  AdminPageHeader,
  SupplierHealthBadge
} from "../components";
import { useAdminGrowthData } from "../use-admin-growth-data";

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
