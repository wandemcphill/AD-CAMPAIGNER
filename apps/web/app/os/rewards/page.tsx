"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Plus, QrCode, Trash2, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import {
  addRewardTask,
  createRewardCampaign,
  listRewardCampaigns,
  type RewardCampaign,
  type RewardTaskType
} from "../../rewards/api";
import { loadVoucherProducts, type VoucherProduct } from "../../vouchers/api";
import { ErrorNotice, LoadingBlock, PageHeader } from "../../campaigns/components";
import { SectionTabs, type SectionTab } from "../section-tabs";

const REWARDS_TABS: SectionTab[] = [
  { label: "Reward Campaigns", href: "/os/rewards", icon: Trophy },
  { label: "My Progress", href: "/os/rewards/progress", icon: Gift },
  { label: "Scan QR", href: "/os/rewards/scan", icon: QrCode },
];

const TASK_TYPE_LABELS: Record<RewardTaskType, string> = {
  QR_SCAN: "Scan a QR code",
  REFERRAL: "Refer a friend",
  FLIPTRYBE_LINK_VISIT: "Visit a FlipTrybe link",
  TIKTOK_IDENTITY_BIND: "Connect TikTok account",
  TIKTOK_VIDEO_PUBLISH: "Publish a TikTok video",
  CONTENT_MILESTONE: "Hit a content milestone",
  MANUAL_PROOF: "Submit proof for review"
};

type DraftTask = { taskType: RewardTaskType; label: string; required: boolean };

function NewCampaignPanel({ onCreated }: { onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<VoucherProduct[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState("");
  const [valueNaira, setValueNaira] = useState("");
  const [totalSlots, setTotalSlots] = useState("100");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [tasks, setTasks] = useState<DraftTask[]>([
    { taskType: "QR_SCAN", label: "Scan the campaign QR code", required: true }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open && products.length === 0) {
      void loadVoucherProducts()
        .then(setProducts)
        .catch(() => setError("Could not load reward products."));
    }
  }, [open, products.length]);

  const valid =
    name.trim().length > 0 &&
    productId.length > 0 &&
    Number(valueNaira) > 0 &&
    Number(totalSlots) > 0 &&
    startsAt.length > 0 &&
    tasks.length > 0 &&
    tasks.every((task) => task.label.trim().length > 0);

  function updateTask(index: number, patch: Partial<DraftTask>) {
    setTasks((current) => current.map((task, i) => (i === index ? { ...task, ...patch } : task)));
  }

  function removeTask(index: number) {
    setTasks((current) => current.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!valid) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const campaign = await createRewardCampaign({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        totalSlots: Number(totalSlots),
        rewardProductId: productId,
        rewardValueMinor: Math.round(Number(valueNaira) * 100),
        startsAt: new Date(startsAt).toISOString(),
        ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {})
      });

      // Tasks are added one at a time against the campaign that already
      // exists — if one fails partway, the campaign is real but incomplete
      // rather than silently missing tasks, so say so instead of pretending
      // it all succeeded.
      const failures: string[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]!;
        try {
          await addRewardTask(campaign.id, {
            taskType: task.taskType,
            label: task.label.trim(),
            required: task.required,
            sortOrder: i
          });
        } catch {
          failures.push(task.label);
        }
      }

      if (failures.length > 0) {
        setError(
          `Campaign created, but these tasks couldn't be added: ${failures.join(", ")}. Open the campaign to retry.`
        );
      } else {
        setOpen(false);
        setName("");
        setDescription("");
        setProductId("");
        setValueNaira("");
        setTotalSlots("100");
        setStartsAt("");
        setEndsAt("");
        setTasks([{ taskType: "QR_SCAN", label: "Scan the campaign QR code", required: true }]);
      }
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New campaign
      </Button>
    );
  }

  return (
    <Panel className="p-5">
      <h2 className="text-lg font-semibold">New reward campaign</h2>
      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Campaign name
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Reward product
            <select
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              onChange={(event) => setProductId(event.target.value)}
              value={productId}
            >
              <option value="">Choose a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Description
          <textarea
            className="min-h-16 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-sm"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Reward value (NGN)
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              inputMode="decimal"
              onChange={(event) => setValueNaira(event.target.value)}
              value={valueNaira}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Total slots
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              inputMode="numeric"
              onChange={(event) => setTotalSlots(event.target.value)}
              value={totalSlots}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Starts
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              onChange={(event) => setStartsAt(event.target.value)}
              type="date"
              value={startsAt}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Ends (optional)
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
              onChange={(event) => setEndsAt(event.target.value)}
              type="date"
              value={endsAt}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tasks to complete</span>
            <Button
              onClick={() =>
                setTasks((current) => [...current, { taskType: "MANUAL_PROOF", label: "", required: true }])
              }
              type="button"
              variant="secondary"
            >
              <Plus className="size-4" />
              Add task
            </Button>
          </div>
          {tasks.map((task, index) => (
            <div className="grid gap-2 rounded-md border border-[var(--ft-border)] p-3 sm:grid-cols-[1fr_1.4fr_auto_auto]" key={index}>
              <select
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
                onChange={(event) => updateTask(index, { taskType: event.target.value as RewardTaskType })}
                value={task.taskType}
              >
                {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm"
                onChange={(event) => updateTask(index, { label: event.target.value })}
                placeholder="What the participant sees"
                value={task.label}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  checked={task.required}
                  className="size-4 accent-[var(--ft-accent)]"
                  onChange={(event) => updateTask(index, { required: event.target.checked })}
                  type="checkbox"
                />
                Required
              </label>
              <Button
                disabled={tasks.length === 1}
                onClick={() => removeTask(index)}
                type="button"
                variant="secondary"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        {error ? <ErrorNotice message={error} /> : null}

        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="secondary">
            Cancel
          </Button>
          <Button disabled={!valid || submitting} onClick={() => void handleCreate()}>
            {submitting ? "Creating..." : "Create campaign"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

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

      <SectionTabs items={REWARDS_TABS} />

      <NewCampaignPanel onCreated={refresh} />

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
            <Link key={campaign.id} href={`/os/rewards/${campaign.id}`}>
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
