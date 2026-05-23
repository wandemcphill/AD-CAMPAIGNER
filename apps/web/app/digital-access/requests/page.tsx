"use client";

import { Clock, RefreshCw, Wallet } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { DigitalAccessShell, PageHeader, RequestStatus } from "../components";
import { useDigitalAccessData } from "../use-digital-access-data";

export default function DigitalAccessRequestsPage() {
  const { error, loading, refresh, requests, source } = useDigitalAccessData();
  const openRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "processing"
  ).length;
  const fulfilledRequests = requests.filter((request) => request.status === "fulfilled").length;

  return (
    <DigitalAccessShell active="/digital-access/requests">
      <PageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Request tracking</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>
              {source === "api" ? "API data" : "Demo queue"}
            </Badge>
          </>
        }
        title="Your access requests"
      />

      {error ? (
        <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open requests"
          value={loading ? "..." : String(openRequests)}
          detail="Pending and processing"
          tone="info"
        />
        <MetricCard
          label="Fulfilled"
          value={loading ? "..." : String(fulfilledRequests)}
          detail="Completed manually"
          tone="success"
        />
        <MetricCard
          label="Total requests"
          value={loading ? "..." : String(requests.length)}
          detail="Current workspace"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 p-4">
          <div>
            <h2 className="font-semibold text-zinc-950">Request queue</h2>
            <p className="mt-1 text-sm text-zinc-500">Track admin fulfillment state.</p>
          </div>
          <Clock className="size-5 text-sky-600" />
        </div>
        <div className="divide-y divide-zinc-200">
          {loading ? (
            <QueueMessage label="Loading request queue" />
          ) : requests.length === 0 ? (
            <QueueMessage label="No requests yet" />
          ) : (
            requests.map((request) => (
              <a
                className="grid gap-3 p-4 transition hover:bg-zinc-50 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                href={`/digital-access/requests/${request.id}`}
                key={request.id}
              >
                <div>
                  <div className="font-medium text-zinc-950">{request.service}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {request.id} - {request.plan} - {request.createdAt}
                  </div>
                </div>
                <RequestStatus request={request} />
                <div className="text-sm font-semibold text-zinc-950">{request.amount}</div>
              </a>
            ))
          )}
        </div>
      </section>

      <Panel className="mt-6 p-4">
        <div className="flex items-center gap-2 font-semibold text-zinc-950">
          <Wallet className="size-5 text-green-600" />
          Refund behavior
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          If a request cannot be fulfilled, the admin status update triggers an automatic wallet
          reversal. Completed requests remain charged.
        </p>
      </Panel>
    </DigitalAccessShell>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="p-4 text-sm text-zinc-500">{label}</div>;
}
