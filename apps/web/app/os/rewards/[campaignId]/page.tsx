"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { CheckCircle, Circle, Clock, Trophy } from "lucide-react";

import { Badge, Button, Panel, humanizeStatus } from "@fliptrybe/ui";

import {
  getRewardCampaign,
  getLeaderboard,
  submitTaskCompletion,
  type RewardCampaign,
  type LeaderboardEntry,
  type TaskCompletion
} from "../../../rewards/api";
import { ErrorNotice, LoadingBlock, PageHeader } from "../../../campaigns/components";
import Link from "next/link";

function formatMinor(amountMinor: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${(amountMinor / 100).toLocaleString()}`;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  QR_SCAN: "Scan QR Code",
  REFERRAL: "Refer Someone",
  FLIPTRYBE_LINK_VISIT: "Visit Link",
  TIKTOK_IDENTITY_BIND: "Connect TikTok",
  TIKTOK_VIDEO_PUBLISH: "Publish TikTok Video",
  CONTENT_MILESTONE: "Content Milestone",
  MANUAL_PROOF: "Submit Proof"
};

export default function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = use(params);
  const [campaign, setCampaign] = useState<RewardCampaign | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState<string>();
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [campaignData, leaderboardData] = await Promise.all([
        getRewardCampaign(campaignId),
        getLeaderboard(campaignId)
      ]);
      setCampaign(campaignData);
      setLeaderboard(leaderboardData.entries);
    } catch {
      setError("Could not load campaign. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCompleteTask(taskId: string) {
    setSubmitting(taskId);
    try {
      const result = await submitTaskCompletion(taskId);
      setCompletions((prev) => ({ ...prev, [taskId]: result }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not submit task.";
      alert(msg);
    } finally {
      setSubmitting(undefined);
    }
  }

  if (loading) return <div className="p-6"><LoadingBlock label="Loading campaign…" /></div>;
  if (error) return <div className="p-6"><ErrorNotice message={error} /></div>;
  if (!campaign) return null;

  const requiredTasks = campaign.tasks.filter((t) => t.required);
  const slotsProgress = (campaign.claimedSlots / campaign.totalSlots) * 100;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={campaign.name}
        eyebrow={<><Trophy className="h-4 w-4" /><span>Reward Campaign</span></>}
        action={
          <Badge tone={campaign.status === "ACTIVE" ? "success" : "neutral"}>
            {humanizeStatus(campaign.status)}
          </Badge>
        }
      />

      {/* Reward summary */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Reward Value</p>
            <p className="text-2xl font-bold text-primary">
              {formatMinor(campaign.rewardValueMinor, campaign.currency)}
            </p>
            <p className="text-xs text-muted-foreground">{campaign.rewardProduct.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Slots Remaining</p>
            <p className="text-2xl font-bold">
              {campaign.totalSlots - campaign.claimedSlots}
              <span className="text-base font-normal text-muted-foreground">/{campaign.totalSlots}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(slotsProgress, 100)}%` }}
          />
        </div>
      </Panel>

      {/* Tasks */}
      <div>
        <h2 className="mb-3 font-semibold">Tasks to Complete</h2>
        <div className="space-y-2">
          {requiredTasks.map((task) => {
            const completion = completions[task.id];
            const verified = completion?.status === "VERIFIED";
            const pending = completion?.status === "PENDING_VERIFICATION";
            const busy = submitting === task.id;

            return (
              <Panel key={task.id} className="flex items-center gap-4">
                {verified ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                ) : pending ? (
                  <Clock className="h-5 w-5 shrink-0 text-amber-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{task.label}</p>
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                  </p>
                </div>
                {!verified && !pending && task.taskType !== "QR_SCAN" && task.taskType !== "MANUAL_PROOF" && campaign.status === "ACTIVE" && (
                  <Button
                    onClick={() => void handleCompleteTask(task.id)}
                    disabled={busy}
                  >
                    {busy ? "Submitting…" : "Complete"}
                  </Button>
                )}
                {task.taskType === "QR_SCAN" && !verified && !pending && campaign.status === "ACTIVE" && (
                  <Link href="/os/rewards/scan">
                    <Button variant="secondary">Scan QR</Button>
                  </Link>
                )}
                {verified && <Badge tone="success">Done</Badge>}
                {pending && <Badge tone="warning">Pending</Badge>}
              </Panel>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Leaderboard</h2>
          <Panel>
            <div className="divide-y">
              {leaderboard.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-2">
                  <span className="w-8 text-center text-sm font-semibold text-muted-foreground">
                    #{entry.rank}
                  </span>
                  <span className="flex-1 text-sm">{entry.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.tasksCompleted} task{entry.tasksCompleted !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
