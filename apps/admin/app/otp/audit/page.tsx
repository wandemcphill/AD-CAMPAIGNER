import { Download, FileClock } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader } from "../components";
import { auditEvents } from "../data";

const eventDot = {
  info: "bg-[var(--ft-blue)]",
  neutral: "bg-[var(--ft-text-muted)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]"
} as const;

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
        <div className="border-b border-[var(--ft-border)] p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--ft-text-primary)]">
            <FileClock className="size-5 text-[var(--ft-text-primary)]" />
            OTP audit trail
          </h2>
        </div>
        <div className="hidden grid-cols-[1fr_0.8fr_0.8fr_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
          <div>Event</div>
          <div>Actor</div>
          <div>Target</div>
          <div>Time</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {auditEvents.map((event) => (
            <div
              className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center"
              key={`${event.event}-${event.at}`}
            >
              <div className="flex items-center gap-3 font-semibold text-[var(--ft-text-primary)]">
                <span className={`size-2 rounded-full ${eventDot[event.tone]}`} />
                {event.event}
              </div>
              <div className="text-sm text-[var(--ft-text-secondary)]">{event.actor}</div>
              <div className="text-sm text-[var(--ft-text-secondary)]">{event.target}</div>
              <Badge tone={event.tone}>{event.at}</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
