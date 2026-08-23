"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Plus } from "lucide-react";

import { Badge, Button, humanizeStatus } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { isForbiddenError } from "../../../lib/api-client";
import {
  createPaymentLink,
  disablePaymentLink,
  formatPaymentLinkMoney,
  listPaymentLinks,
  paymentLinkUrl,
  type PaymentLink,
  type PaymentLinkStatus
} from "./api";

const STATUS_TONE: Record<PaymentLinkStatus, "success" | "neutral" | "warning"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
  EXPIRED: "warning"
};

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>();
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [copiedId, setCopiedId] = useState<string>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [amount, setAmount] = useState("");
  const [collectCustomerInfo, setCollectCustomerInfo] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setLinks(await listPaymentLinks());
    } catch (caught) {
      if (isForbiddenError(caught)) {
        setForbidden(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Could not load payment links.");
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCurrency("NGN");
    setAmount("");
    setCollectCustomerInfo(false);
    setExpiresAt("");
    setFormError(undefined);
  }

  async function submit() {
    setFormError(undefined);
    if (!title.trim()) {
      setFormError("A title is required.");
      return;
    }
    let amountMinor: number | null = null;
    if (amount.trim()) {
      const value = Math.round(Number(amount) * 100);
      if (!Number.isFinite(value) || value <= 0) {
        setFormError("Amount must be a positive number, or leave it blank to let the payer choose.");
        return;
      }
      amountMinor = value;
    }

    setSubmitting(true);
    try {
      await createPaymentLink({
        title: title.trim(),
        currency,
        amountMinor,
        collectCustomerInfo,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(expiresAt ? { expiresAt } : {})
      });
      resetForm();
      setCreating(false);
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create the payment link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(link: PaymentLink) {
    try {
      await navigator.clipboard.writeText(paymentLinkUrl(link.reference));
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(undefined), 1500);
    } catch {
      setError("Could not copy the link to your clipboard.");
    }
  }

  async function disable(id: string) {
    setBusyId(id);
    try {
      await disablePaymentLink(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disable the link.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (forbidden) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-8 text-center text-sm text-[var(--ft-text-muted)]">
          You do not have permission to manage payment links for this workspace.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payment Links</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Create a link, share it anywhere, and collect payments.
          </p>
        </div>
        <Button onClick={() => setCreating((prev) => !prev)}>
          <Plus className="size-4" /> {creating ? "Close" : "New link"}
        </Button>
      </header>

      {creating ? (
        <section className="mb-6 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
          <h2 className="font-semibold">New payment link</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input id="pl-title" label="What is this for?" onChange={(e) => setTitle(e.currentTarget.value)} type="text" value={title} />
            <Input id="pl-currency" label="Currency" onChange={(e) => setCurrency(e.currentTarget.value.toUpperCase())} type="text" value={currency} />
            <Input id="pl-amount" label="Amount (blank = payer chooses)" onChange={(e) => setAmount(e.currentTarget.value)} type="number" value={amount} />
            <Input id="pl-expires" label="Expires (optional)" onChange={(e) => setExpiresAt(e.currentTarget.value)} type="date" value={expiresAt} />
          </div>
          <div className="mt-4 grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="pl-description">Description (optional)</label>
            <textarea
              className="min-h-[60px] rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="pl-description"
              onChange={(e) => setDescription(e.target.value)}
              value={description}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
            <input checked={collectCustomerInfo} onChange={(e) => setCollectCustomerInfo(e.target.checked)} type="checkbox" />
            Collect the payer&apos;s name and email
          </label>

          {formError ? <div className="mt-3 text-sm text-[var(--ft-red)]">{formError}</div> : null}

          <div className="mt-5 flex justify-end">
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? "Creating..." : "Create link"}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? <div className="mb-4 text-sm text-[var(--ft-red)]">{error}</div> : null}

      <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
        {links === undefined ? (
          <div className="text-sm text-[var(--ft-text-muted)]">Loading payment links...</div>
        ) : links.length === 0 ? (
          <div className="grid place-items-center gap-2 py-8 text-center">
            <Link2 className="size-6 text-[var(--ft-text-muted)]" />
            <div className="text-sm font-medium">No payment links yet</div>
            <div className="text-xs text-[var(--ft-text-muted)]">Create a link to start collecting payments.</div>
          </div>
        ) : (
          <div className="grid gap-2">
            {links.map((link) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                key={link.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{link.title}</span>
                    <Badge tone={STATUS_TONE[link.status]}>{humanizeStatus(link.status)}</Badge>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-[var(--ft-text-muted)]">
                    {link.amountMinor === null ? "Payer-set amount" : formatPaymentLinkMoney(link.amountMinor, link.currency)}
                    {` · ${link.timesPaid} paid`}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button onClick={() => void copyLink(link)} variant="secondary">
                    {copiedId === link.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copiedId === link.id ? "Copied" : "Copy link"}
                  </Button>
                  {link.status === "ACTIVE" ? (
                    <Button disabled={busyId === link.id} onClick={() => void disable(link.id)} variant="ghost">
                      Disable
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
