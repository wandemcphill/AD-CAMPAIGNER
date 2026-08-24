"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ChevronRight, CircleDollarSign, Gift, PackageSearch, Plane, RefreshCw, Send, ShoppingBag } from "lucide-react";

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

const QUICK_ACTIONS = [
  { label: "Send money", detail: "International transfers", href: "/os/financial-products/remittance", icon: Send },
  { label: "Buy USDT / USDC", detail: "Digital dollars", href: "/os/crypto", icon: CircleDollarSign },
  { label: "Buy or sell gift cards", detail: "Digital value", href: "/os/digital-value", icon: Gift },
  { label: "Buy RMB & pay China", detail: "Live China payments", href: "/os/rmb", icon: ShoppingBag },
  { label: "Book travel", detail: "Flights, safaris & tours", href: "/os/services", icon: Plane }
] as const;

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

  useEffect(() => { void refresh(); }, []);

  const presentSources = useMemo(() => Array.from(new Set(orders.map((order) => order.source))), [orders]);
  const visible = useMemo(() => (filter === "all" ? orders : orders.filter((order) => order.source === filter)), [filter, orders]);
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
          <div className="flex flex-wrap items-center gap-2"><Badge tone="info">Your activity</Badge><Badge tone="neutral">All verticals</Badge></div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ft-text-primary)]">Orders & activity</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">One place to follow what you bought, what is processing and what has completed across FlipTrybe.</p>
        </div>
        <Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw className="size-4 stroke-[1.5]" /> Refresh</Button>
      </header>

      <section className="mt-5 rounded-[26px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Do something else</div><h2 className="mt-1 text-lg font-semibold">Jump straight to a job</h2></div><Link className="text-xs font-semibold text-[var(--ft-accent)]" href="/os">Open command center <ArrowRight className="ml-1 inline size-3.5" /></Link></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_ACTIONS.map((action) => <Link className="group rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-sm)]" href={action.href} key={action.label}>
            <action.icon className="size-4 text-[var(--ft-accent)]" /><div className="mt-3 text-xs font-semibold">{action.label}</div><div className="mt-1 text-[10px] leading-4 text-[var(--ft-text-muted)]">{action.detail}</div><ArrowRight className="mt-3 size-3.5 text-[var(--ft-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--ft-accent)]" />
          </Link>)}
        </div>
      </section>

      {unavailable.length > 0 ? <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4"><AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[var(--ft-amber)]" /><div className="text-sm text-[var(--ft-text-secondary)]"><span className="font-medium text-[var(--ft-text-primary)]">This list may be incomplete.</span>{" "}Couldn&apos;t load {unavailable.map((source) => orderSourceLabels[source]).join(", ")}. Those orders are not shown here.</div></div> : null}

      {presentSources.length > 1 ? <div className="mt-5 flex flex-wrap gap-2"><button className={cn("rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition", filter === "all" ? "border-[var(--ft-text-primary)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-primary)]" : "border-[var(--ft-border)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} onClick={() => setFilter("all")} type="button">All ({orders.length})</button>{presentSources.map((source) => <button className={cn("rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition", filter === source ? "border-[var(--ft-text-primary)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-primary)]" : "border-[var(--ft-border)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]")} key={source} onClick={() => setFilter(source)} type="button">{orderSourceLabels[source]} ({orders.filter((order) => order.source === source).length})</button>)}</div> : null}

      <Panel className="mt-6 overflow-hidden p-0">
        {loading ? <div className="grid gap-3 p-4"><SkeletonBlock className="h-14" /><SkeletonBlock className="h-14" /><SkeletonBlock className="h-14" /></div> : visible.length === 0 ? <div className="p-4"><EmptyState copy="Airtime, data, bills, growth services and transfers you order will appear here." icon={PackageSearch} title="No orders yet" /></div> : grouped.map((group) => <div key={group.month}><div className="sticky top-0 z-10 border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-4 py-2 font-mono text-micro font-medium tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">{group.month}</div>{group.items.map((order) => <Link className="grid gap-3 border-b border-[var(--ft-border)] p-4 transition last:border-b-0 hover:bg-[var(--ft-bg-muted)] xl:grid-cols-[minmax(220px,1fr)_160px_120px_140px_20px] xl:items-center" href={order.href as Route} key={`${order.source}-${order.id}`}><div><div className="font-medium text-[var(--ft-text-primary)]">{order.title}</div><div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{order.detail}</div></div><span className="w-fit rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-0.5 font-mono text-micro tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">{order.sourceLabel}</span><StatusBadge status={order.status} /><div className="font-mono text-sm font-medium text-[var(--ft-text-primary)] xl:text-right">{formatMoney({ amountMinor: order.amountMinor, currency: order.currency })}</div><div className="hidden items-center justify-end text-[var(--ft-text-muted)] xl:flex"><ChevronRight className="size-4 stroke-[1.5]" /></div></Link>)}<div className="px-4 pb-3 text-micro text-[var(--ft-text-muted)]">{group.items.length} order{group.items.length === 1 ? "" : "s"} · {formatWhen(group.items[0]?.createdAt ?? "")}</div></div>)}
      </Panel>
    </>
  );
}
