"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Link2, Mail, ShoppingCart, X } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { getStoredToken } from "../lib/api-client";
import { createGrowthOrder } from "./api";
import { growthEnabled, type GrowthService } from "./data";

export function OrderGrowthServiceButton({ service }: { service: GrowthService }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(service.minimumQuantity);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const isDeliveryContact = service.destinationKind === "DELIVERY_CONTACT";
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (growthEnabled && !getStoredToken()) {
      setError("Sign in before submitting a live Growth Services order.");
      return;
    }

    setSubmitting(true);
    try {
      if (growthEnabled) {
        const response = await createGrowthOrder(
          isDeliveryContact
            ? { serviceCode: service.code, quantity, deliveryContact }
            : { serviceCode: service.code, quantity, destinationUrl }
        );

        setResult(
          response.reviewRequired
            ? "Order is pending admin review."
            : `${response.order.status.replaceAll("_", " ").toLowerCase()} order created.`
        );
      } else {
        setResult("Order draft created.");
      }
      setSubmitted(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Order submission failed.";
      setError(
        /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|stack|status code|trace|unauthorized/i.test(
          message
        )
          ? "This order could not be submitted. No wallet movement happened."
          : message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button disabled={!service.enabled} onClick={() => setOpen(true)}>
        <ShoppingCart className="size-4" />
        Order
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--ft-bg-raised)]/40 p-0 sm:items-center sm:justify-center sm:p-4">
          <Panel className="w-full rounded-b-none p-4 shadow-[var(--shadow-lg)] sm:max-w-2xl sm:rounded-[var(--radius-lg)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone={service.riskTone}>Risk reviewed</Badge>
                <h2 className="mt-3 text-xl font-semibold text-[var(--ft-text-primary)]">
                  {service.name}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-muted)]">
                  {service.price} - {service.expectedCompletion}
                </p>
              </div>
              <button
                aria-label="Close order form"
                className="flex size-9 items-center justify-center rounded-md text-[var(--ft-text-muted)] hover:bg-[var(--ft-bg-raised)] hover:text-[var(--ft-text-primary)]"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            {submitted ? (
              <div className="mt-6 rounded-md border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] p-4">
                <div className="flex items-center gap-2 font-medium text-[var(--ft-green)]">
                  <CheckCircle2 className="size-5" />
                  Growth order received
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--ft-green)]">
                  {result ?? "Order is now visible in tracking."}
                </p>
              </div>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={(event) => void submitOrder(event)}>
                {isDeliveryContact ? (
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Delivery email
                    <div className="grid grid-cols-[auto_1fr] items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                      <span className="grid size-11 place-items-center text-[var(--ft-text-muted)]">
                        <Mail className="size-4" />
                      </span>
                      <input
                        className="h-11 bg-transparent pr-3 text-[var(--ft-text-primary)] outline-none"
                        onChange={(event) => setDeliveryContact(event.target.value)}
                        placeholder="you@example.com"
                        required
                        type="email"
                        value={deliveryContact}
                      />
                    </div>
                    <span className="text-xs font-normal text-[var(--ft-text-muted)]">
                      Credentials are delivered to this email address.
                    </span>
                  </label>
                ) : (
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Public destination URL
                    <div className="grid grid-cols-[auto_1fr] items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                      <span className="grid size-11 place-items-center text-[var(--ft-text-muted)]">
                        <Link2 className="size-4" />
                      </span>
                      <input
                        className="h-11 bg-transparent pr-3 text-[var(--ft-text-primary)] outline-none"
                        onChange={(event) => setDestinationUrl(event.target.value)}
                        placeholder="https://..."
                        required
                        type="url"
                        value={destinationUrl}
                      />
                    </div>
                  </label>
                )}

                {service.minimumQuantity < service.maximumQuantity && (
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Quantity
                    <input
                      className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                      max={service.maximumQuantity}
                      min={service.minimumQuantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                      step={service.quantityStep}
                      type="number"
                      value={quantity}
                    />
                  </label>
                )}

                <div className="rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--ft-text-secondary)]">Risk summary</span>
                    <Badge tone={service.riskTone}>{service.platform}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">
                    {service.riskSummary}
                  </p>
                </div>

                {error ? (
                  <div className="rounded-md border border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
                    {error}
                  </div>
                ) : null}

                <Button disabled={submitting} type="submit">
                  {submitting ? "Submitting" : "Submit order"}
                </Button>
              </form>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
