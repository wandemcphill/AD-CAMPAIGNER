"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Globe2, Send, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import {
  formatNaira,
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
  { code: "US", label: "USA", currency: "USD" },
  { code: "GB", label: "UK", currency: "GBP" },
  { code: "EU", label: "Europe", currency: "EUR" },
  { code: "CA", label: "Canada", currency: "CAD" }
] as const;

export default function RemittanceTabPage() {
  const [transfers, setTransfers] = useState<RemittanceTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [sourceNaira, setSourceNaira] = useState(50000);
  const [destinationCurrency, setDestinationCurrency] = useState("USD");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientBankCode, setRecipientBankCode] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("US");
  const [quote, setQuote] = useState<RemittanceQuote>();
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);
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
    setQuoting(true); setError(undefined); setQuote(undefined);
    try { setQuote(await getRemittanceQuote({ sourceCurrency: "NGN", destinationCurrency, sourceAmountMinor: sourceNaira * 100 })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not get a quote."); }
    finally { setQuoting(false); }
  }, [destinationCurrency, sourceNaira]);

  const submitSendRemittance = useCallback(async () => {
    if (!quote) return;
    setSending(true); setError(undefined);
    try {
      const result = await sendRemittance({ quoteId: quote.quoteId, recipientName: recipientName.trim(), recipientAccountNumber: recipientAccountNumber.trim(), recipientBankCode: recipientBankCode.trim(), recipientCountry });
      if (result.status !== "active") setError("Transfer was charged but could not be confirmed — check back shortly.");
      setQuote(undefined); setRecipientName(""); setRecipientAccountNumber(""); setRecipientBankCode(""); await refreshTransfers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send this transfer."); }
    finally { setSending(false); }
  }, [quote, recipientAccountNumber, recipientBankCode, recipientCountry, recipientName, refreshTransfers]);

  if (forbidden) return <PermissionDenied>You do not have permission to view remittance for this workspace. Contact your workspace owner if you believe this is a mistake.</PermissionDenied>;

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-5 sm:p-6">
            <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Send className="size-5" /></div><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--ft-accent)]">Global transfers</div><h1 className="mt-1 text-xl font-bold tracking-tight">Send money internationally</h1><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--ft-text-muted)]">Choose a corridor, see what the recipient gets, then review before anything is charged.</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CORRIDORS.map((corridor) => <button className={cn("rounded-2xl border p-3 text-left transition", recipientCountry === corridor.code ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/8" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]/30")} key={corridor.code} onClick={() => { setRecipientCountry(corridor.code); setDestinationCurrency(corridor.currency); setQuote(undefined); }} type="button"><div className="text-sm font-semibold">{corridor.label}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">{corridor.currency}</div></button>)}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <ErrorNotice message={error} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">You send · NGN</label><input className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]" min={100} onChange={(e) => setSourceNaira(Number(e.target.value))} type="number" value={sourceNaira} /></div>
              <div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Recipient gets · {destinationCurrency}</label><div className="flex h-12 items-center rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-4 text-sm text-[var(--ft-text-muted)]">{quote ? `${quote.destinationCurrency} ${(quote.destinationAmountMinor / 100).toLocaleString()}` : "Get a quote first"}</div></div>
            </div>
            <Button className="mt-3 w-full justify-center" disabled={sourceNaira < 100 || quoting} onClick={() => void submitGetQuote()} variant="secondary">{quoting ? "Getting quote..." : "Get live quote"}<ArrowRight className="size-4" /></Button>

            {quote && <div className="mt-4 space-y-3 rounded-2xl border border-[var(--ft-accent)]/20 bg-[var(--ft-accent)]/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-[var(--ft-green)]" /> Quote ready for review</div>
              <div className="grid gap-2 text-xs sm:grid-cols-3"><div><span className="text-[var(--ft-text-muted)]">Recipient gets</span><div className="mt-1 font-semibold">{quote.destinationCurrency} {(quote.destinationAmountMinor / 100).toLocaleString()}</div></div><div><span className="text-[var(--ft-text-muted)]">Fee</span><div className="mt-1 font-semibold">{formatNaira(quote.feeMinor)}</div></div><div><span className="text-[var(--ft-text-muted)]">You pay</span><div className="mt-1 font-semibold">{formatNaira(quote.sourceAmountMinor)}</div></div></div>
              <div className="border-t border-[var(--ft-border)] pt-3"><input aria-label="Recipient name" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient full name" value={recipientName} /></div>
              <input aria-label="Recipient account number" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientAccountNumber(e.target.value)} placeholder="Recipient account number" value={recipientAccountNumber} />
              <div className="grid grid-cols-2 gap-2"><input aria-label="Bank code" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientBankCode(e.target.value)} placeholder="Bank / routing code" value={recipientBankCode} /><input aria-label="Country" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientCountry(e.target.value)} value={recipientCountry} /></div>
              <Button className="w-full justify-center" disabled={!recipientName.trim() || !recipientAccountNumber.trim() || !recipientBankCode.trim() || sending} onClick={() => void submitSendRemittance()}><Send className="size-4" />{sending ? "Sending..." : "Review & send transfer"}</Button>
              {!quote.isLocked && <p className="text-[10px] leading-4 text-[var(--ft-text-muted)]">This rate is indicative until the transfer completes.</p>}
            </div>}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-5"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[var(--ft-green)]/10 text-[var(--ft-green)]"><ShieldCheck className="size-5" /></div><div><div className="text-sm font-semibold">Know the cost before you send</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">FlipTrybe shows the recipient amount and fee before the transfer is submitted.</p></div></div></Panel>
          <Panel className="p-5"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[var(--ft-blue)]/10 text-[var(--ft-blue)]"><Globe2 className="size-5" /></div><div><div className="text-sm font-semibold">Global corridors</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Supported destinations and currencies are presented at the point of transfer.</p></div></div></Panel>
        </div>
      </div>

      <div className="mt-5">
        {transfersLoading ? <Panel className="p-6"><LoadingBlock label="Loading your transfers" /></Panel> : transfers.length === 0 ? <Panel className="p-6"><EmptyState copy="Transfers you send will show up here." icon={Send} title="No transfers yet" /></Panel> : <div className="grid gap-2">{transfers.map((transfer) => <Panel className="flex items-center gap-4 p-4" key={transfer.id}><div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10"><Send className="size-4 text-[var(--ft-accent)]" /></div><div className="flex-1"><div className="font-semibold">{transfer.recipientName}</div><div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{formatNaira(transfer.sourceAmountMinor)} → {transfer.destinationCurrency} {(transfer.destinationAmountMinor / 100).toLocaleString()}</div></div><Badge tone={REMITTANCE_STATUS_TONE[transfer.status]}>{transfer.status.toLowerCase()}</Badge></Panel>)}</div>}
      </div>
    </motion.div>
  );
}
