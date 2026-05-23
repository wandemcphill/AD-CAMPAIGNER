"use client";

import { Filter, RefreshCw, Search } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

import { AdminDigitalAccessShell, AdminPageHeader, RequestStatus } from "../components";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

export default function AdminDigitalAccessRequestsPage() {
  const { error, loading, refresh, requests, source } = useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access/requests">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
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
            <Badge tone={source === "api" ? "success" : "info"}>
              {source === "api" ? "API data" : "Demo queue"}
            </Badge>
          </>
        }
        title="Request management"
      />

      {error ? (
        <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_auto] gap-3 border-b border-zinc-200 p-4 text-xs font-medium text-zinc-500 uppercase max-lg:hidden">
          <div>Request</div>
          <div>Contact</div>
          <div>Owner</div>
          <div>Status</div>
        </div>
        <div className="divide-y divide-zinc-200">
          {loading ? (
            <QueueMessage label="Loading requests" />
          ) : requests.length === 0 ? (
            <QueueMessage label="No requests yet" />
          ) : (
            requests.map((request) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto] lg:items-center"
                key={request.id}
              >
                <div>
                  <div className="font-medium text-zinc-950">
                    {request.id} - {request.service}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {request.plan} - {request.amount} - {request.age}
                  </div>
                </div>
                <div className="text-sm text-zinc-700">
                  <div className="font-medium text-zinc-950">{request.customer}</div>
                  <div className="mt-1 text-zinc-500">{request.contact}</div>
                </div>
                <div className="text-sm font-medium text-zinc-700">{request.assignedTo}</div>
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
  return <div className="p-4 text-sm text-zinc-500">{label}</div>;
}
