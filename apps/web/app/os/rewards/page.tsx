"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { listRewardCampaigns, type RewardCampaign } from "../../rewards/api";
import { ErrorNotice, LoadingBlock, PageHeader } from "../../campaigns/components";

function statusColor(status: RewardCampaign["status"]) {
  if (status === "ACTIVE") return "success";
  if (status === "COMPLETED") return "neutral";
  if (status === "PAUSED") return "warning";
  return "neutral";
}

function formatMinor(amountMinor: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${(amountMinor / 100).toLocaleString()}`;
}

export default function RewardsPage() {
  const [campaigns, setCampaigns] = useState<RewardCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const { campaigns: list } = await listRewardCampaigns();
      setCampaigns(list);
    } catch {
      setError("Could not load reward campaigns. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const slotsRemaining = active.reduce((sum, c) => sum + (c.totalSlots - c.claimedSlots), 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reward Campaigns"
        eyebrow={<><Trophy className="h-4 w-4" /><span>Rewards</span></>}
      />

      <SummaryStatStrip
        items={[
          { label: "Active Campaigns", value: active.length },
          { label: "Slots Remaining", value: slotsRemaining },
          { label: "Total Campaigns", value: campaigns.length },
        ]}
      />

      {loading && <LoadingBlock label="Loading campaigns…" />}
      {error && <ErrorNotice message={error} />}

      {!loading && !error && campaigns.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No reward campaigns yet.</p>
          </div>
        </Panel>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/os/rewards/${campaign.id}` as any}>
              <Panel className="cursor-pointer transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{campaign.name}</h3>
                  <Badge tone={statusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </div>

                {campaign.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {campaign.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{campaign.claimedSlots}/{campaign.totalSlots} slots</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-primary">
                    <Zap className="h-4 w-4" />
                    <span>{formatMinor(campaign.rewardValueMinor, campaign.currency)}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min((campaign.claimedSlots / campaign.totalSlots) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{campaign.tasks.filter((t) => t.required).length} task{campaign.tasks.filter((t) => t.required).length !== 1 ? "s" : ""} to complete</span>
                  <span>{campaign.rewardProduct.name}</span>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
