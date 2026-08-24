"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Send } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";
import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import { formatNaira, getRemittanceQuote, loadRemittanceTransfers, sendRemittance, type RemittanceQuote, type RemittanceStatus, type RemittanceTransfer } from "../api";

const REMITTANCE_STATUS_TONE: Record<RemittanceStatus, "success" | "warning" | "danger" | "neutral"> = { QUOTED: "neutral", CHARGED: "neutral", PROCESSING: "warning", COMPLETED: "success", FAILED: "danger", DISPUTED: "danger" };
const CORRIDORS = [
  { country: "🇺🇸", label: "USA → Nigeria", currency: "USD", hint: "Family & business" },
  { country: "🇬🇧", label: "UK → Nigeria", currency: "GBP", hint: "Family & business" },
  { country: "🇨🇦", label: "Canada → Nigeria", currency: "CAD", hint: "Cross-border" },
  { country: "🇪🇺", label: "Europe → Nigeria", currency: "EUR", hint: "Cross-border" }
];

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

  const refreshTransfers = useCallback(async () => { setError(undefined); setForbidden(false); try { setTransfers(await loadRemittanceTransfers()); } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not load your transfers."); setForbidden(isForbiddenError(caught)); } finally { setTransfersLoading(false); } }, []);
  useEffect(() => { void refreshTransfers(); }, [refreshTransfers]);
  const submitGetQuote = useCallback(async () => { setQuoting(true); setError(undefined); setQuote(undefined); try { setQuote(await getRemittanceQuote({ sourceCurrency: "NGN", destinationCurrency, sourceAmountMinor: sourceNaira * 100 })); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not get a quote."); } finally { setQuoting(false); } }, [destinationCurrency, sourceNaira]);
  const submitSendRemittance = useCallback(async () => { if (!quote) return; setSending(true); setError(undefined); try { const result = await sendRemittance({ quoteId: quote.quoteId, recipientName: recipientName.trim(), recipientAccountNumber: recipientAccountNumber.trim(), recipientBankCode: recipientBankCode.trim(), recipientCountry }); if (result.status !== "active") setError("Transfer was charged but could not be confirmed — check back shortly."); setQuote(undefined); setRecipientName(""); setRecipientAccountNumber(""); setRecipientBankCode(""); await refreshTransfers(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send this transfer."); } finally { setSending(false); } }, [quote, recipientAccountNumber, recipientBankCode, recipientCountry, recipientName, refreshTransfers]);

  if (forbidden) return <PermissionDenied>You do not have permission to view remittance for this workspace. Contact your workspace owner if you believe this is a mistake.</PermissionDenied>;

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <section className="rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">Global transfers</div><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Send money across borders</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">Choose a corridor, see your quote, confirm the recipient and track the transfer. No guessing what happens next.</p></div><div className="hidden size-12 place-items-center rounded-2xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)] sm:grid"><Send className="size-5" /></div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CORRIDORS.map((corridor) => <button key={corridor.label} type="button" onClick={() => { setDestinationCurrency(corridor.currency === "CAD" ? "USD" : corridor.currency); setRecipientCountry(corridor.currency === "EUR" ? "DE" : corridor.currency === "GBP" ? "GB" : corridor.currency === "USD" ? "US" : "CA"); }} className="group rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-left transition hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-sm)]"><div className="text-lg">{corridor.country}</div><div className="mt-1 text-xs font-semibold">{corridor.label}</div><div className="mt-1 text-[10px] text-[var(--ft-text-muted)]">{corridor.hint}</div><div className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ft-accent)]">Start <ArrowRight className="size-3 transition group-hover:translate-x-1" /></div></button>)}</div>
        <div className="mt-5 flex items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-2"><div className="flex items-center gap-2 px-2 text-xs font-semibold"><span className="grid size-6 place-items-center rounded-full bg-[var(--ft-accent)] text-white">1</span> Quote</div><ArrowRight className="size-3 shrink-0 text-[var(--ft-text-muted)]" /><div className="flex items-center gap-2 px-2 text-xs"><span className="grid size-6 place-items-center rounded-full border border-[var(--ft-border)]">2</span> Recipient</div><ArrowRight className="size-3 shrink-0 text-[var(--ft-text-muted)]" /><div className="flex items-center gap-2 px-2 text-xs"><span className="grid size-6 place-items-center rounded-full border border-[var(--ft-border)]">3</span> Review</div><ArrowRight className="size-3 shrink-0 text-[var(--ft-text-muted)]" /><div className="flex items-center gap-2 px-2 text-xs"><span className="grid size-6 place-items-center rounded-full border border-[var(--ft-border)]">4</span> Track</div></div>
      </section>
      <ErrorNotice message={error} />
      <Panel className="mt-4 p-5"><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Send (NGN)</label><input className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]" min={100} onChange={(e) => setSourceNaira(Number(e.target.value))} type="number" value={sourceNaira} /></div><div><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">To</label><select className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]" onChange={(e) => setDestinationCurrency(e.target.value)} value={destinationCurrency}><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></div></div><Button className="mt-3 w-full justify-center" disabled={sourceNaira < 100 || quoting} onClick={() => void submitGetQuote()} variant="secondary">{quoting ? "Getting quote..." : "Get quote"}</Button>
        {quote && <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] p-3"><div className="text-sm">Recipient gets <span className="font-semibold">{quote.destinationCurrency} {(quote.destinationAmountMinor / 100).toLocaleString()}</span> · fee {formatNaira(quote.feeMinor)}</div><div className="text-xs text-[var(--ft-text-muted)]">You’ll be charged {formatNaira(quote.sourceAmountMinor)}{!quote.isLocked && " · rate is indicative until the transfer completes"}</div><input className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" value={recipientName} /><input className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientAccountNumber(e.target.value)} placeholder="Account number" value={recipientAccountNumber} /><div className="grid grid-cols-2 gap-2"><input className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientBankCode(e.target.value)} placeholder="Bank code" value={recipientBankCode} /><input className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setRecipientCountry(e.target.value)} placeholder="Country (e.g. US)" value={recipientCountry} /></div><Button className="w-full justify-center" disabled={!recipientName.trim() || !recipientAccountNumber.trim() || !recipientBankCode.trim() || sending} onClick={() => void submitSendRemittance()}><Check className="size-4" />{sending ? "Sending..." : "Review & send"}</Button></div>}
      </Panel>
      <div className="mt-4">{transfersLoading ? <Panel className="p-6"><LoadingBlock label="Loading your transfers" /></Panel> : transfers.length === 0 ? <Panel className="p-6"><EmptyState copy="Transfers you send will show up here." icon={Send} title="No transfers yet" /></Panel> : <div className="grid gap-2">{transfers.map((transfer) => <Panel className="flex items-center gap-4 p-4" key={transfer.id}><div className={cn("grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10")}><Send className="size-4 text-[var(--ft-accent)]" /></div><div className="flex-1"><div className="font-semibold">{transfer.recipientName}</div><div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{formatNaira(transfer.sourceAmountMinor)} → {transfer.destinationCurrency} {(transfer.destinationAmountMinor / 100).toLocaleString()}</div></div><Badge tone={REMITTANCE_STATUS_TONE[transfer.status]}>{transfer.status.toLowerCase()}</Badge></Panel>)}</div>}</div>
    </motion.div>
  );
}
