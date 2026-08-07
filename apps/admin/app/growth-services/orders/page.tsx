"use client";

import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { updateGrowthOrder } from "../api";
import {
  AdminErrorNotice,
  AdminGrowthShell,
  AdminGrowthStatusBadge,
  AdminPageHeader
} from "../components";
import type { AdminGrowthOrder, AdminGrowthStatus } from "../data";
import { useAdminGrowthData } from "../use-admin-growth-data";

const statuses: AdminGrowthStatus[] = [
  "PENDING",
  "SUBMITTED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "REFUNDED"
];

export default function AdminGrowthOrdersPage() {
  const { error, loading, orders, refresh, suppliers } = useAdminGrowthData();
  const [savingId, setSavingId] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function saveOrder(order: AdminGrowthOrder, formData: FormData) {
    setSavingId(order.id);
    setMessage(undefined);

    try {
      await updateGrowthOrder(order.id, {
        status: getFormString(formData, "status", order.status) as AdminGrowthStatus,
        quantityDelivered: Number(formData.get("quantityDelivered") ?? order.quantityDelivered),
        supplierName: getFormString(formData, "supplierName"),
        supplierReference: getFormString(formData, "supplierReference"),
        adminNote: getFormString(formData, "adminNote"),
        failureReason: getFormString(formData, "failureReason")
      });
      setMessage(`${order.id} updated.`);
      await refresh();
    } catch (caught) {
      const caughtMessage = caught instanceof Error ? caught.message : "Order update failed.";
      setMessage(caughtMessage);
    } finally {
      setSavingId(undefined);
    }
  }

  return (
    <AdminGrowthShell active="/growth-services/orders/">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Order lifecycle</Badge>
            <Badge tone="warning">Manual overrides</Badge>
          </>
        }
        title="Growth orders"
      />

      <AdminErrorNotice message={error} />
      {message ? (
        <div className="mt-4 rounded-md border border-[var(--ft-blue)]/40 bg-[var(--ft-blue-subtle)] p-3 text-sm text-[var(--ft-blue)]">
          {message}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4">
        {orders.length === 0 ? (
          <Panel className="p-4 text-sm text-[var(--ft-text-muted)]">No Growth orders yet</Panel>
        ) : (
          orders.map((order) => (
            <Panel className="p-4" key={order.id}>
              <form
                className="grid gap-4 xl:grid-cols-[1fr_1.4fr_auto] xl:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveOrder(order, new FormData(event.currentTarget));
                }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--ft-text-primary)]">
                      {order.serviceName}
                    </h2>
                    <AdminGrowthStatusBadge status={order.status} />
                    <Badge tone="info">{order.platform}</Badge>
                  </div>
                  <div className="mt-2 text-sm break-all text-[var(--ft-text-muted)]">
                    {order.destinationUrl}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <Stat label="Ordered" value={order.quantityOrdered.toLocaleString()} />
                    <Stat label="Delivered" value={order.quantityDelivered.toLocaleString()} />
                    <Stat label="Amount" value={order.amount} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Status
                    <select
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      defaultValue={order.status}
                      name="status"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Delivered
                    <input
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      defaultValue={order.quantityDelivered}
                      max={order.quantityOrdered}
                      min={0}
                      name="quantityDelivered"
                      type="number"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Supplier
                    <select
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      defaultValue={order.supplierName}
                      name="supplierName"
                    >
                      <option value="">Unassigned</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.name} value={supplier.name}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)] sm:col-span-2">
                    Supplier reference
                    <input
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      defaultValue={
                        order.supplierReference === "Pending" ? "" : order.supplierReference
                      }
                      name="supplierReference"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Failure reason
                    <input
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      name="failureReason"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)] sm:col-span-2 xl:col-span-3">
                    Admin note
                    <textarea
                      className="min-h-20 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]"
                      name="adminNote"
                    />
                  </label>
                </div>

                <Button disabled={savingId === order.id} type="submit">
                  <Save className="size-4" />
                  Save
                </Button>
              </form>
            </Panel>
          ))
        )}
      </section>
    </AdminGrowthShell>
  );
}

function getFormString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);

  return typeof value === "string" ? value : fallback;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--ft-bg-muted)] p-3">
      <div className="font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
        {value}
      </div>
    </div>
  );
}
