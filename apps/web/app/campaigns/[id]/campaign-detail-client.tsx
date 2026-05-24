"use client";

import { useState } from "react";
import { ArrowLeft, CalendarClock, LinkIcon, Play, RefreshCw, WalletCards } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { formatCampaignMoney, formatDateTime, startCampaign } from "../api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  StatusBadge,
  secondaryLinkButtonClass
} from "../components";
import { destinationLabels, objectiveLabels } from "../data";
import { useCampaignDashboardData } from "../use-campaign-dashboard-data";

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const { campaigns, error, loading, refresh, source } = useCampaignDashboardData();
  const [actionError, setActionError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const campaign = campaigns.find((item) => item.id === campaignId);

  async function handleStart() {
    if (!campaign) {
      return;
    }

    setActionError(undefined);
    setStarting(true);
    try {
      await startCampaign(campaign.id);
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not start this campaign.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <CampaignShell active="/campaigns">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/campaigns">
              <ArrowLeft className="size-4" />
              Back
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign detail</Badge>
            <SourceBadge source={source} />
          </>
        }
        title={campaign?.name ?? "Campaign"}
      />

      <ErrorNotice message={error ?? actionError} />

      {loading ? (
        <section className="mt-6">
          <LoadingBlock label="Loading campaign" />
        </section>
      ) : !campaign ? (
        <section className="mt-6">
          <EmptyState
            action={
              <a className={secondaryLinkButtonClass} href="/campaigns">
                View campaigns
              </a>
            }
            copy="This campaign was not found in the active workspace."
            icon={CalendarClock}
            title="Campaign not found"
          />
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard
              detail={campaign.provider}
              label="Budget"
              tone="success"
              value={formatCampaignMoney(campaign.budget)}
            />
            <MetricCard
              detail={destinationLabels[campaign.destination.kind]}
              label="Objective"
              tone="info"
              value={objectiveLabels[campaign.objective]}
            />
            <MetricCard
              detail={`Updated ${formatDateTime(campaign.updatedAt)}`}
              label="Status"
              tone={campaign.status === "ACTIVE" ? "success" : "warning"}
              value={campaign.status.replace("_", " ")}
            />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Campaign record</h2>
                  <p className="mt-1 text-sm text-zinc-500">Provider and destination details.</p>
                </div>
                <StatusBadge status={campaign.status} />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Campaign ID" value={campaign.id} />
                <Field label="Provider reference" value={campaign.providerReference ?? "Pending"} />
                <Field label="Destination" value={destinationLabels[campaign.destination.kind]} />
                <Field label="Starts" value={formatDateTime(campaign.schedule.startsAt)} />
                <Field label="Timezone" value={campaign.schedule.timezone} />
                <Field label="Created" value={formatDateTime(campaign.createdAt)} />
              </div>
              <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-950">
                  <LinkIcon className="size-4 text-zinc-500" />
                  Destination URL
                </div>
                <div className="mt-2 break-all text-sm text-zinc-600">
                  {campaign.destination.url}
                </div>
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-center gap-2 font-semibold text-zinc-950">
                <WalletCards className="size-5 text-green-600" />
                Launch controls
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Start moves a queued campaign through the provider boundary.
              </p>
              <Button
                className="mt-5 w-full"
                disabled={source !== "api" || campaign.status === "ACTIVE" || starting}
                onClick={() => void handleStart()}
              >
                <Play className="size-4" />
                {starting ? "Starting" : campaign.status === "ACTIVE" ? "Active" : "Start campaign"}
              </Button>
              <a className={`${secondaryLinkButtonClass} mt-3 w-full`} href="/billing">
                Billing
              </a>
            </Panel>
          </section>
        </>
      )}
    </CampaignShell>
  );
}
