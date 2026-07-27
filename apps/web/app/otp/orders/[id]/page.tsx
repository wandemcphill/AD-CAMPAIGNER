"use client";

import { use, useState } from "react";
import { Clipboard, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { Badge, Button, OtpCodeBoxes, Panel } from "@fliptrybe/ui";

import { cancelOtpOrder, refundOtpOrder } from "../../api";
import { EmptyState, Field, OtpShell, PageHeader, StatusBadge } from "../../components";
import { useOtpDashboard } from "../../use-otp-dashboard";

export default function OtpOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, isLoading, refresh } = useOtpDashboard();
  const [message, setMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const order = data?.orders.find((item) => item.id === id);

  async function runAction(action: "cancel" | "refund") {
    setIsSaving(true);
    setMessage(undefined);
    try {
      if (action === "cancel") {
        await cancelOtpOrder(id);
      } else {
        await refundOtpOrder(id);
      }
      setMessage(action === "cancel" ? "Order cancelled." : "Refund requested.");
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "OTP order update failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OtpShell active="/otp/orders">
      <PageHeader
        eyebrow={
          <>
            {order ? <StatusBadge status={order.status} /> : <Badge tone="info">Order detail</Badge>}
            <Badge tone="neutral">{id}</Badge>
          </>
        }
        title={order?.id ?? (isLoading ? "Loading order" : "Order unavailable")}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!order || isSaving}
              onClick={() => void runAction("refund")}
              variant="secondary"
            >
              <RotateCcw className="size-4" /> Request refund
            </Button>
            <Button disabled={!order || isSaving} onClick={() => void runAction("cancel")} variant="danger">
              <XCircle className="size-4" /> Cancel
            </Button>
            <Button disabled={isLoading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] p-3 text-sm text-[var(--ft-blue)]">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <Panel className="mt-6 p-6 text-sm text-[var(--ft-text-muted)]">Loading OTP order</Panel>
      ) : !order ? (
        <div className="mt-6">
          <EmptyState
            title="Order not returned"
            detail="This OTP order was not returned by the API for the current session. Confirm the workspace and refresh."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">
                  {order.service}
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">{order.country}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Number" value={order.number} />
              <OtpCodeBoxes code={order.code} />
              <Field label="Amount" value={order.amount} />
              <Field label="Expires in" value={order.expiresIn} />
            </div>
            <Button className="mt-5 w-full" variant="secondary">
              <Clipboard className="size-4" />
              Copy number
            </Button>
          </Panel>

          <Panel className="p-4">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Event timeline</h2>
            <div className="mt-5 grid gap-3">
              {order.events.map((event) => (
                <div
                  className="grid gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  key={`${event.label}-${event.at}`}
                >
                  <div className="size-2 rounded-full bg-[var(--ft-accent)]" />
                  <div className="font-medium text-[var(--ft-text-primary)]">{event.label}</div>
                  <Badge tone={event.tone}>{event.at}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </OtpShell>
  );
}
