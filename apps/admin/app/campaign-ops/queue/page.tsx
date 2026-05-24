"use client";

import { Filter, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button } from "@fliptrybe/ui";

import {
  ActionLink,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  LoadingRows,
  PriorityBadge,
  ProgressBar,
  StatusBadge
} from "../components";
import { campaignOpsStatuses, type CampaignOpsStatus } from "../data";
import { useAdminCampaignOpsQueueData } from "../use-admin-campaign-ops-data";

type StatusFilter = CampaignOpsStatus | "all";

export default function AdminCampaignOpsQueuePage() {
  const { error, items, loading, refresh, source } = useAdminCampaignOpsQueueData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((campaign) => {
      const matchesStatus = status === "all" || campaign.status === status;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          campaign.id,
          campaign.name,
          campaign.workspaceName,
          campaign.ownerName,
          campaign.channel,
          campaign.assignee
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [items, query, status]);

  return (
    <AdminCampaignOpsShell active="/campaign-ops/queue">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              <input
                className="w-full bg-transparent text-zinc-950 outline-none placeholder:text-zinc-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search campaign queue"
                value={query}
              />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Filter className="size-4" />
              <select
                className="bg-transparent text-zinc-950 outline-none"
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                value={status}
              >
                <option value="all">All statuses</option>
                {campaignOpsStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Queue endpoint</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>/v1 connected</Badge>
          </>
        }
        title="Campaign queue"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto] gap-3 border-b border-zinc-200 p-4 text-xs font-medium text-zinc-500 uppercase max-xl:hidden">
          <div>Campaign</div>
          <div>Owner</div>
          <div>Assignee</div>
          <div>Progress</div>
          <div>Status</div>
        </div>

        {loading ? (
          <LoadingRows count={5} />
        ) : filteredItems.length === 0 ? (
          <div className="p-4">
            <EmptyState
              detail={
                items.length === 0
                  ? "The planned queue API returned an empty list."
                  : "No campaign work items match the current filters."
              }
              title="No campaigns in this view"
            />
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {filteredItems.map((campaign) => (
              <div
                className="grid gap-3 p-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center"
                key={campaign.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-zinc-950">{campaign.name}</div>
                    <PriorityBadge priority={campaign.priority} />
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {campaign.id} - {campaign.workspaceName} - {campaign.channel}
                  </div>
                </div>
                <div className="text-sm text-zinc-700">
                  <div className="font-medium text-zinc-950">{campaign.ownerName}</div>
                  <div className="mt-1 text-zinc-500">{campaign.budget}</div>
                </div>
                <div className="text-sm font-medium text-zinc-700">{campaign.assignee}</div>
                <div className="grid gap-2 text-sm text-zinc-500">
                  <ProgressBar value={campaign.progress} />
                  <span>{campaign.progress}% complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={campaign.status} />
                  <ActionLink href={`/campaign-ops/detail?campaignId=${encodeURIComponent(campaign.id)}`}>
                    Detail
                  </ActionLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminCampaignOpsShell>
  );
}
