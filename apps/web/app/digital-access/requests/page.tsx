import { Clock, Wallet } from "lucide-react";

import { Badge, MetricCard, Panel } from "@fliptrybe/ui";

import { DigitalAccessShell, PageHeader, RequestStatus } from "../components";
import { requests } from "../data";

export default function DigitalAccessRequestsPage() {
  return (
    <DigitalAccessShell active="/digital-access/requests">
      <PageHeader
        eyebrow={
          <>
            <Badge tone="info">Request tracking</Badge>
            <Badge tone="success">Wallet protected</Badge>
          </>
        }
        title="Your access requests"
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Open requests" value="2" detail="Pending and processing" tone="info" />
        <MetricCard label="Fulfilled" value="1" detail="Completed manually" tone="success" />
        <MetricCard label="Wallet paid" value="NGN 14k" detail="Across active requests" />
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
          {requests.map((request) => (
            <a
              className="grid gap-3 p-4 transition hover:bg-zinc-50 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              href={`/digital-access/requests/${request.id}`}
              key={request.id}
            >
              <div>
                <div className="font-medium text-zinc-950">{request.service}</div>
                <div className="mt-1 text-sm text-zinc-500">
                  {request.id} · {request.plan} · {request.createdAt}
                </div>
              </div>
              <RequestStatus request={request} />
              <div className="text-sm font-semibold text-zinc-950">{request.amount}</div>
            </a>
          ))}
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
