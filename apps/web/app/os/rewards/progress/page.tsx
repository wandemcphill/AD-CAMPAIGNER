"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Trophy } from "lucide-react";

import { Badge, Panel } from "@fliptrybe/ui";

import { getMyProgress, type RewardProgress } from "../../../rewards/api";
import { ErrorNotice, LoadingBlock, PageHeader } from "../../../campaigns/components";

function formatMinor(amountMinor: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${(amountMinor / 100).toLocaleString()}`;
}

function entitlementTone(status: string): "success" | "warning" | "neutral" {
  if (status === "FULFILLED") return "success";
  if (status === "FULFILLMENT_PENDING" || status === "RESERVED") return "warning";
  return "neutral";
}

export default function MyProgressPage() {
  const [progress, setProgress] = useState<RewardProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await getMyProgress();
      setProgress(data);
    } catch {
      setError("Could not load your progress. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Progress"
        eyebrow={<><Gift className="h-4 w-4" /><span>Rewards</span></>}
      />

      {loading && <LoadingBlock label="Loading progress…" />}
      {error && <ErrorNotice message={error} />}

      {!loading && !error && progress.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Gift className="h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">You haven't joined any reward campaigns yet.</p>
            <Link href={"/os/rewards" as any} className="text-sm text-primary underline">
              Browse campaigns
            </Link>
          </div>
        </Panel>
      )}

      {!loading && progress.length > 0 && (
        <div className="space-y-4">
          {progress.map((item) => (
            <Link key={item.campaign.id} href={`/os/rewards/${item.campaign.id}` as any}>
              <Panel className="cursor-pointer transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{item.campaign.name}</h3>
                  </div>
                  <Badge tone={item.campaign.status === "ACTIVE" ? "success" : "neutral"} >
                    {item.campaign.status}
                  </Badge>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tasks</span>
                    <span>{item.tasksCompleted}/{item.totalTasks}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${item.totalTasks > 0 ? (item.tasksCompleted / item.totalTasks) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                {item.entitlement && (
                  <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="text-sm font-medium">
                      {formatMinor(item.entitlement.rewardValueMinor, item.entitlement.currency)} reward
                    </span>
                    <Badge tone={entitlementTone(item.entitlement.status)} >
                      {item.entitlement.status.replace("_", " ")}
                    </Badge>
                  </div>
                )}
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
