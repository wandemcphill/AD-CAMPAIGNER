"use client";

import { AlertTriangle, ArrowUpRight, Bot, DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { KpiCard, AlertBanner } from "@fliptrybe/ui/components";

const KPIS = [
  { label: "Total Users", value: "12,847", delta: "+8.2%", deltaTone: "up" as const, Icon: Users },
  { label: "Revenue (MTD)", value: "₦4.2M", delta: "+12.5%", deltaTone: "up" as const, Icon: DollarSign },
  { label: "Orders Today", value: "347", delta: "-3.1%", deltaTone: "down" as const, Icon: ShoppingCart },
  { label: "Conversion Rate", value: "4.7%", delta: "+0.6%", deltaTone: "up" as const, Icon: TrendingUp },
];

const AI_INSIGHTS = [
  { id: "1", text: "Revenue is up 12.5% this month — driven by a surge in airtime purchases from returning users.", type: "positive" as const },
  { id: "2", text: "3 payment providers show degraded latency (>2s). Consider monitoring Korapay and Paystack endpoints.", type: "warning" as const },
  { id: "3", text: "User signups spiked 40% after the Instagram campaign launch on July 24.", type: "positive" as const },
];

const RECENT_ALERTS = [
  { id: "1", text: "Korapay webhook timeout detected — 3 transactions pending reconciliation", tone: "warning" as const },
  { id: "2", text: "Unusual login pattern: 5 failed attempts from IP 102.89.x.x", tone: "danger" as const },
];

export default function AdminDashboardPage() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Overview of your platform health and metrics</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="success">All systems operational</Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 10 }}
            key={kpi.label}
            transition={{ delay: i * 0.05 }}
          >
            <KpiCard
              delta={kpi.delta}
              deltaTone={kpi.deltaTone}
              icon={<kpi.Icon className="size-4" />}
              label={kpi.label}
              value={kpi.value}
            />
          </motion.div>
        ))}
      </div>

      {/* AI Insights + Alerts */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[var(--ft-accent)]" />
            <h2 className="font-semibold">AI Insights</h2>
            <Badge tone="info">Auto-generated</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {AI_INSIGHTS.map((insight) => (
              <div
                className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"
                key={insight.id}
              >
                <div className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                  insight.type === "positive" ? "bg-[var(--ft-green)]/10" : "bg-[var(--ft-yellow)]/10"
                }`}>
                  {insight.type === "positive"
                    ? <ArrowUpRight className="size-3.5 text-[var(--ft-green)]" />
                    : <AlertTriangle className="size-3.5 text-[var(--ft-yellow)]" />
                  }
                </div>
                <p className="text-sm leading-relaxed text-[var(--ft-text-secondary)]">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[var(--ft-yellow)]" />
            <h2 className="font-semibold">Active Alerts</h2>
            <Badge tone="warning">{RECENT_ALERTS.length}</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {RECENT_ALERTS.map((alert) => (
              <AlertBanner key={alert.id} tone={alert.tone}>
                {alert.text}
              </AlertBanner>
            ))}
          </div>
          <Button className="mt-4 w-full justify-center" variant="secondary">
            View all alerts
          </Button>
        </div>
      </div>
    </div>
  );
}
