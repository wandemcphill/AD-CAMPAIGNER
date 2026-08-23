"use client";

import { Clock, RefreshCw, Wallet } from "lucide-react";

import { Badge, Button, MetricCard, Panel, ValueSkeleton } from "@fliptrybe/ui";

import { ErrorNotice, PageHeader, RequestStatus } from "../../../digital-access/components";
import { useDigitalAccessData } from "../../../digital-access/use-digital-access-data";
import { navItems } from "../../../digital-access/data";
import { SectionTabs } from "../../section-tabs";
import Link from "next/link";

export default function DigitalAccessRequestsPage() {
  const { error, loading, refresh, requests } = useDigitalAccessData();
  const openRequests = requests.filter(
    (request) => request.status === "pending" || request.status === "processing"
  ).length;
  const fulfilledRequests = requests.filter((request) => request.status === "fulfilled").length;

  return (
    <>
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
            <Badge tone="neutral">Managed queue</Badge>
          </>
        }
        title="Your access requests"
      />

      <div className="mt-5">
        <SectionTabs items={navItems} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open requests"
          value={loading ? <ValueSkeleton width="w-10" /> : String(openRequests)}
          detail="Awaiting or in fulfillment"
          tone="info"
        />
        <MetricCard
          label="Fulfilled"
          value={loading ? <ValueSkeleton width="w-10" /> : String(fulfilledRequests)}
          detail="Completed manually"
          tone="success"
        />
        <MetricCard
          label="Total requests"
          value={loading ? <ValueSkeleton width="w-10" /> : String(requests.length)}
          detail="Current workspace"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--ft-border)] p-4">
          <div>
            <h2 className="font-semibold text-[var(--ft-text-primary)]">Request queue</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
              Track admin fulfillment state.
            </p>
          </div>
          <Clock className="size-5 text-[var(--ft-blue)]" />
        </div>
        <div className="hidden grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid">
          <div>Request</div>
          <div>Status</div>
          <div>Debit</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <QueueMessage label="Loading request queue" />
          ) : requests.length === 0 ? (
            <QueueMessage label="No requests yet" />
          ) : (
            requests.map((request) => (
              <Link
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
                href={`/os/digital-access/requests/${request.id}`}
                key={request.id}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{request.service}</div>
                  <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                    {request.id} - {request.plan} - {request.createdAt}
                  </div>
                </div>
                <RequestStatus request={request} />
                <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                  {request.amount}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <Panel className="mt-6 p-4">
        <div className="flex items-center gap-2 font-semibold text-[var(--ft-text-primary)]">
          <Wallet className="size-5 text-[var(--ft-green)]" />
          Refund behavior
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
          If a request cannot be fulfilled, the admin status update triggers an automatic wallet
          reversal. Completed requests remain charged.
        </p>
      </Panel>
    </>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="p-4 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
