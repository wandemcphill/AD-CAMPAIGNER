"use client";

import { useState } from "react";
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";

import { Badge } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

const PERIOD_TABS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

const METRICS = [
  { label: "Revenue", value: "₦4.2M", change: "+12.5%", icon: DollarSign },
  { label: "Users", value: "12,847", change: "+8.2%", icon: Users },
  { label: "Orders", value: "3,291", change: "+15.3%", icon: ShoppingCart },
  { label: "Avg. Order", value: "₦12,800", change: "+2.1%", icon: TrendingUp },
];

const CHART_DATA = [
  { day: "Mon", revenue: 420000, orders: 48 },
  { day: "Tue", revenue: 580000, orders: 62 },
  { day: "Wed", revenue: 710000, orders: 78 },
  { day: "Thu", revenue: 640000, orders: 71 },
  { day: "Fri", revenue: 890000, orders: 94 },
  { day: "Sat", revenue: 520000, orders: 55 },
  { day: "Sun", revenue: 340000, orders: 38 },
];

const TOP_PRODUCTS = [
  { name: "MTN Airtime", sales: 1284, revenue: "₦1.8M", share: 42 },
  { name: "Glo Data 10GB", sales: 641, revenue: "₦890K", share: 21 },
  { name: "MTN Data 5GB", sales: 412, revenue: "₦520K", share: 12 },
  { name: "Steam Gift Card", sales: 156, revenue: "₦420K", share: 10 },
  { name: "FlipTrybe Voucher", sales: 324, revenue: "₦380K", share: 9 },
];

const maxRevenue = Math.max(...CHART_DATA.map((d) => d.revenue));

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Revenue, conversions, and product performance</p>
        </div>
        <TabBar items={PERIOD_TABS} onChange={setPeriod} value={period} />
      </div>

      {/* Metric cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => (
          <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4" key={m.label}>
            <div className="flex items-center justify-between">
              <m.icon className="size-5 text-[var(--ft-text-muted)]" />
              <Badge tone="success">{m.change}</Badge>
            </div>
            <div className="mt-3 text-2xl font-bold">{m.value}</div>
            <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart (CSS bar chart) */}
      <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Revenue Trend</h2>
        </div>
        <div className="mt-6 flex items-end gap-3" style={{ height: 200 }}>
          {CHART_DATA.map((d) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={d.day}>
              <span className="font-mono text-[10px] text-[var(--ft-text-muted)]">
                {(d.revenue / 1000).toFixed(0)}K
              </span>
              <div
                className="w-full rounded-t-[var(--radius-sm)] bg-[var(--ft-accent)] transition-all"
                style={{ height: `${(d.revenue / maxRevenue) * 160}px` }}
              />
              <span className="text-xs text-[var(--ft-text-muted)]">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top products */}
      <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <h2 className="font-semibold">Top Products</h2>
        <div className="mt-4 grid gap-3">
          {TOP_PRODUCTS.map((product, i) => (
            <div className="flex items-center gap-4" key={product.name}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ft-bg-muted)] font-mono text-xs font-medium">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{product.name}</span>
                  <span className="font-mono text-xs text-[var(--ft-text-muted)]">{product.revenue}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ft-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--ft-accent)] transition-all"
                    style={{ width: `${product.share}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs text-[var(--ft-text-muted)]">{product.sales} sales</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
