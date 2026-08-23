"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Smartphone, WalletCards } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type ProductTab = "overview" | "growth" | "vtu" | "virtual_numbers";

type GrowthService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  price: string;
  marginBps: number;
  preferredSupplier: string;
  routingStrategy: string;
  maxQuantity?: number | null;
  minQuantity?: number | null;
};

type VtuProduct = {
  id: string;
  displayName: string;
  enabled: boolean;
  approved: boolean;
  marginBps: number;
  price?: string | number | null;
  supplierCost?: string | number | null;
};

type VirtualNumberProduct = {
  countryCode: string;
  countryName: string;
  enabled: boolean;
  sellingPrice: string | number;
  cost: string | number;
  margin: string | number;
};

export default function ProductGovernancePage() {
  const { session, status } = useApiSession();
  const [activeTab, setActiveTab] = useState<ProductTab>("overview");
  const [growth, setGrowth] = useState<GrowthService[]>([]);
  const [vtu, setVtu] = useState<VtuProduct[]>([]);
  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumberProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [growthResponse, vtuResponse, virtualNumbersResponse] = await Promise.all([
        apiRequest<{ services: GrowthService[] }>(session, "/v1/admin/commercial/growth"),
        apiRequest<{ products: VtuProduct[] }>(session, "/v1/admin/commercial/vtu"),
        apiRequest<{ countries: VirtualNumberProduct[] }>(session, "/v1/admin/commercial/virtual-numbers")
      ]);
      setGrowth(growthResponse.services ?? []);
      setVtu(vtuResponse.products ?? []);
      setVirtualNumbers(virtualNumbersResponse.countries ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load product governance.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const activeGrowth = growth.filter((product) => product.enabled).length;
    const approvedVtu = vtu.filter((product) => product.approved).length;
    const activeVirtualNumbers = virtualNumbers.filter((product) => product.enabled).length;
    const approvalBacklog = vtu.filter((product) => product.enabled && !product.approved).length;
    return [
      { label: "Growth live", value: activeGrowth.toLocaleString() },
      { label: "VTU approved", value: approvedVtu.toLocaleString() },
      { label: "Virtual Numbers live", value: activeVirtualNumbers.toLocaleString() },
      { label: "VTU approval backlog", value: approvalBacklog.toLocaleString() }
    ];
  }, [growth, vtu, virtualNumbers]);

  if (status === "loading") return <AdminAuthState label="Loading session…" />;
  if (status !== "authenticated") return <AdminAuthState label="Admin authentication required." />;

  return (
    <AdminShell
      title="Product Governance"
      description="Unified view of customer availability, pricing posture, approval state and commercial health."
    >
      <div className="space-y-6">
        <SummaryStatStrip items={metrics} />

        <div className="flex flex-wrap gap-2">
          {(["overview", "growth", "vtu", "virtual_numbers"] as ProductTab[]).map((tab) => (
            <Button key={tab} variant={activeTab === tab ? "primary" : "secondary"} onClick={() => setActiveTab(tab)}>
              {tab === "virtual_numbers" ? "Virtual Numbers" : tab.toUpperCase()}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error ? <Panel><p className="text-sm text-red-600">{error}</p></Panel> : null}

        {activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Panel><div className="flex items-center gap-2"><Boxes className="h-5 w-5" /><span>Growth</span></div><p className="mt-2 text-sm text-slate-500">Supplier, routing, pricing and availability controls.</p></Panel>
            <Panel><div className="flex items-center gap-2"><WalletCards className="h-5 w-5" /><span>VTU</span></div><p className="mt-2 text-sm text-slate-500">Approval, margin floors and supplier-cost protection.</p></Panel>
            <Panel><div className="flex items-center gap-2"><Smartphone className="h-5 w-5" /><span>Virtual Numbers</span></div><p className="mt-2 text-sm text-slate-500">Country pricing and customer availability controls.</p></Panel>
          </div>
        ) : null}

        {activeTab === "growth" ? (
          <Panel>
            <div className="space-y-3">
              {growth.map((product) => (
                <div key={product.code} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.code} · {product.preferredSupplier} · {product.routingStrategy}</p>
                  </div>
                  <Badge>{product.enabled ? "Live" : "Disabled"}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeTab === "vtu" ? (
          <Panel>
            <div className="space-y-3">
              {vtu.map((product) => (
                <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{product.displayName}</p>
                    <p className="text-xs text-slate-500">Margin {product.marginBps} bps</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{product.enabled ? "Enabled" : "Disabled"}</Badge>
                    <Badge>{product.approved ? "Approved" : "Pending"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeTab === "virtual_numbers" ? (
          <Panel>
            <div className="space-y-3">
              {virtualNumbers.map((product) => (
                <div key={product.countryCode} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{product.countryName} ({product.countryCode})</p>
                    <p className="text-xs text-slate-500">Sell {product.sellingPrice} · Cost {product.cost} · Margin {product.margin}</p>
                  </div>
                  <Badge>{product.enabled ? "Live" : "Disabled"}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </AdminShell>
  );
}
