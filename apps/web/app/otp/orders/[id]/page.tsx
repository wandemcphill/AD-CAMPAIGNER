import { notFound } from "next/navigation";
import { Clipboard, RotateCcw, XCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { Field, OtpShell, PageHeader, StatusBadge } from "../../components";
import { orders } from "../../data";

export function generateStaticParams() {
  return orders.map((order) => ({ id: order.id }));
}

export default async function OtpOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = orders.find((item) => item.id === id);

  if (!order) {
    notFound();
  }

  return (
    <OtpShell active="/otp/orders">
      <PageHeader
        eyebrow={
          <>
            <StatusBadge status={order.status} />
            <Badge tone="info">{order.route}</Badge>
          </>
        }
        title={order.id}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <RotateCcw className="size-4" /> Request refund
            </Button>
            <Button variant="danger">
              <XCircle className="size-4" /> Cancel
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">{order.service}</h2>
              <p className="mt-1 text-sm text-zinc-500">{order.country}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Number" value={order.number} />
            <Field label="OTP code" value={order.code ?? "Waiting"} />
            <Field label="Amount" value={order.amount} />
            <Field label="Expires in" value={order.expiresIn} />
          </div>
          <Button className="mt-5 w-full" variant="secondary">
            <Clipboard className="size-4" />
            Copy number
          </Button>
        </Panel>

        <Panel className="p-4">
          <h2 className="text-lg font-semibold text-zinc-950">Event timeline</h2>
          <div className="mt-5 grid gap-3">
            {order.events.map((event) => (
              <div
                className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                key={`${event.label}-${event.at}`}
              >
                <div className="size-2 rounded-full bg-zinc-950" />
                <div className="font-medium text-zinc-950">{event.label}</div>
                <Badge tone={event.tone}>{event.at}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
