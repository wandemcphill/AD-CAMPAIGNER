"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, Undo2 } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

type VtuOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "PROCESSING"
  | "DELIVERED"
  | "FAILED"
  | "REVERSED"
  | "AMBIGUOUS";

type VtuBillsOrder = {
  id: string;
  productType: "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION";
  amountMinor: number;
  currency: string;
  providerName: string | null;
  providerReference: string | null;
  status: VtuOrderStatus;
  failureReason: string | null;
  createdAt: string;
  workspace: { id: string; name: string };
};

const STATUS_TONE: Record<VtuOrderStatus, "success" | "warning" | "danger" | "neutral"> = {
  QUOTED: "neutral",
  CHARGED: "neutral",
  PROCESSING: "neutral",
  DELIVERED: "success",
  FAILED: "danger",
  REVERSED: "warning",
  AMBIGUOUS: "danger"
};

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminVtuBillsOrdersPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [orders, setOrders] = useState<VtuBillsOrder[]>([]);
  const [onlyAmbiguous, setOnlyAmbiguous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const query = onlyAmbiguous ? "?status=AMBIGUOUS" : "";
      const data = await apiRequest<VtuBillsOrder[]>(`/admin/vtu/bills/orders${query}`);
      setOrders(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load bills orders.");
    } finally {
      setLoading(false);
    }
  }, [onlyAmbiguous]);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) {
      void refresh();
    }
  }, [sessionLoading, session, refresh]);

  async function resolve(id: string, resolution: "DELIVERED" | "REVERSED") {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/vtu/orders/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resolve this order.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="VTU bills orders auth" />;
  }

  return (
    <AdminShell active="/vtu/orders/">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Bills orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="text-xs rounded border border-[var(--ft-border)] px-3 py-1.5 text-[var(--ft-text-secondary)] transition-colors hover:border-[var(--ft-accent)] hover:text-[var(--ft-text-primary)]"
              href="/vtu/"
            >
              ← Routing
            </a>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Electricity, cable, betting, and education orders. An order can only be resolved
          manually while it's <strong>AMBIGUOUS</strong> — the provider didn't confirm delivery, so
          the wallet charge is on hold until an ops call: mark it delivered, or reverse the charge.
        </p>

        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
          <input
            checked={onlyAmbiguous}
            className="size-4 accent-[var(--ft-accent)]"
            onChange={(event) => setOnlyAmbiguous(event.target.checked)}
            type="checkbox"
          />
          Ambiguous only (needs a decision)
        </label>

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading orders...</Panel>
          ) : orders.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              {onlyAmbiguous ? "Nothing needs a decision right now." : "No bills orders in range."}
            </Panel>
          ) : (
            orders.map((order) => (
              <Panel className="flex items-start gap-4 p-4" key={order.id}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--ft-text-primary)]">
                      {order.productType} · {formatNaira(order.amountMinor)}
                    </span>
                    <Badge tone={STATUS_TONE[order.status]}>{order.status.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                    {order.workspace.name} · {order.providerName ?? "no provider"}
                    {order.providerReference ? ` · ${order.providerReference}` : ""} ·{" "}
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                  {order.failureReason ? (
                    <div className="mt-1 text-xs text-[var(--ft-red)]">{order.failureReason}</div>
                  ) : null}
                </div>
                {order.status === "AMBIGUOUS" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      disabled={busyId !== undefined}
                      onClick={() => void resolve(order.id, "DELIVERED")}
                    >
                      <CheckCircle2 className="size-4" />
                      {busyId === order.id ? "Saving..." : "Mark delivered"}
                    </Button>
                    <Button
                      disabled={busyId !== undefined}
                      onClick={() => void resolve(order.id, "REVERSED")}
                      variant="danger"
                    >
                      <Undo2 className="size-4" />
                      Reverse charge
                    </Button>
                  </div>
                ) : null}
              </Panel>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}
