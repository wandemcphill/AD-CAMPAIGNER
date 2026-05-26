import { notFound } from "next/navigation";
import { CheckCircle2, CircleDot, Clock, Wallet } from "lucide-react";

import { Badge, Panel } from "@fliptrybe/ui";

import { DigitalAccessShell, PageHeader, RequestStatus } from "../../components";
import { requests } from "../../data";

export function generateStaticParams() {
  return requests.map((request) => ({ id: request.id }));
}

export default async function DigitalAccessRequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = requests.find((item) => item.id === id);

  if (!request) {
    notFound();
  }

  return (
    <DigitalAccessShell active="/digital-access/requests">
      <PageHeader
        action={<RequestStatus request={request} />}
        eyebrow={
          <>
            <Badge tone="info">Request detail</Badge>
            <Badge tone="neutral">{request.id}</Badge>
          </>
        }
        title={request.service}
      />

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-4">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Summary</h2>
          <div className="mt-5 grid gap-4 text-sm">
            {[
              ["Plan", request.plan],
              ["Contact", request.contact],
              ["Amount", request.amount],
              ["Created", request.createdAt],
              ["Update", request.updatedAt]
            ].map(([label, value]) => (
              <div className="flex justify-between gap-4" key={label}>
                <span className="text-[var(--ft-text-muted)]">{label}</span>
                <span className="text-right font-medium text-[var(--ft-text-primary)]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Timeline</h2>
          <div className="mt-5 grid gap-4">
            {[
              {
                icon: Wallet,
                title: "Wallet charged",
                body: "Payment recorded before queue entry."
              },
              {
                icon: Clock,
                title: "Admin queue",
                body: "Request visible to fulfillment operators."
              },
              { icon: CircleDot, title: request.updatedAt, body: "Current operational state." },
              {
                icon: CheckCircle2,
                title: "Fulfillment closeout",
                body: "Admin marks fulfilled, failed, or cancelled."
              }
            ].map((item) => (
              <div className="grid grid-cols-[32px_1fr] gap-3" key={item.title}>
                <div className="flex size-8 items-center justify-center rounded-md bg-[var(--ft-bg-raised)]">
                  <item.icon className="size-4 text-[var(--ft-text-primary)]" />
                </div>
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--ft-text-muted)]">
                    {item.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </DigitalAccessShell>
  );
}
