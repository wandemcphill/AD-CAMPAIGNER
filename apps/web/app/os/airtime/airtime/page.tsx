"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Signal, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel, cn } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../campaigns/components";
import {
  buyAirtime,
  buyAirtimeEpin,
  getAirtimeQuote,
  type VtuEpin,
  type VtuNetwork,
  type VtuOrder,
  type VtuQuote
} from "../vtu-api";

const EPIN_VALUES_NAIRA = [100, 200, 500];

const NETWORKS: { id: VtuNetwork; label: string }[] = [
  { id: "MTN", label: "MTN" },
  { id: "AIRTEL", label: "Airtel" },
  { id: "GLO", label: "Glo" },
  { id: "NINE_MOBILE", label: "9mobile" }
];

const QUICK_AMOUNTS_NAIRA = [100, 200, 500, 1000, 2000, 5000];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AirtimeTabPage() {
  const [network, setNetwork] = useState<VtuNetwork>("MTN");
  const [phone, setPhone] = useState("");
  const [amountNaira, setAmountNaira] = useState<number>(500);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<VtuOrder>();

  const [quote, setQuote] = useState<VtuQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [epinMode, setEpinMode] = useState(false);
  const [epinValueNaira, setEpinValueNaira] = useState(EPIN_VALUES_NAIRA[0]!);
  const [epinQuantity, setEpinQuantity] = useState(1);
  const [epinResult, setEpinResult] = useState<VtuEpin[]>();
  const [epinError, setEpinError] = useState<string>();
  const [epinSubmitting, setEpinSubmitting] = useState(false);

  useEffect(() => {
    if (epinMode || amountNaira <= 0) {
      setQuote(undefined);
      return;
    }
    const handle = setTimeout(() => {
      setQuoteLoading(true);
      void getAirtimeQuote(network, Math.round(amountNaira * 100))
        .then(setQuote)
        .catch(() => setQuote(undefined))
        .finally(() => setQuoteLoading(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [epinMode, network, amountNaira]);

  async function submitAirtimeEpin() {
    setEpinSubmitting(true);
    setEpinError(undefined);
    setEpinResult(undefined);
    try {
      const result = await buyAirtimeEpin({
        network,
        valueMinor: epinValueNaira * 100,
        quantity: epinQuantity
      });
      setEpinResult(result.epins);
    } catch (caught) {
      setEpinError(
        caught instanceof Error
          ? caught.message
          : "We could not complete this purchase. No wallet balance has moved."
      );
    } finally {
      setEpinSubmitting(false);
    }
  }

  async function submitAirtime() {
    if (!phone.trim() || amountNaira <= 0) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyAirtime({
        network,
        msisdn: phone.trim(),
        faceValueMinor: Math.round(amountNaira * 100)
      });
      setSuccess(order);
      setPhone("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not complete this purchase. No wallet balance has moved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const NetworkPicker = (
    <div>
      <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">Select network</h2>
      <div className="grid grid-cols-4 gap-2">
        {NETWORKS.map((n) => (
          <button
            className={cn(
              "flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border p-4 transition",
              network === n.id
                ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
            )}
            key={n.id}
            onClick={() => setNetwork(n.id)}
            type="button"
          >
            <Signal className="size-5 text-[var(--ft-accent)]" />
            <span className="text-xs font-medium">{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (success) {
    return (
      <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
        <Panel className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-[var(--ft-green)]" />
          <h2 className="mt-3 text-lg font-semibold">
            {success.status === "DELIVERED" ? "Delivered" : "Order submitted"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            {formatNaira(success.amountMinor)} charged for {success.network} → {success.msisdnMasked}.
          </p>
          {success.status === "AMBIGUOUS" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-left text-xs leading-5 text-[var(--ft-text-secondary)]">
              Delivery could not be confirmed immediately. Our ops team is reviewing this order — you
              won&apos;t be double-charged either way.
            </div>
          )}
          <Button className="mt-4" onClick={() => setSuccess(undefined)} variant="secondary">
            Buy another
          </Button>
        </Panel>
      </motion.div>
    );
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <ErrorNotice message={error} />

      <div className="mb-3 flex rounded-[var(--radius-lg)] border border-[var(--ft-border)] p-1">
        <button
          className={cn(
            "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-medium transition",
            !epinMode ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]"
          )}
          onClick={() => setEpinMode(false)}
          type="button"
        >
          Top up a number
        </button>
        <button
          className={cn(
            "flex-1 rounded-[var(--radius-md)] py-2 text-sm font-medium transition",
            epinMode ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "text-[var(--ft-text-muted)]"
          )}
          onClick={() => setEpinMode(true)}
          type="button"
        >
          Buy E-PIN vouchers
        </button>
      </div>

      {epinMode ? (
        <Panel className="p-5">
          {NetworkPicker}

          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Voucher value</label>
            <div className="grid grid-cols-3 gap-2">
              {EPIN_VALUES_NAIRA.map((val) => (
                <button
                  className={cn(
                    "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                    epinValueNaira === val
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                      : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                  )}
                  key={val}
                  onClick={() => setEpinValueNaira(val)}
                  type="button"
                >
                  ₦{val}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Quantity (1-100)</label>
            <input
              className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              max={100}
              min={1}
              onChange={(e) => setEpinQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
              type="number"
              value={epinQuantity}
            />
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]">
            Total: {formatNaira(epinValueNaira * epinQuantity * 100)}
          </div>

          {epinError ? <div className="mt-3 text-sm text-[var(--ft-red)]">{epinError}</div> : null}

          <Button
            className="mt-4 w-full justify-center"
            disabled={epinSubmitting}
            onClick={() => void submitAirtimeEpin()}
          >
            <Sparkles className="size-4" />
            {epinSubmitting ? "Processing..." : "Buy vouchers"}
          </Button>

          {epinResult ? (
            <div className="mt-4 grid gap-2">
              <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                {epinResult.length} voucher{epinResult.length === 1 ? "" : "s"} issued
              </div>
              {epinResult.map((pin, index) => (
                <div
                  className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 font-mono text-sm"
                  key={`${pin.serialNumber}-${index}`}
                >
                  <div>PIN: {pin.pin}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    Serial: {pin.serialNumber}
                    {pin.batchNo ? ` · Batch: ${pin.batchNo}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel className="p-5">
          {NetworkPicker}

          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Phone number</label>
            <input
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 000 0000"
              value={phone}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Amount</label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS_NAIRA.map((amt) => (
                <button
                  className={cn(
                    "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                    amountNaira === amt
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                      : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                  )}
                  key={amt}
                  onClick={() => setAmountNaira(amt)}
                  type="button"
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              className="mt-2 h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              min={50}
              onChange={(e) => setAmountNaira(Number(e.target.value))}
              placeholder="Custom amount (₦)"
              type="number"
              value={amountNaira}
            />
            {quoteLoading ? (
              <div className="mt-2 text-xs text-[var(--ft-text-muted)]">Checking price...</div>
            ) : quote ? (
              <div className="mt-2 text-xs text-[var(--ft-text-secondary)]">
                You&apos;ll pay {formatNaira(quote.customerPriceMinor)} via {quote.providerName}
              </div>
            ) : null}
          </div>

          <Button
            className="mt-4 w-full justify-center"
            disabled={!phone.trim() || amountNaira <= 0 || submitting}
            onClick={() => void submitAirtime()}
          >
            <Sparkles className="size-4" />
            {submitting ? "Processing..." : `Buy ₦${amountNaira.toLocaleString()} airtime`}
          </Button>
        </Panel>
      )}
    </motion.div>
  );
}
