import { Download, FileClock } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader } from "../components";
import { auditEvents } from "../data";

export default function AdminOtpAuditPage() {
  return (
    <AdminOtpShell active="/otp/audit">
      <AdminPageHeader
        eyebrow={<Badge tone="success">Immutable event log</Badge>}
        title="Audit"
        action={
          <Button variant="secondary">
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-zinc-200 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-950">
            <FileClock className="size-5 text-zinc-950" />
            OTP audit trail
          </h2>
        </div>
        <div className="divide-y divide-zinc-200">
          {auditEvents.map((event) => (
            <div
              className="grid gap-3 p-4 lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center"
              key={`${event.event}-${event.at}`}
            >
              <div className="font-semibold text-zinc-950">{event.event}</div>
              <div className="text-sm text-zinc-600">{event.actor}</div>
              <div className="text-sm text-zinc-600">{event.target}</div>
              <Badge tone={event.tone}>{event.at}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
