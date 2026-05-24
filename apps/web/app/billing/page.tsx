"use client";

import { type FormEvent, useState } from "react";
import { CreditCard, ExternalLink, RefreshCw, WalletCards } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";
import type { CurrencyCode, PaymentIntent } from "@fliptrybe/types";

import {
  amountToMinor,
  createPaymentIntent,
  formatCampaignMoney,
  type CreatePaymentIntentInput
} from "../campaigns/api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SourceBadge
} from "../campaigns/components";
import { useBillingData } from "../campaigns/use-campaign-dashboard-data";
import { useApiSession } from "../lib/use-session";

export default function BillingPage() {
  const { activity, error, loading, refresh, source, wallet } = useBillingData();
  const { session } = useApiSession();
  const [amount, setAmount] = useState("50000");
  const [intent, setIntent] = useState<PaymentIntent>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const currency: CurrencyCode = wallet?.availableBalance.currency ?? "NGN";
  const available = wallet?.availableBalance ?? null;
  const held = wallet?.heldBalance ?? null;

  async function submitTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setSubmitting(true);
    try {
      const amountMinor = amountToMinor(amount);
      if (!amountMinor) {
        throw new Error("Top-up amount must be greater than zero.");
      }

      const input: CreatePaymentIntentInput = {
        amountMinor,
        currency
      };

      if (session?.user.email) {
        input.customerEmail = session.user.email;
      }
      if (session?.user.name) {
        input.customerName = session.user.name;
      }
      if (typeof window !== "undefined") {
        input.redirectUrl = `${window.location.origin}/billing`;
      }

      setIntent(await createPaymentIntent(input));
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create payment intent.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitTopUp(event);
  }

  return (
    <CampaignShell active="/billing">
      <PageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Billing</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Wallet and billing"
      />

      <ErrorNotice message={error ?? formError} />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Available balance"
          value={loading ? "..." : formatCampaignMoney(available)}
          detail="Ready for campaign launches"
          tone="success"
        />
        <MetricCard
          label="Held balance"
          value={loading ? "..." : formatCampaignMoney(held)}
          detail="Reserved campaign budget"
          tone="warning"
        />
        <MetricCard label="Currency" value={currency} detail="Workspace default" tone="info" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Top up wallet</h2>
              <p className="mt-1 text-sm text-zinc-500">Create a provider payment intent.</p>
            </div>
            <CreditCard className="size-5 text-sky-600" />
          </div>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Amount
              <input
                className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                inputMode="numeric"
                onChange={(event) => setAmount(event.target.value)}
                value={amount}
              />
            </label>
            <Button disabled={submitting || loading} type="submit">
              <WalletCards className="size-4" />
              {submitting ? "Creating" : "Create intent"}
            </Button>
          </form>

          {intent ? (
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-4">
              <div className="font-semibold text-green-800">Payment intent ready</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Status" value={intent.status} />
                <Field label="Amount" value={formatCampaignMoney(intent.amount)} />
                <Field label="Gateway" value={intent.gateway} />
                <Field label="Reference" value={intent.providerReference ?? intent.id} />
              </div>
              {intent.checkoutUrl ? (
                <a
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-green-200 bg-white px-4 text-sm font-medium text-green-800 transition hover:bg-green-100"
                  href={intent.checkoutUrl}
                >
                  Checkout
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Billing activity</h2>
              <p className="mt-1 text-sm text-zinc-500">Wallet movement visible to this workspace.</p>
            </div>
            <WalletCards className="size-5 text-green-600" />
          </div>
          <div className="divide-y divide-zinc-200">
            {loading ? (
              <div className="p-4">
                <LoadingBlock label="Loading billing activity" />
              </div>
            ) : activity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  copy="Payment and wallet ledger rows will appear after billing events are created."
                  icon={CreditCard}
                  title="No billing activity"
                />
              </div>
            ) : (
              activity.map((item) => (
                <div
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  key={item.id}
                >
                  <div>
                    <div className="font-medium text-zinc-950">{item.label}</div>
                    <div className="mt-1 text-sm text-zinc-500">{item.reference}</div>
                  </div>
                  <Badge tone={item.status === "COMPLETED" ? "success" : "warning"}>{item.status}</Badge>
                  <div className="text-sm font-semibold text-zinc-950">{item.amount}</div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </CampaignShell>
  );
}
