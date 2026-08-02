"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { RefreshCw, Trophy } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { apiRequest } from "../lib/api-client";

interface RewardCampaign {
  id: string;
  workspaceId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  totalSlots: number;
  claimedSlots: number;
  rewardValueMinor: number;
  currency: string;
  _count: { participants: number; entitlements: number };
  rewardProduct: { name: string; handler: string };
  createdAt: string;
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "warning";
  return "neutral";
}

function formatMinor(amountMinor: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${(amountMinor / 100).toLocaleString()}`;
}

async function listAdminCampaigns(page = 1) {
  return apiRequest<{ campaigns: RewardCampaign[]; total: number }>(
    `/admin/rewards/campaigns?page=${page}`
  );
}

export default function AdminRewardsPage() {
  const [campaigns, setCampaigns] = useState<RewardCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await listAdminCampaigns();
      setCampaigns(data.campaigns);
      setTotal(data.total);
    } catch {
      setError("Could not load reward campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = campaigns.filter((c) => c.status === "ACTIVE").length;
  const totalParticipants = campaigns.reduce((s, c) => s + c._count.participants, 0);
  const totalFulfilled = campaigns.reduce((s, c) => s + c._count.entitlements, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-bold">Reward Campaigns</h1>
            <p className="text-sm text-muted-foreground">{total} campaigns total</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Link href={"/rewards/review-queue" as Route}>
            <Button variant="secondary">Review Queue</Button>
          </Link>
        </div>
      </div>

      <SummaryStatStrip
        items={[
          { label: "Active Campaigns", value: active },
          { label: "Total Participants", value: totalParticipants },
          { label: "Entitlements Issued", value: totalFulfilled },
        ]}
      />

      {error && (
        <Panel>
          <p className="text-sm text-destructive">{error}</p>
        </Panel>
      )}

      {loading && (
        <Panel>
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </Panel>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Campaign</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Slots</th>
                <th className="px-4 py-3 text-right font-medium">Reward</th>
                <th className="px-4 py-3 text-right font-medium">Participants</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.rewardProduct.name} · {c.rewardProduct.handler}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.claimedSlots}/{c.totalSlots}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMinor(c.rewardValueMinor, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c._count.participants}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/rewards/detail?campaignId=${c.id}`}>
                      <Button variant="secondary">Manage</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No campaigns yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
