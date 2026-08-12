"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Copy, QrCode, RefreshCw, ShieldCheck, Trophy, XCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";
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

interface RewardQrCode {
  id: string;
  token: string;
  maxScans: number;
  scanCount: number;
  expiresAt: string;
  taskId: string;
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

export default function AdminCampaignDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</div>}>
      <AdminCampaignDetailContent />
    </Suspense>
  );
}

function AdminCampaignDetailContent() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? "";
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [reviewQueue, setReviewQueue] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [resolving, setResolving] = useState<string>();
  const [qrCodes, setQrCodes] = useState<RewardQrCode[]>([]);
  const [qrTaskId, setQrTaskId] = useState("");
  const [qrCount, setQrCount] = useState("10");
  const [qrExpiresAt, setQrExpiresAt] = useState("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState<string>();
  const [entitlementId, setEntitlementId] = useState("");
  const [entitlementReason, setEntitlementReason] = useState("");
  const [entitlementBusy, setEntitlementBusy] = useState<"FULFILLED" | "REVERSED">();
  const [entitlementError, setEntitlementError] = useState<string>();
  const [entitlementSuccess, setEntitlementSuccess] = useState<string>();

  const refresh = useCallback(async () => {
    if (!campaignId) {
      setError("Missing campaign id.");
      setLoading(false);
      return;
    }
    setError(undefined);
    try {
      const [campaignData, reviewData, qrData] = await Promise.all([
        apiRequest<{ campaigns: CampaignDetail[] }>(`/admin/rewards/campaigns`).then(
          (r) => r.campaigns?.find((c) => c.id === campaignId) ?? null
        ),
        apiRequest<{ completions: TaskCompletion[] }>("/admin/rewards/review-queue"),
        apiRequest<RewardQrCode[]>(`/admin/rewards/campaigns/${encodeURIComponent(campaignId)}/qr-codes`).catch(
          () => [] as RewardQrCode[]
        )
      ]);
      setCampaign(campaignData);
      setReviewQueue(
        reviewData.completions.filter((c) => c.task?.campaign?.id === campaignId)
      );
      setQrCodes(qrData);
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

  async function generateQrCodes() {
    const count = Number(qrCount);
    if (!qrTaskId || !Number.isFinite(count) || count < 1 || !qrExpiresAt) {
      setQrError("Choose a QR_SCAN task, a code count, and an expiry date.");
      return;
    }
    setQrGenerating(true);
    setQrError(undefined);
    try {
      await apiRequest(`/admin/rewards/campaigns/${encodeURIComponent(campaignId)}/qr-codes`, {
        method: "POST",
        body: JSON.stringify({
          taskId: qrTaskId,
          count,
          expiresAt: new Date(qrExpiresAt).toISOString()
        })
      });
      await refresh();
    } catch (caught) {
      setQrError(caught instanceof Error ? caught.message : "Could not generate QR codes.");
    } finally {
      setQrGenerating(false);
    }
  }

  function copyToken(token: string) {
    void navigator.clipboard.writeText(token);
  }

  async function resolveEntitlement(resolution: "FULFILLED" | "REVERSED") {
    const id = entitlementId.trim();
    if (!id) return;
    setEntitlementBusy(resolution);
    setEntitlementError(undefined);
    setEntitlementSuccess(undefined);
    try {
      await apiRequest(`/admin/rewards/entitlements/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution,
          ...(entitlementReason.trim() ? { reason: entitlementReason.trim() } : {})
        })
      });
      setEntitlementSuccess(`Entitlement ${resolution === "FULFILLED" ? "marked fulfilled" : "reversed"}.`);
      setEntitlementId("");
      setEntitlementReason("");
      await refresh();
    } catch (caught) {
      setEntitlementError(caught instanceof Error ? caught.message : "Could not resolve this entitlement.");
    } finally {
      setEntitlementBusy(undefined);
    }
  }

  if (loading) {
    return (
      <AdminShell active="/rewards/">
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      </AdminShell>
    );
  }
  if (error) {
    return (
      <AdminShell active="/rewards/">
        <div className="text-sm text-destructive">{error}</div>
      </AdminShell>
    );
  }
  if (!campaign) {
    return (
      <AdminShell active="/rewards/">
        <div className="text-sm text-muted-foreground">Campaign not found.</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="/rewards/">
    <div className="space-y-6">
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

      {/* QR codes — only meaningful when the campaign has a QR_SCAN task */}
      {campaign.tasks.some((task) => task.taskType === "QR_SCAN") ? (
        <Panel>
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <h2 className="font-semibold">QR codes</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <select
              className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
              onChange={(event) => setQrTaskId(event.target.value)}
              value={qrTaskId}
            >
              <option value="">Choose a QR_SCAN task</option>
              {campaign.tasks
                .filter((task) => task.taskType === "QR_SCAN")
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.label}
                  </option>
                ))}
            </select>
            <input
              className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
              onChange={(event) => setQrCount(event.target.value)}
              placeholder="Count"
              type="number"
              value={qrCount}
            />
            <input
              className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
              onChange={(event) => setQrExpiresAt(event.target.value)}
              type="date"
              value={qrExpiresAt}
            />
            <Button disabled={qrGenerating} onClick={() => void generateQrCodes()}>
              {qrGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
          {qrError ? <p className="mt-2 text-sm text-destructive">{qrError}</p> : null}

          <div className="mt-4 grid gap-1.5">
            {qrCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No QR codes generated yet.</p>
            ) : (
              qrCodes.map((code) => (
                <div className="flex items-center gap-3 rounded-md border border-[var(--ft-border)] p-2 text-xs" key={code.id}>
                  <code className="flex-1 truncate font-mono">{code.token}</code>
                  <span className="text-muted-foreground">
                    {code.scanCount}/{code.maxScans} scanned
                  </span>
                  <span className="text-muted-foreground">
                    expires {new Date(code.expiresAt).toLocaleDateString()}
                  </span>
                  <button onClick={() => copyToken(code.token)} title="Copy token" type="button">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

      {/* Entitlement resolution — no listing endpoint exists for pending
          entitlements (only the total count, via _count.entitlements below),
          so this resolves by ID the same way the settlement refund-approval
          panel does. */}
      <Panel>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-semibold">Resolve entitlement</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Marks a specific reward entitlement fulfilled (the reward was delivered) or reversed
          (delivery failed or was denied). Find the entitlement ID from the participant's record.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setEntitlementId(event.target.value)}
            placeholder="Entitlement ID"
            value={entitlementId}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm sm:col-span-2"
            onChange={(event) => setEntitlementReason(event.target.value)}
            placeholder="Reason (optional)"
            value={entitlementReason}
          />
          <div className="flex gap-2">
            <Button
              disabled={!entitlementId.trim() || entitlementBusy !== undefined}
              onClick={() => void resolveEntitlement("FULFILLED")}
            >
              {entitlementBusy === "FULFILLED" ? "Saving..." : "Fulfilled"}
            </Button>
            <Button
              disabled={!entitlementId.trim() || entitlementBusy !== undefined}
              onClick={() => void resolveEntitlement("REVERSED")}
              variant="secondary"
            >
              {entitlementBusy === "REVERSED" ? "Saving..." : "Reverse"}
            </Button>
          </div>
        </div>
        {entitlementSuccess ? <p className="mt-2 text-sm text-green-600">{entitlementSuccess}</p> : null}
        {entitlementError ? <p className="mt-2 text-sm text-destructive">{entitlementError}</p> : null}
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
        <Link href="/rewards" className="underline">Back to campaigns</Link>
      </div>
    </div>
    </AdminShell>
  );
}
