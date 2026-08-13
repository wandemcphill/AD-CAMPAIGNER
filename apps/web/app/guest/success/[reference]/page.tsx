"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  PartyPopper,
  Download,
  Mail,
  Wallet,
  Receipt,
  Gift,
  Megaphone,
  FileText,
  Loader2
} from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { getGuestReceipt, type GuestTransactionSummary } from "../../guest-checkout-api";

// Every perk here must be something an account can actually do today. Cashback,
// saved beneficiaries and "exclusive discounts" were previously listed and exist
// nowhere in the codebase; virtual cards and send-money sit behind feature flags
// that default off (see packages/feature-flags). Do not add a perk without
// checking it ships.
const PERKS = [
  { icon: Receipt, label: "All your receipts in one place" },
  { icon: Wallet, label: "Fund a wallet for faster checkout" },
  { icon: Gift, label: "Rewards and vouchers" },
  { icon: FileText, label: "Send invoices and payment links" },
  { icon: Megaphone, label: "Run campaigns for your business" }
];

function formatNaira(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    amountMinor / 100
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function receiptText(receipt: GuestTransactionSummary) {
  return [
    "FlipTrybe Receipt",
    "==================",
    `Reference: ${receipt.reference}`,
    `Product: ${receipt.productType} (${receipt.provider})`,
    `Recipient: ${receipt.beneficiary}`,
    `Amount: ${formatNaira(receipt.amountMinor, receipt.currency)}`,
    `Payment method: ${receipt.paymentMethod ?? "n/a"}`,
    `Payment status: ${receipt.paymentStatus}`,
    `Fulfilment status: ${receipt.fulfilmentStatus}`,
    `Provider reference: ${receipt.providerReference ?? "n/a"}`,
    `Date: ${formatDate(receipt.createdAt)}`,
    "",
    "Thank you for using FlipTrybe."
  ].join("\n");
}

function downloadReceipt(receipt: GuestTransactionSummary) {
  const blob = new Blob([receiptText(receipt)], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fliptrybe-receipt-${receipt.reference}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function emailReceiptHref(receipt: GuestTransactionSummary, email: string) {
  const subject = encodeURIComponent(`Your FlipTrybe receipt — ${receipt.reference}`);
  const body = encodeURIComponent(receiptText(receipt));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  PAID: "success",
  DELIVERED: "success",
  PENDING: "neutral",
  PROCESSING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral"
};

export default function GuestSuccessPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [receipt, setReceipt] = useState<GuestTransactionSummary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getGuestReceipt(reference)
      .then((r) => {
        if (!cancelled) setReceipt(r);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load your receipt.");
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] px-4 text-[var(--ft-text-primary)]">
        <Panel className="max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--ft-red)]">Couldn&apos;t load receipt</h1>
          <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">{error}</p>
        </Panel>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
        <Loader2 className="size-8 animate-spin text-[var(--ft-accent)]" />
      </main>
    );
  }

  const delivered = receipt.fulfilmentStatus === "DELIVERED";
  const registerHref = `/register?migrateContact=${encodeURIComponent(receipt.email)}`;

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)] sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img alt="FlipTrybe" className="size-9" src="/brand/icon-mark.svg" />
            <span className="text-lg font-bold">FlipTrybe</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-10 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--ft-green-subtle)] text-[var(--ft-green)]">
            <PartyPopper className="size-8" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            {delivered ? "Congratulations!" : "Almost there"}
          </h1>
          <p className="mt-2 text-base text-[var(--ft-text-secondary)]">
            {delivered
              ? "Your purchase was successful."
              : "Your payment went through — we're finishing up your order and will email you the moment it's done."}
          </p>
        </div>

        <Panel className="mt-8 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ft-text-muted)]">Receipt</h2>
            <Badge tone={STATUS_TONE[receipt.fulfilmentStatus] ?? "neutral"}>{receipt.fulfilmentStatus.toLowerCase()}</Badge>
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["Reference", receipt.reference],
              ["Amount", formatNaira(receipt.amountMinor, receipt.currency)],
              ["Status", `${receipt.paymentStatus} / ${receipt.fulfilmentStatus}`],
              ["Date", formatDate(receipt.createdAt)],
              ["Provider", receipt.provider],
              ["Recipient", receipt.beneficiary],
              ["Provider reference", receipt.providerReference ?? "n/a"],
              ["Payment method", receipt.paymentMethod ?? "n/a"]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between gap-4 border-b border-[var(--ft-border)] pb-2 last:border-0 last:pb-0" key={label}>
                <dt className="text-[var(--ft-text-muted)]">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 justify-center" onClick={() => downloadReceipt(receipt)} variant="secondary">
              <Download className="size-4" />
              Download receipt
            </Button>
            <a className="flex-1" href={emailReceiptHref(receipt, receipt.email)}>
              <Button className="w-full justify-center" variant="secondary">
                <Mail className="size-4" />
                Email receipt
              </Button>
            </a>
          </div>
        </Panel>

        <Panel className="mt-6 p-6">
          <h2 className="text-lg font-bold">Create a FlipTrybe account to:</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PERKS.map((perk) => (
              <li className="flex items-center gap-2.5 text-sm text-[var(--ft-text-secondary)]" key={perk.label}>
                <perk.icon className="size-4 shrink-0 text-[var(--ft-accent)]" />
                {perk.label}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a className="flex-1" href={registerHref}>
              <Button className="w-full justify-center">Create Free Account</Button>
            </a>
            <a className="flex-1" href="/guest">
              <Button className="w-full justify-center" variant="secondary">Maybe Later</Button>
            </a>
          </div>
        </Panel>
      </div>
    </main>
  );
}
