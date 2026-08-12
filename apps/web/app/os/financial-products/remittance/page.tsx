"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
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
  QUOTED: "neutral",
  CHARGED: "neutral",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  DISPUTED: "danger"
};

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
    setError(undefined);
    setForbidden(false);
    try {
      setTransfers(await loadRemittanceTransfers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your transfers.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTransfers();
  }, [refreshTransfers]);

  const submitGetQuote = useCallback(async () => {
    setQuoting(true);
    setError(undefined);
    setQuote(undefined);
    try {
      setQuote(
        await getRemittanceQuote({
          sourceCurrency: "NGN",
          destinationCurrency,
          sourceAmountMinor: sourceNaira * 100
        })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get a quote.");
    } finally {
      setQuoting(false);
    }
  }, [destinationCurrency, sourceNaira]);

  const submitSendRemittance = useCallback(async () => {
    if (!quote) return;
    setSending(true);
    setError(undefined);
    try {
      const result = await sendRemittance({
        quoteId: quote.quoteId,
        recipientName: recipientName.trim(),
        recipientAccountNumber: recipientAccountNumber.trim(),
        recipientBankCode: recipientBankCode.trim(),
        recipientCountry,
        sourceAmountMinor: quote.sourceAmountMinor,
        sourceCurrency: quote.sourceCurrency,
        destinationAmountMinor: quote.destinationAmountMinor,
        destinationCurrency: quote.destinationCurrency,
        feeMinor: quote.feeMinor
      });
      if (result.status !== "active") {
        setError("Transfer was charged but could not be confirmed — check back shortly.");
      }
      setQuote(undefined);
      setRecipientName("");
      setRecipientAccountNumber("");
      setRecipientBankCode("");
      await refreshTransfers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send this transfer.");
    } finally {
      setSending(false);
    }
  }, [quote, recipientAccountNumber, recipientBankCode, recipientCountry, recipientName, refreshTransfers]);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view remittance for this workspace. Contact your workspace
        owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <ErrorNotice message={error} />
      <Panel className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Send (NGN)</label>
            <input
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              min={100}
              onChange={(e) => setSourceNaira(Number(e.target.value))}
              type="number"
              value={sourceNaira}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">To</label>
            <select
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              onChange={(e) => setDestinationCurrency(e.target.value)}
              value={destinationCurrency}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <Button
          className="mt-3 w-full justify-center"
          disabled={sourceNaira < 100 || quoting}
          onClick={() => void submitGetQuote()}
          variant="secondary"
        >
          {quoting ? "Getting quote..." : "Get quote"}
        </Button>

        {quote && (
          <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] p-3">
            <div className="text-sm">
              Recipient gets{" "}
              <span className="font-semibold">
                {quote.destinationCurrency} {(quote.destinationAmountMinor / 100).toLocaleString()}
              </span>{" "}
              · fee {formatNaira(quote.feeMinor)}
            </div>

            <input
              className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient name"
              value={recipientName}
            />
            <input
              className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setRecipientAccountNumber(e.target.value)}
              placeholder="Account number"
              value={recipientAccountNumber}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                onChange={(e) => setRecipientBankCode(e.target.value)}
                placeholder="Bank code"
                value={recipientBankCode}
              />
              <input
                className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                onChange={(e) => setRecipientCountry(e.target.value)}
                placeholder="Country (e.g. US)"
                value={recipientCountry}
              />
            </div>

            <Button
              className="w-full justify-center"
              disabled={
                !recipientName.trim() || !recipientAccountNumber.trim() || !recipientBankCode.trim() || sending
              }
              onClick={() => void submitSendRemittance()}
            >
              <Send className="size-4" />
              {sending ? "Sending..." : "Send transfer"}
            </Button>
          </div>
        )}
      </Panel>

      <div className="mt-4">
        {transfersLoading ? (
          <Panel className="p-6">
            <LoadingBlock label="Loading your transfers" />
          </Panel>
        ) : transfers.length === 0 ? (
          <Panel className="p-6">
            <EmptyState copy="Transfers you send will show up here." icon={Send} title="No transfers yet" />
          </Panel>
        ) : (
          <div className="grid gap-2">
            {transfers.map((transfer) => (
              <Panel className="flex items-center gap-4 p-4" key={transfer.id}>
                <div className={cn("grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10")}>
                  <Send className="size-4 text-[var(--ft-accent)]" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{transfer.recipientName}</div>
                  <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">
                    {formatNaira(transfer.sourceAmountMinor)} → {transfer.destinationCurrency}{" "}
                    {(transfer.destinationAmountMinor / 100).toLocaleString()}
                  </div>
                </div>
                <Badge tone={REMITTANCE_STATUS_TONE[transfer.status]}>
                  {transfer.status.toLowerCase()}
                </Badge>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
