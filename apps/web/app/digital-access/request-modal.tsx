"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Mail, MessageCircle, Wallet, X } from "lucide-react";

import { Badge, Button, Panel, cn } from "@fliptrybe/ui";

import { getStoredToken } from "../lib/api-client";
import { createDigitalAccessRequest } from "./api";
import { accessEnabled } from "./data";
import type { AccessPlan } from "./data";

export function RequestAccessButton({
  serviceName,
  serviceId,
  serviceSlug,
  plans
}: {
  serviceName: string;
  serviceId?: string;
  serviceSlug?: string;
  plans: AccessPlan[];
}) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [contactType, setContactType] = useState<"whatsapp" | "email">("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === planId) ?? plans[0],
    [planId, plans]
  );

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!selectedPlan) {
      setError("Select a plan before submitting.");
      return;
    }
    if (accessEnabled && !getStoredToken()) {
      setError("Sign in before submitting a live request.");
      return;
    }

    setSubmitting(true);
    try {
      if (accessEnabled) {
        await createDigitalAccessRequest({
          ...(serviceId ? { serviceId } : {}),
          ...(serviceSlug ? { serviceSlug } : {}),
          planId: selectedPlan.id,
          contactType,
          contactValue,
          ...(notes.trim() ? { notes: notes.trim() } : {})
        });
      }
      setSubmitted(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Request submission failed.";
      setError(
        /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|prisma|stack|status code|trace|unauthorized/i.test(
          message
        )
          ? "We could not send this request right now. No wallet movement happened. Try again in a moment."
          : message
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitRequest(event);
  }

  return (
    <>
      <Button
        className="w-full sm:w-auto"
        disabled={plans.length === 0}
        onClick={() => setOpen(true)}
      >
        Request access
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--ft-bg-raised)]/40 p-0 sm:items-center sm:justify-center sm:p-4">
          <Panel className="w-full rounded-b-none p-4 shadow-[var(--shadow-lg)] sm:max-w-2xl sm:rounded-[var(--radius-lg)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="info">Wallet-paid request</Badge>
                <h2 className="mt-3 text-xl font-semibold text-[var(--ft-text-primary)]">
                  {serviceName}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-muted)]">
                  Share your preferred contact method. FlipTrybe operations will handle fulfillment
                  manually and update this request.
                </p>
              </div>
              <button
                aria-label="Close request form"
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
                  Request submitted
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--ft-green)]">
                  Your wallet payment is recorded and the request is now in the admin fulfillment
                  queue.
                </p>
              </div>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-[var(--ft-text-secondary)]">
                    Select plan
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <PlanOption
                        active={plan.id === selectedPlan?.id}
                        key={plan.id}
                        onClick={() => setPlanId(plan.id)}
                        plan={plan}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium text-[var(--ft-text-secondary)]">
                    Contact method
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
                      { value: "email", label: "Email", icon: Mail }
                    ].map((item) => (
                      <button
                        className={cn(
                          "flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition",
                          contactType === item.value
                            ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
                            : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
                        )}
                        key={item.value}
                        onClick={() => setContactType(item.value as "whatsapp" | "email")}
                        type="button"
                      >
                        <item.icon className="size-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  {contactType === "whatsapp" ? "WhatsApp number" : "Email address"}
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    onChange={(event) => setContactValue(event.target.value)}
                    placeholder={contactType === "whatsapp" ? "+234..." : "you@example.com"}
                    required
                    type={contactType === "email" ? "email" : "tel"}
                    value={contactValue}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Notes
                  <textarea
                    className="min-h-24 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]"
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add timing, plan, or support context for the fulfillment team."
                    value={notes}
                  />
                </label>

                <div className="flex flex-col gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
                    <Wallet className="size-4 text-[var(--ft-text-primary)]" />
                    Wallet will be charged upfront.
                  </div>
                  <div className="font-semibold text-[var(--ft-text-primary)]">
                    {selectedPlan?.price}
                  </div>
                </div>

                {error ? (
                  <div className="rounded-md border border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
                    {error}
                  </div>
                ) : null}

                <Button disabled={submitting} type="submit">
                  {submitting ? "Sending" : "Send request to team"}
                </Button>
              </form>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function PlanOption({
  active,
  plan,
  onClick
}: {
  active: boolean;
  plan: AccessPlan;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "min-h-32 rounded-md border p-3 text-left transition",
        active
          ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
          : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="text-sm font-semibold">{plan.name}</div>
      <div
        className={cn(
          "mt-1 text-xs",
          active ? "text-[var(--ft-text-secondary)]" : "text-[var(--ft-text-muted)]"
        )}
      >
        {plan.duration}
      </div>
      <div className="mt-3 text-lg font-semibold">{plan.price}</div>
      <div
        className={cn(
          "mt-2 text-xs leading-5",
          active ? "text-[var(--ft-text-secondary)]" : "text-[var(--ft-text-muted)]"
        )}
      >
        {plan.description}
      </div>
    </button>
  );
}
