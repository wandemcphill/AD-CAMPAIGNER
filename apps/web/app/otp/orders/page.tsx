import { Download, RefreshCcw } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { OtpShell, PageHeader, StatusBadge } from "../components";
import { orders } from "../data";

export default function OtpOrdersPage() {
  return (
    <OtpShell active="/otp/orders">
      <PageHeader
        eyebrow={<Badge tone="warning">Live verification queue</Badge>}
        title="Orders"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Download className="size-4" /> Export
            </Button>
            <Button>
              <RefreshCcw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="divide-y divide-zinc-200">
          {orders.map((order) => (
            <Link
              className="grid gap-3 p-4 transition hover:bg-zinc-50 xl:grid-cols-[0.75fr_0.8fr_1fr_0.75fr_0.6fr_0.6fr] xl:items-center"
              href={`/otp/orders/${order.id}` as Route}
              key={order.id}
            >
              <div>
                <div className="font-semibold text-zinc-950">{order.id}</div>
                <div className="text-sm text-zinc-500">{order.requestedAt}</div>
              </div>
              <div>
                <div className="font-medium text-zinc-950">{order.service}</div>
                <div className="text-sm text-zinc-500">{order.country}</div>
              </div>
              <div className="text-sm font-medium text-zinc-700">{order.number}</div>
              <StatusBadge status={order.status} />
              <div className="text-sm text-zinc-600">{order.expiresIn}</div>
              <div className="text-sm font-semibold text-zinc-950">{order.amount}</div>
            </Link>
          ))}
        </div>
      </Panel>
    </OtpShell>
  );
}
