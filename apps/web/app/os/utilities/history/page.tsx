"use client";

import { useEffect, useState } from "react";
import { Clock, GraduationCap, Trophy, Tv, Zap } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Panel, humanizeStatus } from "@fliptrybe/ui";

import { EmptyState, LoadingBlock } from "../../../campaigns/components";
import { loadBillsOrders, type BillsOrder } from "../vtu-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function UtilitiesHistoryPage() {
  const [orders, setOrders] = useState<BillsOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void loadBillsOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <Panel className="p-5">
        <h2 className="mb-3 font-semibold">Recent bill payments</h2>
        {loading ? (
          <LoadingBlock label="Loading history" />
        ) : orders.length === 0 ? (
          <EmptyState
            copy="Electricity and cable purchases you make will show up here."
            icon={Clock}
            title="No purchases yet"
          />
        ) : (
          <div className="grid gap-2">
            {orders.map((o) => (
              <div
                className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                key={o.id}
              >
                <div className="grid size-9 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                  {o.productType === "CABLE" ? (
                    <Tv className="size-4 text-[var(--ft-accent)]" />
                  ) : o.productType === "BETTING" ? (
                    <Trophy className="size-4 text-[var(--ft-accent)]" />
                  ) : o.productType === "EDUCATION" ? (
                    <GraduationCap className="size-4 text-[var(--ft-accent)]" />
                  ) : (
                    <Zap className="size-4 text-[var(--ft-accent)]" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{formatNaira(o.amountMinor)}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    {o.msisdnMasked} · {new Date(o.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge
                  tone={
                    o.status === "DELIVERED"
                      ? "success"
                      : o.status === "AMBIGUOUS" || o.status === "FAILED"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {humanizeStatus(o.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </motion.div>
  );
}
