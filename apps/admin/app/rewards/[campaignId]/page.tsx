"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle, RefreshCw, Trophy, XCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { apiRequest } from "../../lib/api-client";

interface TaskCompletion {
  id: string;
  status: string;
  createdAt: string;
  task: { label: string; taskType: string; campaign?: { id: string } };
  participant: {
    user: { name: string; displayName?: string; email?: string };
  };
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  totalSlots: number;
  claimedSlots: number;
  rewardValueMinor: number;
  currency: string;
  tasks: Array<{ id: string; taskType: string; label: string; required: boolean }>;
  _count: { participants: number; entitlements: number };
}

function formatMinor(amountMinor: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${(amountMinor / 100).toLocaleString()}`;
}

export default function AdminCampaignDetailPage({
  params
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [reviewQueue, setReviewQueue] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [resolving, setResolving] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [campaignData, reviewData] = await Promise.all([
        apiRequest<{ campaigns: CampaignDetail[] }>(`/admin/rewards/campaigns`).then(
          (r) => r.campaigns?.find((c) => c.id === campaignId) ?? null
        ),
        apiRequest<{ completions: TaskCompletion[] }>("/admin/rewards/review-queue")
      ]);
      setCampaign(campaignData);
      setReviewQueue(
        reviewData.completions.filter((c) => c.task?.campaign?.id === campaignId)
      );
    } catch {
      setError("Could not load campaign details.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function resolveCompletion(id: string, resolution: "VERIFIED" | "REJECTED") {
    setResolving(id);
    try {
      await apiRequest(`/admin/rewards/completions/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution })
      });
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not resolve completion.");
    } finally {
      setResolving(undefined);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!campaign) return <div className="p-6 text-sm text-muted-foreground">Campaign not found.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">
              {campaign.claimedSlots}/{campaign.totalSlots} slots claimed ·{" "}
              {formatMinor(campaign.rewardValueMinor, campaign.currency)} per reward
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Tasks */}
      <Panel>
        <h2 className="mb-3 font-semibold">Tasks</h2>
        <div className="space-y-2">
          {campaign.tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 text-sm">
              <span className="font-medium">{task.label}</span>
              <Badge tone="neutral">{task.taskType}</Badge>
              {task.required && <Badge tone="info">Required</Badge>}
            </div>
          ))}
          {campaign.tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks added yet.</p>
          )}
        </div>
      </Panel>

      {/* Manual review queue */}
      {reviewQueue.length > 0 && (
        <Panel>
          <h2 className="mb-3 font-semibold">Pending Manual Review ({reviewQueue.length})</h2>
          <div className="divide-y">
            {reviewQueue.map((completion) => (
              <div key={completion.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {completion.participant.user.displayName ?? completion.participant.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {completion.task.label} · {new Date(completion.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                                       onClick={() => void resolveCompletion(completion.id, "VERIFIED")}
                    disabled={resolving === completion.id}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                                       variant="secondary"
                    onClick={() => void resolveCompletion(completion.id, "REJECTED")}
                    disabled={resolving === completion.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{campaign._count.participants} participants</span>
        <span>{campaign._count.entitlements} entitlements issued</span>
        <Link href={"/rewards" as Route} className="underline">Back to campaigns</Link>
      </div>
    </div>
  );
}
