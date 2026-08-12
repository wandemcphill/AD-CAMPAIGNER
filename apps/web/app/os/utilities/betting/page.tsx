"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel, cn } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../campaigns/components";
import {
  buyBetFunding,
  loadBettingCompanies,
  verifyBetting,
  type BettingCompany,
  type BillsOrder,
  type MeterValidation
} from "../vtu-api";

const QUICK_AMOUNTS_NAIRA = [1000, 2000, 5000, 10000, 20000, 50000];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function BettingTabPage() {
  const [bettingCompanies, setBettingCompanies] = useState<BettingCompany[]>([]);
  const [bettingCompany, setBettingCompany] = useState<string>();
  const [customerId, setCustomerId] = useState("");
  const [betAmountNaira, setBetAmountNaira] = useState<number>(1000);
  const [betValidation, setBetValidation] = useState<MeterValidation>();
  const [betValidating, setBetValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<BillsOrder>();

  useEffect(() => {
    void loadBettingCompanies()
      .then((companies) => {
        setBettingCompanies(companies);
        setBettingCompany((prev) => prev ?? companies[0]?.code);
      })
      .catch(() => setBettingCompanies([]));
  }, []);

  useEffect(() => {
    setBetValidation(undefined);
  }, [bettingCompany, customerId]);

  async function submitVerifyBetting() {
    if (!bettingCompany || !customerId.trim()) return;
    setBetValidating(true);
    setError(undefined);
    setBetValidation(undefined);
    try {
      const result = await verifyBetting({ bettingCompany, customerId: customerId.trim() });
      setBetValidation(result);
      if (!result.valid) {
        setError("Betting account verification failed. Check the customer ID.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not verify this account.");
    } finally {
      setBetValidating(false);
    }
  }

  async function submitBetFunding() {
    if (!bettingCompany || !customerId.trim() || betAmountNaira <= 0 || !betValidation?.valid) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyBetFunding({
        bettingCompany,
        customerId: customerId.trim(),
        amountMinor: Math.round(betAmountNaira * 100)
      });
      setSuccess(order);
      setCustomerId("");
      setBetValidation(undefined);
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

  if (success) {
    return (
      <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
        <Panel className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-[var(--ft-green)]" />
          <h2 className="mt-3 text-lg font-semibold">
            {success.status === "DELIVERED" ? "Delivered" : "Order submitted"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            {formatNaira(success.amountMinor)} charged to {success.msisdnMasked}.
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
      <Panel className="p-5">
        <div>
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Betting platform</label>
          <select
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
            onChange={(e) => setBettingCompany(e.target.value)}
            value={bettingCompany ?? ""}
          >
            {bettingCompanies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Customer ID</label>
          <div className="flex gap-2">
            <input
              className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="57025731"
              value={customerId}
            />
            <Button
              disabled={!customerId.trim() || betValidating}
              onClick={() => void submitVerifyBetting()}
              variant="secondary"
            >
              {betValidating ? "Checking..." : "Verify"}
            </Button>
          </div>
          {betValidation?.valid && (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
              <div className="font-medium">{betValidation.customerName ?? "Account verified"}</div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Amount</label>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS_NAIRA.map((amt) => (
              <button
                className={cn(
                  "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                  betAmountNaira === amt
                    ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                    : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                )}
                key={amt}
                onClick={() => setBetAmountNaira(amt)}
                type="button"
              >
                ₦{amt.toLocaleString()}
              </button>
            ))}
          </div>
          <input
            className="mt-2 h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            min={100}
            onChange={(e) => setBetAmountNaira(Number(e.target.value))}
            placeholder="Custom amount (₦)"
            type="number"
            value={betAmountNaira}
          />
        </div>

        <Button
          className="mt-4 w-full justify-center"
          disabled={!bettingCompany || !customerId.trim() || betAmountNaira <= 0 || !betValidation?.valid || submitting}
          onClick={() => void submitBetFunding()}
        >
          <Sparkles className="size-4" />
          {submitting ? "Processing..." : `Fund ₦${betAmountNaira.toLocaleString()}`}
        </Button>
      </Panel>
    </motion.div>
  );
}
