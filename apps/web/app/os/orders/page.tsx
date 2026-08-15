"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight, PackageSearch, RefreshCw } from "lucide-react";

import { Badge, Button, Panel, SkeletonBlock, StatusBadge, cn } from "@fliptrybe/ui";

import { EmptyState } from "../../campaigns/components";
import { formatMoney } from "../../lib/api-client";
import {
  loadAllOrders,
  orderSourceLabels,
  type UnifiedOrder,
  type UnifiedOrderSource
} from "./api";

function formatWhen(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function monthOf(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recent";

  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(date);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [unavailable, setUnavailable] = useState<UnifiedOrderSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UnifiedOrderSource | "all">("all");

  async function refresh() {
    setLoading(true);
    try {
      const result = await loadAllOrders();
      setOrders(result.orders);
      setUnavailable(result.unavailable);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Only offer filters for sources that actually returned something.
  const presentSources = useMemo(
    () => Array.from(new Set(orders.map((order) => order.source))),
    [orders]
  );

  const visible = useMemo(
    () => (filter === "all" ? orders : orders.filter((order) => order.source === filter)),
    [filter, orders]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, UnifiedOrder[]>();

    visible.forEach((order) => {
      const month = monthOf(order.createdAt);
      groups.set(month, [...(groups.get(month) ?? []), order]);
    });

    return Array.from(groups.entries()).map(([month, items]) => ({ items, month }));
  }, [visible]);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">All verticals</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ft-text-primary)]">Your orders</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Everything you have ordered across FlipTrybe, newest first.
          </p>
        </div>
        <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
          <RefreshCw className="size-4 stroke-[1.5]" />
          Refresh
        </Button>
      </header>

      {unavailable.length > 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[var(--ft-amber)]" />
          <div className="text-sm text-[var(--ft-text-secondary)]">
            <span className="font-medium text-[var(--ft-text-primary)]">
              This list may be incomplete.
            </span>{" "}
            Couldn&apos;t load {unavailable.map((source) => orderSourceLabels[source]).join(", ")}.
            Those orders are not shown here.
          </div>
        </div>
      ) : null}

      {presentSources.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className={cn(
              "rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition",
              filter === "all"
                ? "border-[var(--ft-text-primary)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-primary)]"
                : "border-[var(--ft-border)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
            )}
            onClick={() => setFilter("all")}
            type="button"
          >
            All ({orders.length})
          </button>
          {presentSources.map((source) => (
            <button
              className={cn(
                "rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition",
                filter === source
                  ? "border-[var(--ft-text-primary)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-primary)]"
                  : "border-[var(--ft-border)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
              )}
              key={source}
              onClick={() => setFilter(source)}
              type="button"
            >
              {orderSourceLabels[source]} (
              {orders.filter((order) => order.source === source).length})
            </button>
          ))}
        </div>
      ) : null}

      <Panel className="mt-6 overflow-hidden p-0">
        {loading ? (
          <div className="grid gap-3 p-4">
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              copy="Airtime, data, bills, growth services and transfers you order will appear here."
              icon={PackageSearch}
              title="No orders yet"
            />
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.month}>
              <div className="sticky top-0 z-10 border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">
                {group.month}
              </div>
              {group.items.map((order) => (
                <Link
                  className="grid gap-3 border-b border-[var(--ft-border)] p-4 transition last:border-b-0 hover:bg-[var(--ft-bg-muted)] xl:grid-cols-[minmax(220px,1fr)_160px_120px_140px_20px] xl:items-center"
                  // Routes are built per-source above; typedRoutes can't narrow
                  // a string carried through the unified shape.
                  href={order.href as Route}
                  key={`${order.source}-${order.id}`}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{order.title}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                      {order.detail}
                    </div>
                  </div>
                  <span className="w-fit rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">
                    {order.sourceLabel}
                  </span>
                  <StatusBadge status={order.status} />
                  <div className="font-mono text-sm font-medium text-[var(--ft-text-primary)] xl:text-right">
                    {formatMoney({ amountMinor: order.amountMinor, currency: order.currency })}
                  </div>
                  <div className="hidden items-center justify-end text-[var(--ft-text-muted)] xl:flex">
                    <ChevronRight className="size-4 stroke-[1.5]" />
                  </div>
                </Link>
              ))}
              <div className="px-4 pb-3 text-[11px] text-[var(--ft-text-muted)]">
                {group.items.length} order{group.items.length === 1 ? "" : "s"} ·{" "}
                {formatWhen(group.items[0]?.createdAt ?? "")}
              </div>
            </div>
          ))
        )}
      </Panel>
    </>
  );
}
