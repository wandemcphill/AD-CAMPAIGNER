import { Download, RefreshCcw } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, StatusBadge } from "../components";
import { orders } from "../data";

export default function AdminOtpOrdersPage() {
  return (
    <AdminOtpShell active="/otp/orders">
      <AdminPageHeader
        eyebrow={<Badge tone="warning">Admin order review</Badge>}
        title="OTP orders"
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
            <div
              className="grid gap-3 p-4 xl:grid-cols-[0.7fr_1.1fr_0.8fr_0.9fr_0.65fr_0.5fr_0.55fr] xl:items-center"
              key={order.id}
            >
              <div className="font-semibold text-zinc-950">{order.id}</div>
              <div className="text-sm text-zinc-600">{order.user}</div>
              <div className="text-sm font-medium text-zinc-950">{order.service}</div>
              <div className="text-sm text-zinc-600">{order.provider}</div>
              <StatusBadge status={order.status} />
              <Badge
                tone={
                  order.risk === "High" ? "danger" : order.risk === "Medium" ? "warning" : "success"
                }
              >
                {order.risk}
              </Badge>
              <div className="text-sm font-semibold text-zinc-950">{order.amount}</div>
            </div>
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
