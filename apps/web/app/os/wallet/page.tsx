"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Bitcoin,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ticket,
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
  ValueSkeleton,
  WalletBalance,
  cn
} from "@fliptrybe/ui";
import type { CurrencyCode, PaymentIntent } from "@fliptrybe/types";

import {
  amountToMinor,
  createWalletFundingIntent,
  formatCampaignMoney,
  listWalletWithdrawals,
  loadInvoices,
  payInvoiceFromWallet,
  requestWalletWithdrawal,
  verifyPayment,
  type CampaignInvoiceRecord,
  type CreatePaymentIntentInput,
  type RequestWalletWithdrawalInput,
  type WalletWithdrawalRecord
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
import { useFeatureFlags } from "../../lib/feature-flags";
import { useApiSession } from "../../lib/use-session";
import { SectionTabs, type SectionTab } from "../section-tabs";

const MONEY_TABS_BASE: SectionTab[] = [{ label: "Wallet", href: "/os/wallet", icon: WalletCards }];

type BillingTab = "history" | "invoices" | "methods" | "withdraw";

// Withdrawals depend on a live NGN payout provider and are gated by the
// `walletWithdrawals` flag; the tab is hidden entirely when this deployment
// does not run them, since the endpoints behind it answer 503.
const billingTabs: Array<{ label: string; value: BillingTab; flag?: string }> = [
  { label: "Spend History", value: "history" },
  { label: "Invoices", value: "invoices" },
  { label: "Payment Methods", value: "methods" },
  { label: "Withdraw", value: "withdraw", flag: "walletWithdrawals" }
];

function withdrawalStatusTone(status: WalletWithdrawalRecord["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RECONCILIATION_REQUIRED") return "warning";
  return "info";
}

function withdrawalStatusLabel(status: WalletWithdrawalRecord["status"]) {
  switch (status) {
    case "HOLD":
      return "On hold";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "RECONCILIATION_REQUIRED":
      return "Under review";
    default:
      return status;
  }
}

const presetTopUps = ["10000", "25000", "50000", "100000"];

const fundingTrustItems = [
  {
    copy: "Funds move into a locked reserve only when a payment or order is being prepared.",
    icon: WalletCards,
    label: "Held balance",
    value: "Reserved on demand"
  },
  {
    copy: "Every invoice explains the service, amount, gateway reference, and next action.",
    icon: FileText,
    label: "Invoice clarity",
    value: "Fully itemised"
  },
  {
    copy: "Reserved funds return to your available balance after reconciliation.",
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
    ? `${formatCampaignMoney(intent.amount)} is waiting for checkout. Complete payment to add it to your balance.`
    : heldMinor > 0
      ? `${heldLabel} is reserved for pending orders. Funds return to available balance once they settle.`
      : "When an invoice is issued, it will appear here above your transaction history.";

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
  // ?tab= lets Money link straight at a specific surface (Transactions → history,
  // Payouts → withdraw) instead of those needing routes of their own. Read once on
  // mount via window.location to avoid useSearchParams' Suspense requirement.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && billingTabs.some((tab) => tab.value === requested)) {
      setActiveTab(requested as BillingTab);
    }
  }, []);
  const [intent, setIntent] = useState<PaymentIntent>();
  const [selectedActivity, setSelectedActivity] = useState<BillingActivity>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<CampaignInvoiceRecord[]>();
  const [invoicesError, setInvoicesError] = useState<string>();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string>();
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyError, setVerifyError] = useState<string>();
  const [withdrawMethod, setWithdrawMethod] = useState<"BANK" | "CRYPTO">("BANK");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawRecipientName, setWithdrawRecipientName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawBankCode, setWithdrawBankCode] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawFormError, setWithdrawFormError] = useState<string>();
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawalRecord[]>();
  const [withdrawalsError, setWithdrawalsError] = useState<string>();
  const { flags } = useFeatureFlags();
  const visibleBillingTabs = billingTabs.filter((tab) => !tab.flag || flags[tab.flag] === true);
  const moneyTabs: SectionTab[] = [
    ...MONEY_TABS_BASE,
    { label: "Vouchers", href: "/os/vouchers", icon: Ticket },
    ...(flags["virtualAccounts"] === true || flags["virtualCards"] === true || flags["remittance"] === true
      ? [{ label: "Financial Products", href: "/os/financial-products", icon: Building2 }]
      : []),
    ...(flags["cryptoSell"] === true ? [{ label: "Sell Crypto", href: "/os/crypto", icon: Bitcoin }] : []),
    ...(flags["rmbBuy"] === true ? [{ label: "Buy RMB", href: "/os/rmb", icon: Banknote }] : []),
  ];
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

  useEffect(() => {
    if (activeTab !== "withdraw" || withdrawals !== undefined) return;
    if (flags["walletWithdrawals"] !== true) return;
    void listWalletWithdrawals()
      .then(setWithdrawals)
      .catch((caught) =>
        setWithdrawalsError(caught instanceof Error ? caught.message : "Could not load withdrawal history.")
      );
  }, [activeTab, withdrawals, flags]);

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWithdrawFormError(undefined);
    setWithdrawSubmitting(true);
    try {
      const amountMinor = amountToMinor(withdrawAmount);
      if (!amountMinor) {
        throw new Error("Enter a withdrawal amount before continuing.");
      }
      if (!withdrawRecipientName.trim() || !withdrawAccountNumber.trim() || !withdrawBankCode.trim()) {
        throw new Error("Enter the recipient name, account number, and bank code.");
      }

      const input: RequestWalletWithdrawalInput = {
        amountMinor,
        recipientName: withdrawRecipientName.trim(),
        recipientAccountNumber: withdrawAccountNumber.trim(),
        recipientBankCode: withdrawBankCode.trim()
      };

      const created = await requestWalletWithdrawal(input);
      setWithdrawals((current) => [created, ...(current ?? [])]);
      setWithdrawAmount("");
      setWithdrawRecipientName("");
      setWithdrawAccountNumber("");
      setWithdrawBankCode("");
      await refresh();
    } catch (caught) {
      setWithdrawFormError(
        caught instanceof Error ? caught.message : "Could not submit this withdrawal. No funds were moved."
      );
    } finally {
      setWithdrawSubmitting(false);
    }
  }

  function handleWithdrawSubmit(event: FormEvent<HTMLFormElement>) {
    void submitWithdrawal(event);
  }

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

      <div className="mt-4">
        <SectionTabs items={moneyTabs} />
      </div>

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
            value: loading ? <ValueSkeleton width="w-24" /> : moneyValue(totalSpentMinor, currency)
          },
          {
            detail: "Reserved for active campaigns",
            label: "Budget Reserve",
            value: loading ? <ValueSkeleton width="w-10" /> : heldLabel
          },
          {
            detail: pendingChargeMinor > 0 ? "Needs checkout" : "No pending charges",
            label: "Checkout Due",
            value: loading ? <ValueSkeleton width="w-24" /> : moneyValue(pendingChargeMinor, currency)
          }
        ].map((item) => (
          <div
            className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-surface)] p-4"
            key={item.label}
          >
            <div className="font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
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
              <div className="font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
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
                {visibleBillingTabs.map((tab) => (
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
              <div className="hidden grid-cols-[132px_minmax(220px,1fr)_96px_132px_132px] gap-3 border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase xl:grid">
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
                    copy="Add funds to your wallet to pay for campaigns, services, and more."
                    icon={CreditCard}
                    title="No transactions yet"
                  />
                </div>
              ) : (
                groupedActivity.map((group) => (
                  <div key={group.month}>
                    <div className="sticky top-[52px] z-10 border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-4 py-2 font-mono text-micro font-medium tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">
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
                          <div className="mt-1 font-mono text-micro tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            {item.status}
                          </div>
                        </div>
                        <span className="w-fit rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-0.5 font-mono text-micro tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">
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
                          <div className="flex gap-2 font-mono text-micro tracking-[0.04em] text-[var(--ft-accent)] uppercase">
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
          ) : activeTab === "withdraw" ? (
            <div className="grid gap-5 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div>
                {/*
                 * CRYPTO WITHDRAWAL — scoped, not built. Investigated 2026-08-12.
                 *
                 * Why it's disabled: the only crypto rail wired into this codebase is the
                 * Sogo Partner API adapter (packages/providers/src/crypto.ts,
                 * createSogoCryptoAdapter / CryptoSellProvider), used by
                 * apps/api/src/modules/crypto/crypto.service.ts for the "Sell Crypto" flow.
                 * That adapter is INBOUND-ONLY: listAssets, getEstimatedRate,
                 * getOrCreateDepositAddress, simulateTestDeposit. There is no send/payout/
                 * withdraw endpoint anywhere in the Sogo integration, and no other crypto
                 * provider exists in packages/providers/src/ (Swappr, used by
                 * requestWithdrawal() in financial-products.service.ts, is an NGN-only bank
                 * remittance rail with no on-chain capability). There are also no
                 * crypto-payout-shaped env vars reserved anywhere (checked .env.example and
                 * SOGO_* usage) — this was never scaffolded, not just flag-gated off.
                 *
                 * What would need to happen to build this for real:
                 *   1. Confirm with Sogo (or a dedicated payout-capable provider — e.g. a
                 *      custodial/MPC signing service or exchange with a send-crypto API)
                 *      whether an outbound endpoint exists or can be added to our contract.
                 *      Do not assume Sogo's inbound deposit-address model extends to sends;
                 *      most crypto-sell/gift-card style integrations are inbound-only by
                 *      design (they only need to detect deposits, not custody keys).
                 *   2. Once a real outbound-capable provider is confirmed, add a
                 *      `sendCrypto` capability to a new/extended provider interface
                 *      (mirroring CryptoSellProvider's shape) — never call an unverified
                 *      endpoint speculatively; a wrong guess sends customer funds to nowhere
                 *      with no chargeback.
                 *   3. Address validation per chain BEFORE any hold is placed: checksum
                 *      validation for EVM chains (EIP-55), base58/bech32 + length checks for
                 *      Bitcoin, contract-vs-EOA detection where relevant to avoid burning
                 *      funds sent to a contract that can't receive them, and explicit
                 *      network/asset pairing (e.g. reject a BTC address on an ETH-network
                 *      withdrawal request).
                 *   4. Chain finality / confirmation semantics differ from the bank-payout
                 *      ambiguous-outcome model already used for HOLD in requestWithdrawal():
                 *      a broadcast tx is not "sent" until N confirmations, and unlike a bank
                 *      transfer it can NEVER be reversed once final. The ledger discipline
                 *      needs a distinct "broadcast but unconfirmed" state, not just
                 *      HOLD -> RELEASE+DEBIT / RELEASE.
                 *   5. Network/gas fee handling: fees are dynamic, paid in the source or
                 *      native asset, and must be quoted to the user and reconciled against
                 *      what's actually deducted on-chain — this has no analog in the NGN
                 *      bank-payout flow.
                 *   6. Start with a minimal chain/asset set (e.g. USDT/USDC on a single
                 *      well-understood network) rather than mirroring all networks Sogo
                 *      lists for deposits — deposit-supported networks are not evidence an
                 *      outbound rail supports the same set.
                 *
                 * Unblocks when: a payout-capable provider is contracted and its sandbox
                 * credentials are available to build and test against. Until then, keeping
                 * this disabled is the safe behavior — do not wire a naive send-crypto call
                 * against the Sogo inbound-only API.
                 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={cn(
                      "h-10 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition",
                      withdrawMethod === "BANK"
                        ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                        : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] hover:border-[var(--ft-accent)]"
                    )}
                    onClick={() => setWithdrawMethod("BANK")}
                    type="button"
                  >
                    Bank
                  </button>
                  <button
                    aria-disabled
                    className="h-10 cursor-not-allowed rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm font-medium text-[var(--ft-text-muted)]"
                    disabled
                    title="Crypto withdrawal is coming soon — no payout provider is connected yet."
                    type="button"
                  >
                    Crypto
                    <span className="ml-1 font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                      Soon
                    </span>
                  </button>
                </div>

                <form className="mt-5 grid gap-4" onSubmit={handleWithdrawSubmit}>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Amount
                    <input
                      className={amountInputClass}
                      inputMode="numeric"
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder="0"
                      value={withdrawAmount}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Account name
                    <input
                      className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--ft-accent)]"
                      onChange={(event) => setWithdrawRecipientName(event.target.value)}
                      placeholder="Name on the bank account"
                      value={withdrawRecipientName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Account number
                    <input
                      className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 font-mono text-sm text-[var(--ft-text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--ft-accent)]"
                      inputMode="numeric"
                      onChange={(event) => setWithdrawAccountNumber(event.target.value)}
                      placeholder="10-digit NUBAN"
                      value={withdrawAccountNumber}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                    Bank code
                    <input
                      className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 font-mono text-sm text-[var(--ft-text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--ft-accent)]"
                      onChange={(event) => setWithdrawBankCode(event.target.value)}
                      placeholder="e.g. 044"
                      value={withdrawBankCode}
                    />
                  </label>

                  {withdrawFormError ? (
                    <p className="text-sm text-[var(--ft-red)]">{withdrawFormError}</p>
                  ) : null}

                  <Button disabled={withdrawSubmitting} type="submit">
                    <WalletCards className="size-4 stroke-[1.5]" />
                    {withdrawSubmitting ? "Submitting withdrawal" : "Withdraw to bank"}
                  </Button>
                  <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm leading-5 text-[var(--ft-text-secondary)]">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[var(--ft-text-muted)]" />
                    <span>
                      Funds are held on your wallet the moment you submit and released back only if
                      the transfer fails outright — never guessed or auto-retried.
                    </span>
                  </div>
                </form>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">Withdrawal history</h3>
                {withdrawalsError ? (
                  <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
                    {withdrawalsError}
                  </div>
                ) : null}
                {withdrawals === undefined ? (
                  <div className="mt-3">
                    <LoadingBlock label="Loading withdrawal history" />
                  </div>
                ) : withdrawals.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      copy="Bank withdrawals you submit will show up here with their status — on hold, processing, completed, failed, or under review."
                      icon={WalletCards}
                      title="No withdrawals yet"
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {withdrawals.map((row) => (
                      <div
                        className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                        key={row.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                            {formatCampaignMoney({ amountMinor: row.amountMinor, currency: row.currency })}
                          </div>
                          <Badge tone={withdrawalStatusTone(row.status)}>
                            {withdrawalStatusLabel(row.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-[var(--ft-text-secondary)]">
                          {row.recipientName} · {row.recipientAccountNumber}
                        </div>
                        <div className="font-mono text-micro text-[var(--ft-text-muted)]">
                          {new Date(row.createdAt).toLocaleString()}
                          {row.providerReference ? ` · Ref ${row.providerReference}` : ""}
                        </div>
                        {row.status === "RECONCILIATION_REQUIRED" ? (
                          <p className="text-sm leading-6 text-[var(--ft-yellow)]">
                            This withdrawal is under manual review — please do not resubmit it.
                          </p>
                        ) : null}
                        {row.status === "FAILED" && row.failureReason ? (
                          <p className="text-sm leading-6 text-[var(--ft-red)]">{row.failureReason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                <div className="font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
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
