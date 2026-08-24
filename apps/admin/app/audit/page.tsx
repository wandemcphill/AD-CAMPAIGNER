"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSearch, RefreshCw, Search, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type AuditRow = {
  id: string;
  actorUserId: string | null;
  action: string;
  target: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  metadata: unknown;
  severity: "danger" | "success" | "info";
  description: string;
};

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminAuditPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [expanded, setExpanded] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await apiRequest<AuditRow[]>("/admin/audit/logs?limit=500"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the persisted audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  const actions = useMemo(() => Array.from(new Set(rows.map((row) => row.action))).sort(), [rows]);
  const entities = useMemo(() => Array.from(new Set(rows.map((row) => row.entityType))).sort(), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (action !== "all" && row.action !== action) return false;
      if (entityType !== "all" && row.entityType !== entityType) return false;
      if (!term) return true;
      return [row.action, row.entityType, row.entityId, row.actorUserId ?? "", row.description]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [action, entityType, query, rows]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Audit auth" />;
  }

  return (
    <AdminShell active="/audit/" subtitle="Persisted governance audit trail">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Audit Trail</h1>
              <Badge tone="success">persisted</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Authoritative privileged actions stored in PostgreSQL. This desk covers financial, provider,
              product, identity and risk changes instead of relying on the campaign-ops event buffer.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <label className="flex items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3">
            <Search className="size-4 text-[var(--ft-text-muted)]" />
            <input className="h-10 w-full bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Action, entity, actor or id" value={query} />
          </label>
          <select className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm" onChange={(event) => setAction(event.target.value)} value={action}>
            <option value="all">All actions</option>
            {actions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm" onChange={(event) => setEntityType(event.target.value)} value={entityType}>
            <option value="all">All entity types</option>
            {entities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <Button disabled={!query && action === "all" && entityType === "all"} onClick={() => { setQuery(""); setAction("all"); setEntityType("all"); }} variant="secondary">Clear</Button>
        </div>

        <Panel className="mt-5 overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--ft-border)] p-4">
            <div><div className="font-semibold">Privileged activity</div><div className="text-xs text-[var(--ft-text-muted)]">{filtered.length} records shown</div></div>
            <Badge tone="info">{rows.length} loaded</Badge>
          </div>
          {loading ? <div className="p-6 text-sm text-[var(--ft-text-secondary)]">Loading persisted audit records...</div> : null}
          {!loading && filtered.length === 0 ? <div className="p-6 text-sm text-[var(--ft-text-secondary)]"><ShieldAlert className="mr-2 inline size-4" />No persisted audit records match this view.</div> : null}
          {!loading && filtered.length > 0 ? filtered.map((row) => (
            <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={row.id}>
              <button className="w-full text-left" onClick={() => setExpanded((current) => current === row.id ? undefined : row.id)} type="button">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={row.severity === "danger" ? "danger" : row.severity === "success" ? "success" : "info"}>{row.severity}</Badge><span className="font-medium">{row.action}</span></div>
                  <span className="text-xs text-[var(--ft-text-muted)]">{when(row.timestamp)}</span>
                </div>
                <div className="mt-2 font-mono text-xs text-[var(--ft-text-muted)]">{row.entityType}:{row.entityId} · actor {row.actorUserId ?? "system"}</div>
                <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{row.description}</div>
              </button>
              {expanded === row.id ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">{JSON.stringify(row.metadata, null, 2)}</pre>
              ) : null}
            </div>
          )) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
