"use client";

import { useState } from "react";
import { Gift, Phone, Signal, Ticket, Wifi } from "lucide-react";

import { Badge } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

type Product = {
  id: string;
  name: string;
  category: "airtime" | "data" | "gift_card" | "voucher";
  provider: string;
  price: string;
  status: "active" | "inactive";
  sales: number;
};

const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "MTN Airtime", category: "airtime", provider: "VTPass", price: "₦100 - ₦50K", status: "active", sales: 2841 },
  { id: "2", name: "Glo Airtime", category: "airtime", provider: "VTPass", price: "₦100 - ₦50K", status: "active", sales: 1203 },
  { id: "3", name: "MTN 10GB Data", category: "data", provider: "VTPass", price: "₦4,500", status: "active", sales: 892 },
  { id: "4", name: "Airtel 5GB Data", category: "data", provider: "VTPass", price: "₦2,500", status: "active", sales: 641 },
  { id: "5", name: "Steam Gift Card", category: "gift_card", provider: "Reloadly", price: "$10 - $100", status: "active", sales: 156 },
  { id: "6", name: "Amazon Gift Card", category: "gift_card", provider: "Reloadly", price: "$25 - $500", status: "inactive", sales: 89 },
  { id: "7", name: "FlipTrybe Voucher", category: "voucher", provider: "Internal", price: "₦1K - ₦50K", status: "active", sales: 324 },
];

const CATEGORY_ICONS: Record<string, typeof Phone> = {
  airtime: Phone,
  data: Wifi,
  gift_card: Gift,
  voucher: Ticket,
};

const TABS = [
  { id: "all", label: "All", count: 7 },
  { id: "airtime", label: "Airtime", count: 2 },
  { id: "data", label: "Data", count: 2 },
  { id: "gift_card", label: "Gift Cards", count: 2 },
  { id: "voucher", label: "Vouchers", count: 1 },
];

export default function ProductsPage() {
  const [tab, setTab] = useState("all");

  const filtered = MOCK_PRODUCTS.filter((p) => tab === "all" || p.category === tab);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">Digital Products</h1>
      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Manage airtime, data, gift cards, and vouchers</p>

      <div className="mt-6">
        <TabBar items={TABS} onChange={setTab} value={tab} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((product) => {
          const Icon = CATEGORY_ICONS[product.category] || Signal;
          return (
            <div
              className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/30"
              key={product.id}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10">
                    <Icon className="size-5 text-[var(--ft-accent)]" />
                  </div>
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">{product.provider}</div>
                  </div>
                </div>
                <Badge tone={product.status === "active" ? "success" : "neutral"}>{product.status}</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--ft-border)] pt-3">
                <div>
                  <div className="text-xs text-[var(--ft-text-muted)]">Price range</div>
                  <div className="font-mono text-sm font-medium">{product.price}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--ft-text-muted)]">Total sales</div>
                  <div className="font-mono text-sm font-medium">{product.sales.toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
