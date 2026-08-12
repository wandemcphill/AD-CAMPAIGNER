"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel, cn } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../campaigns/components";
import {
  buyElectricity,
  validateMeter,
  ELECTRIC_COMPANIES,
  type BillsOrder,
  type MeterType,
  type MeterValidation
} from "../vtu-api";

const QUICK_AMOUNTS_NAIRA = [1000, 2000, 5000, 10000, 20000, 50000];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function ElectricityTabPage() {
  const [disco, setDisco] = useState(ELECTRIC_COMPANIES[0]!.code);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState<MeterType>("PREPAID");
  const [amountNaira, setAmountNaira] = useState<number>(2000);
  const [elecPhone, setElecPhone] = useState("");
  const [validation, setValidation] = useState<MeterValidation>();
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<BillsOrder>();

  async function submitValidate() {
    if (!meterNumber.trim()) return;
    setValidating(true);
    setError(undefined);
    setValidation(undefined);
    try {
      const result = await validateMeter({ disco, meterNumber: meterNumber.trim(), meterType });
      setValidation(result);
      if (!result.valid) {
        setError("Meter validation failed. Check the meter number and DISCO.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not validate this meter.");
    } finally {
      setValidating(false);
    }
  }

  async function submitElectricity() {
    if (!meterNumber.trim() || !elecPhone.trim() || amountNaira <= 0 || !validation?.valid) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyElectricity({
        disco,
        meterNumber: meterNumber.trim(),
        meterType,
        amountMinor: Math.round(amountNaira * 100),
        phoneNumber: elecPhone.trim()
      });
      setSuccess(order);
      setMeterNumber("");
      setValidation(undefined);
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
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
            Distribution company
          </label>
          <select
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
            onChange={(e) => setDisco(e.target.value)}
            value={disco}
          >
            {ELECTRIC_COMPANIES.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["PREPAID", "POSTPAID"] as MeterType[]).map((t) => (
            <button
              className={cn(
                "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                meterType === t
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                  : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
              )}
              key={t}
              onClick={() => setMeterType(t)}
              type="button"
            >
              {t === "PREPAID" ? "Prepaid" : "Postpaid"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Meter number</label>
          <div className="flex gap-2">
            <input
              className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setMeterNumber(e.target.value)}
              placeholder="1234567890"
              value={meterNumber}
            />
            <Button
              disabled={!meterNumber.trim() || validating}
              onClick={() => void submitValidate()}
              variant="secondary"
            >
              {validating ? "Checking..." : "Verify"}
            </Button>
          </div>
          {validation?.valid && (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
              <div className="font-medium">{validation.customerName ?? "Meter verified"}</div>
              {validation.address && (
                <div className="text-xs text-[var(--ft-text-muted)]">{validation.address}</div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Phone number</label>
          <input
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setElecPhone(e.target.value)}
            placeholder="0803 000 0000"
            value={elecPhone}
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
            min={500}
            onChange={(e) => setAmountNaira(Number(e.target.value))}
            placeholder="Custom amount (₦)"
            type="number"
            value={amountNaira}
          />
        </div>

        <Button
          className="mt-4 w-full justify-center"
          disabled={
            !meterNumber.trim() || !elecPhone.trim() || amountNaira <= 0 || !validation?.valid || submitting
          }
          onClick={() => void submitElectricity()}
        >
          <Sparkles className="size-4" />
          {submitting ? "Processing..." : `Buy ₦${amountNaira.toLocaleString()} electricity`}
        </Button>
      </Panel>
    </motion.div>
  );
}
