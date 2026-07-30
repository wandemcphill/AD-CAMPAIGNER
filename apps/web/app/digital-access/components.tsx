import type { ReactNode } from "react";

import { Badge, cn } from "@fliptrybe/ui";

import { statusTone, type AccessRequest } from "./data";

export function PageHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h1 className="mt-3 text-2xl font-medium tracking-normal text-[var(--ft-text-primary)] sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

export function ErrorNotice({ message }: { message?: string | undefined }) {
  if (!message) {
    return null;
  }

  const trimmedMessage = message.trim();
  const technicalMessage =
    trimmedMessage.length > 180 ||
    /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|prisma|stack|status code|trace|unauthorized/i.test(
      trimmedMessage
    );
  const safeMessage = technicalMessage
    ? "Digital Access details could not refresh right now. Try again in a moment."
    : trimmedMessage;

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-sm text-[var(--ft-yellow)]">
      {safeMessage}
    </div>
  );
}

export function RequestStatus({ request }: { request: AccessRequest }) {
  return <LocalStatusBadge status={request.status} tone={statusTone[request.status]} />;
}

function LocalStatusBadge({
  status,
  tone
}: {
  status: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Badge tone={tone}>
      <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", statusDot[tone])} />
      {formatStatusLabel(status)}
    </Badge>
  );
}

const statusDot = {
  neutral: "bg-[var(--ft-text-muted)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]",
  danger: "bg-[var(--ft-red)]",
  info: "bg-[var(--ft-blue)]"
} as const;

function formatStatusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    failed: "Needs review",
    fulfilled: "Fulfilled",
    pending: "Awaiting fulfillment",
    processing: "In fulfillment"
  };

  return labels[status] ?? "In fulfillment";
}
