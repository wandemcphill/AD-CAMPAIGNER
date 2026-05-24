"use client";

import { Filter, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button } from "@fliptrybe/ui";

import {
  ActivitySeverityBadge,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  LoadingRows
} from "../components";
import {
  campaignOpsActivitySeverities,
  type CampaignOpsActivitySeverity
} from "../data";
import { useAdminCampaignOpsActivityData } from "../use-admin-campaign-ops-data";

type ActivityFilter = CampaignOpsActivitySeverity | "all";

export default function AdminCampaignOpsActivityPage() {
  const { error, items, loading, refresh, source } = useAdminCampaignOpsActivityData();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<ActivityFilter>("all");

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSeverity = severity === "all" || item.severity === severity;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.actor, item.action, item.target, item.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesQuery;
    });
  }, [items, query, severity]);

  return (
    <AdminCampaignOpsShell active="/campaign-ops/activity">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              <input
                className="w-full bg-transparent text-zinc-950 outline-none placeholder:text-zinc-400"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search activity"
                value={query}
              />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Filter className="size-4" />
              <select
                className="bg-transparent text-zinc-950 outline-none"
                onChange={(event) => setSeverity(event.target.value as ActivityFilter)}
                value={severity}
              >
                <option value="all">All activity</option>
                {campaignOpsActivitySeverities.map((item) => (
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
            <Badge tone="info">Activity endpoint</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>/v1 connected</Badge>
          </>
        }
        title="Campaign activity"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Audit stream</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Admin actions, system transitions, and campaign ops alerts.
            </p>
          </div>
          <Badge tone="neutral">{filteredItems.length} shown</Badge>
        </div>

        {loading ? (
          <LoadingRows count={5} />
        ) : filteredItems.length === 0 ? (
          <div className="p-4">
            <EmptyState
              detail={
                items.length === 0
                  ? "The activity API returned an empty stream."
                  : "No activity entries match the current filters."
              }
              title="No activity in this view"
            />
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {filteredItems.map((item) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-start" key={item.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-zinc-950">
                      {item.actor} {item.action}
                    </div>
                    <ActivitySeverityBadge severity={item.severity} />
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {item.target} - {item.timestamp}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{item.description}</p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
                  {item.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminCampaignOpsShell>
  );
}
