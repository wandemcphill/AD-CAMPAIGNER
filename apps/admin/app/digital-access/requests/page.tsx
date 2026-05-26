"use client";

import { Filter, RefreshCw, Search } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

import { AdminDigitalAccessShell, AdminErrorNotice, AdminPageHeader, RequestStatus } from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

export default function AdminDigitalAccessRequestsPage() {
  const { error, loading, refresh, requests, source } = useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access/requests">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search contact, service, request
            </div>
            <Button variant="secondary">
              <Filter className="size-4" />
              Filters
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="warning">Pending queue</Badge>
            {process.env.NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE === "true" ? (
              <Badge tone={source === "api" ? "success" : "info"}>
                {source === "api" ? "API data" : "Local preview"}
              </Badge>
            ) : null}
          </>
        }
        title="Request management"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-lg border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_auto] gap-3 border-b border-[var(--ft-border)] p-4 text-xs font-medium text-[var(--ft-text-muted)] uppercase max-lg:hidden">
          <div>Request</div>
          <div>Contact</div>
          <div>Owner</div>
          <div>Status</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <QueueMessage label="Loading requests" />
          ) : requests.length === 0 ? (
            <QueueMessage label="No requests yet" />
          ) : (
            requests.map((request) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto] lg:items-center"
                key={request.id}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">
                    {request.id} - {request.service}
                  </div>
                  <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                    {request.plan} - {request.amount} - {request.age}
                  </div>
                </div>
                <div className="text-sm text-[var(--ft-text-secondary)]">
                  <div className="font-medium text-[var(--ft-text-primary)]">
                    {request.customer}
                  </div>
                  <div className="mt-1 text-[var(--ft-text-muted)]">{request.contact}</div>
                </div>
                <div className="text-sm font-medium text-[var(--ft-text-secondary)]">
                  {request.assignedTo}
                </div>
                <div className="flex items-center gap-2">
                  <RequestStatus request={request} />
                  <Button variant="secondary">Update</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="p-4 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
