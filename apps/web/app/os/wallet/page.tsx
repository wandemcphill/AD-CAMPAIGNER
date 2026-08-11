"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X
} from "lucide-react";

import {
  Badge,
  Button,
  InvoiceCard,
  Panel,
  PermissionDenied,
  SummaryStatStrip,
  WalletBalance,
  cn
} from "@fliptrybe/ui";
import type { CurrencyCode, PaymentIntent } from "@fliptrybe/types";

import {
  amountToMinor,
  createWalletFundingIntent,
  formatCampaignMoney,
  loadInvoices,
  payInvoiceFromWallet,
  verifyPayment,
  type CampaignInvoiceRecord,
  type CreatePaymentIntentInput
} from "../../campaigns/api";
import {
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SourceBadge
} from "../../campaigns/components";
import type { BillingActivity } from "../../campaigns/data";
import { useBillingData } from "../../campaigns/use-campaign-dashboard-data";
import { useApiSession } from "../../lib/use-session";

type BillingTab = "history" | "invoices" | "methods";

const billingTabs: Array<{ label: string; value: BillingTab }> = [
  { label: "Spend History", value: "history" },
  { label: "Invoices", value: "invoices" },
  { label: "Payment Methods", value: "methods" }
];

const presetTopUps = ["10000", "25000", "50000", "100000"];

const fundingTrustItems = [
  {
    copy: "Campaign budgets move into a locked reserve only when the team is preparing an approved launch.",
    icon: WalletCards,
    label: "Budget lock",
    value: "Reserved before launch"
  },
  {
    copy: "Invoices explain the campaign service, funding reserve, gateway reference, and next action.",
    icon: FileText,
    label: "Invoice clarity",
    value: "Campaign-linked"
  },
  {
    copy: "Unspent campaign budget can return to available balance after reconciliation.",
    icon: ShieldCheck,
    label: "Spend protection",
    value: "Auditable wallet trail"
  }
] as const;

const amountInputClass =
  "h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 font-mono text-lg text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-accent)]";

function moneyValue(amountMinor: number, currency: CurrencyCode) {
  return formatCampaignMoney({ amountMinor, currency });
}

function formatAmountInput(value: string) {
  const amountMinor = amountToMinor(value);

  if (!amountMinor) return value;

  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0
  }).format(amountMinor / 100);
}

function activityAmountMinor(item: BillingActivity) {
  const sign = item.amount.trim().startsWith("-") ? -1 : 1;
  const major = Number(item.amount.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(major)) return 0;

  return sign * Math.round(major * 100);
}

function activityType(item: BillingActivity) {
  const label = `${item.label} ${item.status}`.toLowerCase();

  if (label.includes("refund") || label.includes("release")) return "REFUND";
  if (label.includes("top-up") || label.includes("top up") || item.amount.trim().startsWith("+"))
    return "TOPUP";

  return "CHARGE";
}

function activityMonth(item: BillingActivity) {
  const raw = item.at.trim();

  if (/^today/i.test(raw)) {
    return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(new Date());
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(parsed);
  }

  return raw.split(",")[0] || "Recent";
}

function groupActivity(activity: BillingActivity[]) {
  const groups = new Map<string, BillingActivity[]>();

  activity.forEach((item) => {
    const month = activityMonth(item);
    groups.set(month, [...(groups.get(month) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([month, items]) => ({ items, month }));
}

function amountClass(item: BillingActivity) {
  if (item.amount.trim().startsWith("+")) return "text-[var(--ft-green)]";
  if (item.amount.trim().startsWith("-")) return "text-[var(--ft-red)]";
  return "text-[var(--ft-text-primary)]";
}

function checkoutErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";

  if (
    /amount|currency|email|name/i.test(message) &&
    !/stack|trace|exception|http|fetch/i.test(message)
  ) {
    return message;
  }

  return "We could not prepare a secure checkout. No money has moved. Refresh wallet details and try again.";
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = status.toUpperCase();

  if (normalized.includes("FAILED") || normalized.includes("CANCELLED")) return "danger";
  if (normalized.includes("COMPLETED") || normalized.includes("PAID")) return "success";
  if (
    normalized.includes("HELD") ||
    normalized.includes("PENDING") ||
    normalized.includes("REQUIRES")
  ) {
    return "warning";
  }

  return "neutral";
}

function paymentStatusLabel(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "REQUIRES_ACTION") return "Checkout action needed";
  if (normalized === "PENDING") return "Checkout pending";
  if (normalized === "COMPLETED" || normalized === "PAID") return "Payment confirmed";
  if (normalized === "FAILED") return "Payment failed";
  if (normalized === "CANCELLED") return "Cancelled";

  return "Gateway status syncing";
}

function ActionRequiredPanel({
  heldLabel,
  heldMinor,
  intent
}: {
  heldLabel: string;
  heldMinor: number;
  intent?: PaymentIntent | undefined;
}) {
  const hasPendingIntent = intent?.status === "PENDING" || intent?.status === "REQUIRES_ACTION";
  const title = hasPendingIntent
    ? intent.status === "REQUIRES_ACTION"
      ? "Action required - finish wallet top-up"
      : "Top-up pending"
    : heldMinor > 0
      ? "Budget lock active"
      : "No invoice action due";
  const body = hasPendingIntent
    ? `${formatCampaignMoney(intent.amount)} is waiting for checkout. Complete payment to fund campaign launches.`
    : heldMinor > 0
      ? `${heldLabel} is locked for active campaigns. Funds return to available balance if a campaign ends under budget.`
      : "When the team sends an invoice to activate a campaign, it will appear here above spend history.";

  return (
    <section className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">{body}</p>
          </div>
        </div>
        {hasPendingIntent && intent.checkoutUrl ? (
          <a
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
            href={intent.checkoutUrl}
          >
            Pay Invoice
            <ExternalLink className="size-4 stroke-[1.5]" />
          </a>
        ) : null}
      </div>
    </section>
  );
}

export default function BillingPage() {
  const { activity, error, forbidden, loading, refresh, source, wallet } = useBillingData();
  const { session } = useApiSession();
  const [amount, setAmount] = useState("50000");
  const [activeTab, setActiveTab] = useState<BillingTab>("history");
  const [intent, setIntent] = useState<PaymentIntent>();
  const [selectedActivity, setSelectedActivity] = useState<BillingActivity>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<CampaignInvoiceRecord[]>();
  const [invoicesError, setInvoicesError] = useState<string>();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string>();
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyError, setVerifyError] = useState<string>();
  const currency: CurrencyCode = wallet?.availableBalance.currency ?? "NGN";
  const available = wallet?.availableBalance ?? null;
  const held = wallet?.heldBalance ?? null;
  const heldMinor = held?.amountMinor ?? 0;
  const availableLabel = loading
    ? "..."
    : available
      ? formatCampaignMoney(available)
      : moneyValue(0, currency);
  const heldLabel = loading ? "Funds" : held ? formatCampaignMoney(held) : moneyValue(0, currency);
  const groupedActivity = useMemo(() => groupActivity(activity), [activity]);
  const totalSpentMinor = useMemo(
    () =>
      activity
        .map(activityAmountMinor)
        .filter((value) => value < 0)
        .reduce((total, value) => total + Math.abs(value), 0),
    [activity]
  );
  const pendingChargeMinor =
    intent && (intent.status === "PENDING" || intent.status === "REQUIRES_ACTION")
      ? intent.amount.amountMinor
      : 0;
  const walletWarning = loading
    ? undefined
    : !wallet
      ? "Wallet details are being refreshed. Checkout opens only after a secure funding request is prepared."
      : heldMinor > 0
        ? `${formatCampaignMoney(held)} is locked as managed campaign budget.`
        : "Invoices will appear here when the team approves a campaign plan.";

  useEffect(() => {
    if (activeTab !== "invoices" || invoices !== undefined) return;
    void loadInvoices()
      .then(setInvoices)
      .catch((caught) =>
        setInvoicesError(caught instanceof Error ? caught.message : "Could not load invoices.")
      );
  }, [activeTab, invoices]);

  async function payInvoice(invoiceId: string) {
    setPayingInvoiceId(invoiceId);
    setInvoicesError(undefined);
    try {
      const updated = await payInvoiceFromWallet(invoiceId);
      setInvoices((current) => current?.map((inv) => (inv.id === updated.id ? updated : inv)));
      await refresh();
    } catch (caught) {
      setInvoicesError(caught instanceof Error ? caught.message : "Could not pay this invoice.");
    } finally {
      setPayingInvoiceId(undefined);
    }
  }

  async function checkPaymentStatus() {
    const reference = intent?.providerReference ?? intent?.id;
    if (!reference) return;
    setVerifyingPayment(true);
    setVerifyError(undefined);
    try {
      const updated = await verifyPayment(reference);
      setIntent(updated);
      await refresh();
    } catch (caught) {
      setVerifyError(caught instanceof Error ? caught.message : "Could not verify this payment yet.");
    } finally {
      setVerifyingPayment(false);
    }
  }

  async function submitTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setSubmitting(true);
    try {
      const amountMinor = amountToMinor(amount);
      if (!amountMinor) {
        throw new Error("Enter a top-up amount before continuing.");
      }

      const input: CreatePaymentIntentInput = {
        amountMinor,
        currency
      };

      if (session?.user.displayName ?? session?.user.name) {
        input.customerName = session.user.displayName ?? session.user.name;
      }
      if (typeof window !== "undefined") {
        input.redirectUrl = `${window.location.origin}/os/wallet`;
      }

      setIntent(await createWalletFundingIntent(input));
      await refresh();
    } catch (caught) {
      setFormError(checkoutErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitTopUp(event);
  }

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view the Finance Hub for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Button disabled={submitting || loading} form="wallet-top-up-form" type="submit">
              <Plus className="size-4 stroke-[1.5]" />
              Add funds
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Wallet</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Wallet & Billing"
      />

      <ErrorNotice message={error ?? formError} />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "available balance", value: availableLabel },
            { label: "budget reserve", value: heldLabel },
            { label: "spend this period", value: moneyValue(totalSpentMinor, currency) }
          ]}
        />
      </section>

      <section className="mt-6">
        <WalletBalance
          action={
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button disabled={submitting || loading} form="wallet-top-up-form" type="submit">
                <Plus className="size-4 stroke-[1.5]" />
                Add funds
              </Button>
              <Button onClick={() => setActiveTab("history")} type="button" variant="secondary">
                <Download className="size-4 stroke-[1.5]" />
                View Statements
              </Button>
            </div>
          }
          balance={availableLabel}
          {...(walletWarning ? { warning: walletWarning } : {})}
        />
      </section>

      <ActionRequiredPanel heldLabel={heldLabel} heldMinor={heldMinor} intent={intent} />

      <section className="mt-4 grid gap-3 lg:grid-cols-3">
        {fundingTrustItems.map((item) => (
          <div
            className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"
            key={item.label}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                <item.icon className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
              </div>
              <Badge tone="neutral">{item.label}</Badge>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                {item.value}
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">{item.copy}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          {
            detail: "Completed wallet debits",
            label: "Campaign Spend",
            value: loading ? "..." : moneyValue(totalSpentMinor, currency)
          },
          {
            detail: "Reserved for active campaigns",
            label: "Budget Reserve",
            value: loading ? "..." : heldLabel
          },
          {
            detail: pendingChargeMinor > 0 ? "Needs checkout" : "No pending charges",
            label: "Checkout Due",
            value: loading ? "..." : moneyValue(pendingChargeMinor, currency)
          }
        ].map((item) => (
          <div
            className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-surface)] p-4"
            key={item.label}
          >
            <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              {item.label}
            </div>
            <div className="mt-2 font-mono text-2xl text-[var(--ft-text-primary)]">
              {item.value}
            </div>
            <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Add funds</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Fund the wallet before an approved campaign invoice moves into production.
              </p>
            </div>
            <CreditCard className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>

          <form className="mt-5 grid gap-4" id="wallet-top-up-form" onSubmit={handleSubmit}>
            <div>
              <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                Preset amounts
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {presetTopUps.map((preset) => {
                  const selected = amount === preset;

                  return (
                    <button
                      className={cn(
                        "h-10 rounded-[var(--radius-sm)] border px-3 font-mono text-sm transition",
                        selected
                          ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                          : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] hover:border-[var(--ft-accent)]"
                      )}
                      key={preset}
                      onClick={() => setAmount(preset)}
                      type="button"
                    >
                      {moneyValue(Number(preset) * 100, currency)}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Custom amount
              <input
                className={amountInputClass}
                inputMode="numeric"
                onBlur={(event) => setAmount(formatAmountInput(event.target.value))}
                onChange={(event) => setAmount(event.target.value)}
                value={amount}
              />
            </label>

            <Button disabled={submitting || loading} type="submit">
              <WalletCards className="size-4 stroke-[1.5]" />
              {submitting ? "Preparing checkout" : "Add funds securely"}
            </Button>
            <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm leading-5 text-[var(--ft-text-secondary)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[var(--ft-green)]" />
              <span>
                Secure checkout is handled by our payment provider. Fliptrybe stores the wallet
                ledger and campaign funding reference, not your card details.
              </span>
            </div>
          </form>

          {intent ? (
            <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
              <div className="flex items-center gap-2 font-medium text-[var(--ft-green)]">
                <CheckCircle2 className="size-5 stroke-[1.5]" />
                Checkout ready
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="Campaign" value="Campaign funding reserve" />
                <Field label="Service" value="Managed TikTok/Meta campaign funding" />
                <Field label="Period" value="Next approved campaign flight" />
                <Field label="Status" value={paymentStatusLabel(intent.status)} />
                <Field label="Amount" value={formatCampaignMoney(intent.amount)} />
                <Field label="Gateway" value={intent.gateway} />
                <Field label="Reference" value={intent.providerReference ?? intent.id} />
              </div>
              {intent.checkoutUrl ? (
                <a
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] px-4 text-sm font-medium text-[var(--ft-green)] transition hover:bg-[var(--ft-bg-raised)]"
                  href={intent.checkoutUrl}
                >
                  Finish secure checkout
                  <ExternalLink className="size-4 stroke-[1.5]" />
                </a>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Spend History</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Wallet movement, budget locks, receipts, and payment actions for this workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {billingTabs.map((tab) => (
                  <button
                    className={cn(
                      "h-9 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition",
                      activeTab === tab.value
                        ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                        : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] hover:border-[var(--ft-accent)]"
                    )}
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {activeTab === "history" ? (
            <div>
              <div className="hidden grid-cols-[132px_minmax(220px,1fr)_96px_132px_132px] gap-3 border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
                <div>Date</div>
                <div>Description</div>
                <div>Type</div>
                <div className="text-right">Amount</div>
                <div>Ref #</div>
              </div>
              {loading ? (
                <div className="p-4">
                  <LoadingBlock label="Loading spend history" />
                </div>
              ) : activity.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    action={
                      <Button disabled={submitting} form="wallet-top-up-form" type="submit">
                        <Plus className="size-4 stroke-[1.5]" />
                        Add funds
                      </Button>
                    }
                    copy="Add funds to your wallet to activate your first campaign."
                    icon={CreditCard}
                    title="No transactions yet"
                  />
                </div>
              ) : (
                groupedActivity.map((group) => (
                  <div key={group.month}>
                    <div className="sticky top-[52px] z-10 border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">
                      {group.month}
                    </div>
                    {group.items.map((item) => (
                      <button
                        className="grid w-full gap-3 border-b border-[var(--ft-border)] p-4 text-left transition last:border-b-0 hover:bg-[var(--ft-bg-muted)] xl:grid-cols-[132px_minmax(220px,1fr)_96px_132px_132px] xl:items-center"
                        key={item.id}
                        onClick={() => setSelectedActivity(item)}
                        type="button"
                      >
                        <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                          {item.at}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--ft-text-primary)]">
                            {item.label}
                          </div>
                          <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                            Campaign-linked wallet movement
                          </div>
                          <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            {item.status}
                          </div>
                        </div>
                        <span className="w-fit rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">
                          {activityType(item)}
                        </span>
                        <div
                          className={cn(
                            "font-mono text-sm font-medium xl:text-right",
                            amountClass(item)
                          )}
                        >
                          {item.amount}
                        </div>
                        <div className="grid gap-1">
                          <div className="font-mono text-sm text-[var(--ft-text-muted)]">
                            {item.reference}
                          </div>
                          <div className="flex gap-2 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-accent)] uppercase">
                            <span>Receipt</span>
                            <span>Statement</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : activeTab === "invoices" ? (
            <div className="p-4">
              {invoicesError ? (
                <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
                  {invoicesError}
                </div>
              ) : null}

              {invoices === undefined ? (
                <LoadingBlock label="Loading invoices" />
              ) : invoices.filter((inv) => inv.status !== "DRAFT" && inv.status !== "VOID").length > 0 ? (
                <div className="mb-6 grid gap-4">
                  {invoices
                    .filter((inv) => inv.status !== "DRAFT" && inv.status !== "VOID")
                    .map((inv) => {
                      const dueMinor = inv.totalMinor - inv.amountPaidMinor;
                      const canPay = inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE";
                      return (
                        <div className="grid gap-2" key={inv.id}>
                          <InvoiceCard
                            amount={formatCampaignMoney({ amountMinor: dueMinor, currency: inv.currency })}
                            campaign={inv.lineItems[0]?.description ?? `Campaign invoice ${inv.number}`}
                            due={inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "No due date"}
                            invoiceNumber={inv.number}
                            status={inv.status === "PAID" ? "paid" : inv.status === "OVERDUE" ? "overdue" : "pending"}
                          />
                          {canPay ? (
                            <Button
                              disabled={payingInvoiceId !== undefined}
                              onClick={() => void payInvoice(inv.id)}
                              type="button"
                            >
                              {payingInvoiceId === inv.id
                                ? "Paying..."
                                : `Pay ${formatCampaignMoney({ amountMinor: dueMinor, currency: inv.currency })} from wallet`}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              ) : null}

              {pendingChargeMinor > 0 && intent ? (
                <div className="grid gap-4">
                  <InvoiceCard
                    amount={formatCampaignMoney(intent.amount)}
                    campaign="Campaign funding reserve - next approved campaign flight"
                    due="Due now"
                    invoiceNumber={`INVOICE ${intent.providerReference ?? intent.id}`}
                    status="pending"
                  />
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-3">
                        <FileText className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
                        <div>
                          <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                            Invoice Due - Campaign funding reserve
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                            {formatCampaignMoney(intent.amount)} is due for managed TikTok/Meta
                            campaign funding - next approved campaign flight.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {intent.checkoutUrl ? (
                          <a
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
                            href={intent.checkoutUrl}
                          >
                            Pay Invoice
                            <ExternalLink className="size-4 stroke-[1.5]" />
                          </a>
                        ) : null}
                        <Button
                          disabled={verifyingPayment}
                          onClick={() => void checkPaymentStatus()}
                          type="button"
                          variant="secondary"
                        >
                          {verifyingPayment ? "Checking..." : "I've paid — check now"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {verifyError ? (
                    <p className="text-sm text-[var(--ft-red)]">{verifyError}</p>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  action={
                    <Button disabled type="button" variant="secondary">
                      <Download className="size-4 stroke-[1.5]" />
                      View Statements
                    </Button>
                  }
                  copy="Once your campaign is approved, invoices will appear here with campaign name, service period, and a clear payment action."
                  icon={CreditCard}
                  title="No pending invoices"
                />
              )}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                action={
                  <Button disabled type="button" variant="secondary">
                    <Plus className="size-4 stroke-[1.5]" />
                    Add Card
                  </Button>
                }
                copy="Saved cards will appear only as tokenized payment methods returned by the secure checkout provider."
                icon={CreditCard}
                title="No saved payment methods"
              />
            </div>
          )}
        </Panel>
      </section>

      {selectedActivity ? (
        <div
          className="fixed inset-0 z-[70] bg-[var(--ft-bg-base)]/80 backdrop-blur-sm"
          onClick={() => setSelectedActivity(undefined)}
        >
          <aside
            className="ml-auto flex h-full w-full max-w-md flex-col border-l border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] p-5">
              <div>
                <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  Ledger detail
                </div>
                <h2 className="mt-2 text-lg font-medium text-[var(--ft-text-primary)]">
                  {selectedActivity.label}
                </h2>
              </div>
              <button
                aria-label="Close transaction detail"
                className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)]"
                onClick={() => setSelectedActivity(undefined)}
                type="button"
              >
                <X className="size-4 stroke-[1.5]" />
              </button>
            </div>
            <div className="grid gap-4 p-5">
              <Badge tone={statusTone(selectedActivity.status)}>{selectedActivity.status}</Badge>
              <Field label="Type" value={activityType(selectedActivity)} />
              <Field label="Amount" value={selectedActivity.amount} />
              <Field label="Reference" value={selectedActivity.reference} />
              <Field label="Recorded" value={selectedActivity.at} />
              <p className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                This entry is part of your wallet audit trail. Campaign budget locks release back to
                available balance when unspent funds are returned.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary">
                  <Download className="size-4 stroke-[1.5]" />
                  Receipt
                </Button>
                <Button type="button" variant="secondary">
                  <FileText className="size-4 stroke-[1.5]" />
                  Statement
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
