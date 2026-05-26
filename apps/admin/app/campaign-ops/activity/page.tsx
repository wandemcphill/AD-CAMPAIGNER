"use client";

import { ChevronDown, ChevronRight, Download, Filter, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button, cn } from "@fliptrybe/ui";

import {
  ActivitySeverityBadge,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  LoadingRows
} from "../components";
import { campaignOpsActivitySeverities, type CampaignOpsActivitySeverity } from "../data";
import { useAdminCampaignOpsActivityData } from "../use-admin-campaign-ops-data";

type ActivityFilter = CampaignOpsActivitySeverity | "all";

const severityDot = {
  danger: "bg-[var(--ft-red)]",
  info: "bg-[var(--ft-blue)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]"
} as const;

const severityLabel: Record<CampaignOpsActivitySeverity, string> = {
  danger: "Needs review",
  info: "Info",
  success: "Completed",
  warning: "SLA watch"
};

export default function AdminCampaignOpsActivityPage() {
  const { error, items, loading, refresh, source } = useAdminCampaignOpsActivityData();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<ActivityFilter>("all");
  const [actor, setActor] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [dateQuery, setDateQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const actorOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.actor))).sort(),
    [items]
  );
  const eventOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.action))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedDate = dateQuery.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSeverity = severity === "all" || item.severity === severity;
      const matchesActor = actor === "all" || item.actor === actor;
      const matchesEvent = eventType === "all" || item.action === eventType;
      const matchesDate =
        normalizedDate.length === 0 || item.timestamp.toLowerCase().includes(normalizedDate);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.actor, item.action, item.target, item.description, item.id]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesActor && matchesEvent && matchesDate && matchesQuery;
    });
  }, [actor, dateQuery, eventType, items, query, severity]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const filtersActive =
    query.trim().length > 0 ||
    severity !== "all" ||
    actor !== "all" ||
    eventType !== "all" ||
    dateQuery.trim().length > 0;

  function clearFilters() {
    setQuery("");
    setSeverity("all");
    setActor("all");
    setEventType("all");
    setDateQuery("");
    setVisibleCount(50);
  }

  return (
    <AdminCampaignOpsShell active="/campaign-ops/activity">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={filteredItems.length === 0} variant="secondary">
              <Download className="size-4 stroke-[1.5]" />
              Export activity CSV
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Activity trail</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>Audit-ready</Badge>
            <Badge tone="neutral">{filteredItems.length} shown</Badge>
          </>
        }
        title="Ops Activity"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="mt-5 grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 lg:grid-cols-[minmax(220px,1.1fr)_repeat(4,minmax(150px,0.7fr))_auto]">
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <Search className="size-4 stroke-[1.5]" />
          <input
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ops activity"
            value={query}
          />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <Filter className="size-4 stroke-[1.5]" />
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setSeverity(event.target.value as ActivityFilter)}
            value={severity}
          >
            <option value="all">All signals</option>
            {campaignOpsActivitySeverities.map((item) => (
              <option key={item} value={item}>
                {severityLabel[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setActor(event.target.value)}
            value={actor}
          >
            <option value="all">All actors</option>
            {actorOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setEventType(event.target.value)}
            value={eventType}
          >
            <option value="all">All actions</option>
            {eventOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <input
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)]"
            onChange={(event) => setDateQuery(event.target.value)}
            placeholder="Date range"
            value={dateQuery}
          />
        </label>
        <Button
          className="h-10 px-3 text-xs"
          disabled={!filtersActive}
          onClick={clearFilters}
          type="button"
          variant="ghost"
        >
          <X className="size-3.5 stroke-[1.5]" />
          Clear
        </Button>
      </section>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
          <div>
            <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
              Operations activity
            </h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Client-visible notes, admin actions, status transitions, and campaign alerts.
            </p>
          </div>
          <Badge tone="neutral">{visibleItems.length} visible</Badge>
        </div>

        {loading ? (
          <LoadingRows count={6} />
        ) : filteredItems.length === 0 ? (
          <div className="p-4">
            <EmptyState
              detail={
                items.length === 0
                  ? "No recent ops activity. Needs Action events will appear here once operators begin work."
                  : "No activity entries match the current filters."
              }
              title="No ops activity in this view"
            />
          </div>
        ) : (
          <div>
            {visibleItems.map((item) => {
              const expanded = expandedId === item.id;

              return (
                <div className="border-b border-[var(--ft-border)]" key={item.id}>
                  <button
                    className="grid min-h-12 w-full grid-cols-[12px_minmax(0,1fr)_auto_28px] items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--ft-bg-raised)] focus:bg-[var(--ft-bg-raised)] focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none"
                    onClick={() =>
                      setExpandedId((current) => (current === item.id ? null : item.id))
                    }
                    type="button"
                  >
                    <span className={cn("size-2 rounded-full", severityDot[item.severity])} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[var(--ft-text-primary)]">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-[var(--ft-text-secondary)]">{item.action}</span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-[var(--ft-text-muted)]">
                        {item.target}
                      </span>
                    </span>
                    <span className="hidden font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase md:block">
                      {item.timestamp}
                    </span>
                    {expanded ? (
                      <ChevronDown className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                    ) : (
                      <ChevronRight className="size-4 stroke-[1.5] text-[var(--ft-text-muted)]" />
                    )}
                  </button>
                  {expanded ? (
                    <div className="mx-4 mb-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActivitySeverityBadge severity={item.severity} />
                        <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                          Audit-ready event
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        {item.description}
                      </p>
                      <div className="mt-3 grid gap-2 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid-cols-3">
                        <span>Actor: {item.actor}</span>
                        <span>Campaign: {item.target}</span>
                        <span>Recorded: {item.timestamp}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!loading && visibleCount < filteredItems.length ? (
        <div className="mt-5 flex justify-center">
          <Button
            onClick={() => setVisibleCount((current) => current + 50)}
            type="button"
            variant="secondary"
          >
            Load 50 more events
          </Button>
        </div>
      ) : null}
    </AdminCampaignOpsShell>
  );
}
