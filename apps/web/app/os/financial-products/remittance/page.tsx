"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Globe2, Send, ShieldCheck, LockKeyhole, Landmark } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import { CustomerTransactionJourney, type TransactionJourneyStage } from "../../components/customer-transaction-journey";
import {
  getRemittanceQuote,
  loadRemittanceTransfers,
  sendRemittance,
  type RemittanceQuote,
  type RemittanceStatus,
  type RemittanceTransfer
} from "../api";

const REMITTANCE_STATUS_TONE: Record<RemittanceStatus, "success" | "warning" | "danger" | "neutral"> = {
  QUOTED: "neutral", CHARGED: "neutral", PROCESSING: "warning", COMPLETED: "success", FAILED: "danger", DISPUTED: "danger"
};

const CORRIDORS = [
  { code: "US", label: "USA", currency: "USD", flag: "🇺🇸" },
  { code: "GB", label: "UK", currency: "GBP", flag: "🇬🇧" },
  { code: "EU", label: "Europe", currency: "EUR", flag: "🇪🇺" },
  { code: "CA", label: "Canada", currency: "CAD", flag: "🇨🇦" }
] as const;

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

export default function RemittanceTabPage() {
  const [transfers, setTransfers] = useState<RemittanceTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [sourceAmount, setSourceAmount] = useState(500);
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientBankCode, setRecipientBankCode] = useState("");
  const [recipientCountry] = useState("NG");
  const [quote, setQuote] = useState<RemittanceQuote>();
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedTransferId, setCompletedTransferId] = useState<string>();
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const refreshTransfers = useCallback(async () => {
    setError(undefined); setForbidden(false);
    try { setTransfers(await loadRemittanceTransfers()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We could not load your transfers."); setForbidden(isForbiddenError(caught)); }
    finally { setTransfersLoading(false); }
  }, []);

  useEffect(() => { void refreshTransfers(); }, [refreshTransfers]);

  const submitGetQuote = useCallback(async () => {
    setQuoting(true); setError(undefined); setQuote(undefined); setReviewing(false); setCompleted(false); setCompletedTransferId(undefined);
    try { setQuote(await getRemittanceQuote({ sourceCurrency, destinationCurrency: "NGN", sourceAmountMinor: Math.round(sourceAmount * 100) })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not get a quote."); }
    finally { setQuoting(false); }
  }, [sourceAmount, sourceCurrency]);

  const submitSendRemittance = useCallback(async () => {
    if (!quote) return;
    setSending(true); setError(undefined);
    try {
      const result = await sendRemittance({ quoteId: quote.quoteId, recipientName: recipientName.trim(), recipientAccountNumber: recipientAccountNumber.trim(), recipientBankCode: recipientBankCode.trim(), recipientCountry });
      setCompletedTransferId(result.transferId ?? result.id ?? result.reference ?? undefined);
      setCompleted(true);
      setQuote(undefined); setReviewing(false); setRecipientName(""); setRecipientAccountNumber(""); setRecipientBankCode("");
      await refreshTransfers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send this transfer."); }
    finally { setSending(false); }
  }, [quote, recipientAccountNumber, recipientBankCode, recipientCountry, recipientName, refreshTransfers]);

  if (forbidden) return <PermissionDenied>You do not have permission to view remittance for this workspace. Contact your workspace owner if you believe this is a mistake.</PermissionDenied>;

  const journey: TransactionJourneyStage = completed ? "complete" : reviewing ? "review" : quote ? "quote" : "choose";

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-5 sm:p-6">
            <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Send className="size-5" /></div><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--ft-accent)]">Global transfers</div><h1 className="mt-1 text-xl font-bold tracking-tight">Send money to Nigeria</h1><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--ft-text-muted)]">Send from the USA, UK, Europe or Canada. Choose your corridor, see exactly what arrives in Nigeria, then review before anything is charged.</p></div></div>
            <CustomerTransactionJourney className="mt-5" current={journey} />
            {!completed ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CORRIDORS.map((corridor) => <button className={cn("rounded-2xl border p-3 text-left transition", sourceCurrency === corridor.currency ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/8" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]/30")} key={corridor.code} onClick={() => { setSourceCurrency(corridor.currency); setQuote(undefined); setReviewing(false); setCompleted(false); }} type="button"><div className="text-sm font-semibold">{corridor.flag} {corridor.label}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Send {corridor.currency} → Receive NGN</div></button>)}
            </div> : null}
          </div>

          <div className="p-5 sm:p-6">
            <ErrorNotice message={error} />
            {completed ? (
              <div className="rounded-2xl border border-[var(--ft-green)]/25 bg-[var(--ft-green)]/5 p-6 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--ft-green)]/15 text-[var(--ft-green)]"><CheckCircle2 className="size-6" /></div>
                <h2 className="mt-4 text-lg font-semibold">Transfer submitted</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Your Nigeria transfer is now in the activity trail.</p>
                {completedTransferId ? <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">Reference · {completedTransferId}</div> : null}
                <Button className="mt-5" onClick={() => { setCompleted(false); setQuote(undefined); }} variant="secondary">Send another transfer</Button>
              </div>
            ) : <>
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[var(--ft-green)]/20 bg-[var(--ft-green)]/5 p-3 text-xs"><Landmark className="size-4 shrink-0 text-[var(--ft-green)]" /><span><strong>Nigeria destination:</strong> recipient receives NGN into a supported Nigerian bank account.</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">You send · {sourceCurrency}</label><input className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]" min={1} onChange={(e) => setSourceAmount(Number(e.target.value))} type="number" value={sourceAmount} /></div>
                <div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Recipient gets · NGN</label><div className="flex h-12 items-center rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-4 text-sm text-[var(--ft-text-muted)]">{quote ? formatMoney(quote.destinationAmountMinor, "NGN") : "Get a live quote first"}</div></div>
              </div>
              <Button className="mt-3 w-full justify-center" disabled={sourceAmount <= 0 || quoting} onClick={() => void submitGetQuote()} variant="secondary">{quoting ? "Getting live quote..." : `Quote ${sourceCurrency} → NGN`}<ArrowRight className="size-4" /></Button>

              {quote && <div className="mt-4 space-y-3 rounded-2xl border border-[var(--ft-accent)]/20 bg-[var(--ft-accent)]/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-[var(--ft-green)]" /> Quote ready for review</div>
                <div className="grid gap-2 text-xs sm:grid-cols-3"><div><span className="text-[var(--ft-text-muted)]">You send</span><div className="mt-1 font-semibold">{formatMoney(quote.sourceAmountMinor, quote.sourceCurrency)}</div></div><div><span className="text-[var(--ft-text-muted)]">Recipient gets</span><div className="mt-1 font-semibold">{formatMoney(quote.destinationAmountMinor, "NGN")}</div></div><div><span className="text-[var(--ft-text-muted)]">Fee</span><div className="mt-1 font-semibold">{formatMoney(quote.feeMinor, quote.sourceCurrency)}</div></div></div>
                {!reviewing ? <>
                  <div className="border-t border-[var(--ft-border)] pt-3"><input aria-label="Recipient name" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient full name in Nigeria" value={recipientName} /></div>
                  <input aria-label="Recipient account number" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)]" onChange={(e) => setRecipientAccountNumber(e.target.value)} placeholder="Nigerian bank account number" value={recipientAccountNumber} />
                  <input aria-label="Bank code" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientBankCode(e.target.value)} placeholder="Nigerian bank code" value={recipientBankCode} />
                  <Button className="w-full justify-center" disabled={!recipientName.trim() || !recipientAccountNumber.trim() || !recipientBankCode.trim()} onClick={() => setReviewing(true)}><ArrowRight className="size-4" />Review transfer</Button>
                </> : <>
                  <div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-[var(--ft-accent)]" /> Final confirmation</div><div className="mt-3 grid gap-2 text-xs"><div className="flex justify-between gap-4"><span className="text-[var(--ft-text-muted)]">Recipient</span><span className="font-semibold">{recipientName}</span></div><div className="flex justify-between gap-4"><span className="text-[var(--ft-text-muted)]">Destination</span><span className="font-semibold">Nigeria · {recipientAccountNumber}</span></div><div className="flex justify-between gap-4"><span className="text-[var(--ft-text-muted)]">You send</span><span className="font-semibold">{formatMoney(quote.sourceAmountMinor, quote.sourceCurrency)}</span></div><div className="flex justify-between gap-4"><span className="text-[var(--ft-text-muted)]">Recipient gets</span><span className="font-semibold">{formatMoney(quote.destinationAmountMinor, "NGN")}</span></div></div></div>
                  <div className="grid grid-cols-2 gap-2"><Button className="justify-center" onClick={() => setReviewing(false)} variant="secondary">Edit details</Button><Button className="justify-center" disabled={sending} onClick={() => void submitSendRemittance()}>{sending ? "Sending..." : "Confirm & send"}</Button></div>
                </>}
                {!quote.isLocked && <p className="text-[10px] leading-4 text-[var(--ft-text-muted)]">This rate is indicative until the transfer completes.</p>}
              </div>}
            </>}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-5"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[var(--ft-green)]/10 text-[var(--ft-green)]"><ShieldCheck className="size-5" /></div><div><div className="text-sm font-semibold">Know the cost before you send</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">FlipTrybe shows the send amount, recipient amount and fee before the transfer is submitted.</p></div></div></Panel>
          <Panel className="p-5"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[var(--ft-blue)]/10 text-[var(--ft-blue)]"><Globe2 className="size-5" /></div><div><div className="text-sm font-semibold">Built around real corridors</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">USA · UK · Europe · Canada → Nigeria, with the destination currency fixed at NGN.</p></div></div></Panel>
        </div>
      </div>

      <div className="mt-5">
        {transfersLoading ? <Panel className="p-6"><LoadingBlock label="Loading your transfers" /></Panel> : transfers.length === 0 ? <Panel className="p-6"><EmptyState copy="Transfers you send will show up here." icon={Send} title="No transfers yet" /></Panel> : <div className="grid gap-2">{transfers.map((transfer) => <Panel className="flex items-center gap-4 p-4" key={transfer.id}><div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10"><Send className="size-4 text-[var(--ft-accent)]" /></div><div className="flex-1"><div className="font-semibold">{transfer.recipientName}</div><div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{formatMoney(transfer.sourceAmountMinor, transfer.sourceCurrency)} → {formatMoney(transfer.destinationAmountMinor, transfer.destinationCurrency)}</div></div><Badge tone={REMITTANCE_STATUS_TONE[transfer.status]}>{transfer.status.toLowerCase()}</Badge></Panel>)}</div>}
      </div>
    </motion.div>
  );
}
