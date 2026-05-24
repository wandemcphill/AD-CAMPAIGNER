"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  ActionLink,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  FieldRow,
  LoadingRows,
  PriorityBadge,
  ProgressBar,
  StatusBadge
} from "../components";
import { useAdminCampaignOpsCampaign } from "../use-admin-campaign-ops-data";

export function AdminCampaignOpsDetailClient() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? "";
  const { campaign, error, loading, refresh } = useAdminCampaignOpsCampaign(campaignId);

  return (
    <AdminCampaignOpsShell active="/campaign-ops/queue">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionLink href="/campaign-ops/queue" variant="secondary">
              <ArrowLeft className="size-4" />
              Queue
            </ActionLink>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Detail endpoint</Badge>
            <Badge tone="neutral">{campaignId || "missing id"}</Badge>
          </>
        }
        title={campaign?.name ?? "Campaign detail"}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <Panel className="mt-6 overflow-hidden">
          <LoadingRows count={4} />
        </Panel>
      ) : campaign === null ? (
        <div className="mt-6">
          <EmptyState
            detail="No campaign detail was returned for this queue item."
            title="Campaign detail unavailable"
          />
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Panel className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Review summary</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Confirm campaign readiness before assigning launch work.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={campaign.status} />
                  <PriorityBadge priority={campaign.priority} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <FieldRow label="Workspace" value={campaign.workspaceName} />
                <FieldRow label="Owner" value={campaign.ownerName} />
                <FieldRow label="Channel" value={campaign.channel} />
                <FieldRow label="Objective" value={campaign.objective} />
                <FieldRow label="Budget" value={campaign.budget} />
                <FieldRow label="Assignee" value={campaign.assignee} />
                <FieldRow label="Submitted" value={campaign.submittedAt} />
                <FieldRow label="Updated" value={campaign.updatedAt} />
              </div>
            </Panel>

            <Panel className="p-4">
              <h2 className="text-lg font-semibold text-zinc-950">Operator state</h2>
              <div className="mt-5 grid gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">Fulfillment progress</span>
                    <span className="text-zinc-500">{campaign.progress}%</span>
                  </div>
                  <ProgressBar value={campaign.progress} />
                </div>
                <FieldRow label="Run window" value={campaign.runWindow} />
                <FieldRow label="SLA" value={campaign.sla} />
                <FieldRow label="Risk" value={campaign.risk} />
                <FieldRow label="Next action" value={campaign.nextAction} />
              </div>
            </Panel>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel className="p-4">
              <h2 className="text-lg font-semibold text-zinc-950">Destination and tags</h2>
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                {campaign.destinationUrl}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {campaign.tags.length === 0 ? (
                  <Badge tone="neutral">No tags</Badge>
                ) : (
                  campaign.tags.map((tag) => (
                    <Badge key={tag} tone="info">
                      {tag}
                    </Badge>
                  ))
                )}
              </div>
            </Panel>

            <Panel className="p-4">
              <h2 className="text-lg font-semibold text-zinc-950">Operator notes</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{campaign.notes}</p>
            </Panel>
          </section>
        </>
      )}
    </AdminCampaignOpsShell>
  );
}
