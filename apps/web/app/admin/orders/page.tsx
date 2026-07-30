"use client";

import { useState } from "react";
import { Eye, Package, Search } from "lucide-react";

import { Badge } from "@fliptrybe/ui";
import { TabBar, KanbanColumn, Drawer } from "@fliptrybe/ui/components";

type Order = {
  id: string;
  reference: string;
  user: string;
  product: string;
  amount: string;
  status: "pending" | "processing" | "fulfilled" | "failed" | "refunded";
  createdAt: string;
};

const MOCK_ORDERS: Order[] = [
  { id: "1", reference: "ORD-001847", user: "Tunde Okoro", product: "Airtime ₦5,000", amount: "₦5,000", status: "fulfilled", createdAt: "2025-07-29 14:30" },
  { id: "2", reference: "ORD-001848", user: "Amara Kalu", product: "Data 10GB MTN", amount: "₦4,500", status: "processing", createdAt: "2025-07-29 14:15" },
  { id: "3", reference: "ORD-001849", user: "Chi Studios", product: "Gift Card ₦10K", amount: "₦10,000", status: "pending", createdAt: "2025-07-29 13:50" },
  { id: "4", reference: "ORD-001850", user: "Segun Balogun", product: "Airtime ₦2,000", amount: "₦2,000", status: "failed", createdAt: "2025-07-29 13:20" },
  { id: "5", reference: "ORD-001851", user: "Nneka M.", product: "Data 5GB Glo", amount: "₦2,500", status: "refunded", createdAt: "2025-07-29 12:45" },
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  pending: "warning",
  processing: "info",
  fulfilled: "success",
  failed: "danger",
  refunded: "neutral",
};

const VIEW_TABS = [
  { id: "table", label: "Table" },
  { id: "kanban", label: "Kanban" },
];

const KANBAN_COLS = ["pending", "processing", "fulfilled", "failed"] as const;

export default function OrdersPage() {
  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order>();

  const filtered = MOCK_ORDERS.filter((o) =>
    !search || o.reference.toLowerCase().includes(search.toLowerCase()) || o.user.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Track and manage all platform orders</p>
        </div>
        <TabBar items={VIEW_TABS} onChange={setView} value={view} />
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
        <input
          className="h-9 w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--ft-accent)]"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders..."
          value={search}
        />
      </div>

      {view === "table" ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ft-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">User</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Product</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Date</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ft-border)]">
              {filtered.map((order) => (
                <tr className="bg-[var(--ft-bg-raised)] transition hover:bg-[var(--ft-bg-muted)]" key={order.id}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{order.reference}</td>
                  <td className="px-4 py-3">{order.user}</td>
                  <td className="px-4 py-3">{order.product}</td>
                  <td className="px-4 py-3 font-mono text-xs">{order.amount}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{order.status}</Badge></td>
                  <td className="px-4 py-3 text-[var(--ft-text-muted)]">{order.createdAt}</td>
                  <td className="px-4 py-3">
                    <button className="text-[var(--ft-text-muted)] hover:text-[var(--ft-accent)]" onClick={() => setSelected(order)} type="button">
                      <Eye className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLS.map((col) => {
            const items = MOCK_ORDERS.filter((o) => o.status === col);
            return (
              <KanbanColumn count={items.length} key={col} title={col}>
                {items.map((order) => (
                  <button
                    className="w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-3 text-left transition hover:border-[var(--ft-accent)]/40"
                    key={order.id}
                    onClick={() => setSelected(order)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium">{order.reference}</span>
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{order.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm">{order.user}</div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{order.product} — {order.amount}</div>
                  </button>
                ))}
              </KanbanColumn>
            );
          })}
        </div>
      )}

      <Drawer onClose={() => setSelected(undefined)} open={Boolean(selected)} title="Order Details">
        {selected && (
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Package className="size-5 text-[var(--ft-accent)]" />
              <span className="font-mono text-lg font-bold">{selected.reference}</span>
            </div>
            {[
              { label: "User", value: selected.user },
              { label: "Product", value: selected.product },
              { label: "Amount", value: selected.amount },
              { label: "Status", value: selected.status },
              { label: "Created", value: selected.createdAt },
            ].map((item) => (
              <div className="flex justify-between border-b border-[var(--ft-border)] pb-2 text-sm" key={item.label}>
                <span className="text-[var(--ft-text-muted)]">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
