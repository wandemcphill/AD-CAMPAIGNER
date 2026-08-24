"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Sparkles, Tv } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel, cn } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  buyCable,
  loadCablePackages,
  verifyCable,
  CABLE_PROVIDERS,
  type BillsOrder,
  type CablePackage,
  type MeterValidation
} from "../vtu-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function CableTabPage() {
  const [cableProvider, setCableProvider] = useState(CABLE_PROVIDERS[0]!.id);
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [cablePhone, setCablePhone] = useState("");
  const [packages, setPackages] = useState<CablePackage[]>([]);
  const [selectedPackageCode, setSelectedPackageCode] = useState<string>();
  const [cardValidation, setCardValidation] = useState<MeterValidation>();
  const [cardValidating, setCardValidating] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<BillsOrder>();

  useEffect(() => {
    setLoadingPackages(true);
    loadCablePackages(cableProvider)
      .then(setPackages)
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
    setSelectedPackageCode(undefined);
  }, [cableProvider]);

  useEffect(() => {
    setCardValidation(undefined);
  }, [cableProvider, smartCardNumber]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.packageCode === selectedPackageCode),
    [packages, selectedPackageCode]
  );

  async function submitVerifyCard() {
    if (!smartCardNumber.trim()) return;
    setCardValidating(true);
    setError(undefined);
    setCardValidation(undefined);
    try {
      const result = await verifyCable({
        provider: cableProvider,
        smartCardNumber: smartCardNumber.trim()
      });
      setCardValidation(result);
      if (!result.valid) {
        setError("Smartcard verification failed. Check the smartcard/IUC number.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not verify this smartcard.");
    } finally {
      setCardValidating(false);
    }
  }

  async function submitCable() {
    if (!smartCardNumber.trim() || !cablePhone.trim() || !selectedPackage || !cardValidation?.valid)
      return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyCable({
        provider: cableProvider,
        smartCardNumber: smartCardNumber.trim(),
        packageCode: selectedPackage.packageCode,
        phoneNumber: cablePhone.trim()
      });
      setSuccess(order);
      setSmartCardNumber("");
      setCardValidation(undefined);
      setSelectedPackageCode(undefined);
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
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Provider</label>
          <select
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
            onChange={(e) => setCableProvider(e.target.value)}
            value={cableProvider}
          >
            {CABLE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
            Smartcard / IUC number
          </label>
          <div className="flex gap-2">
            <input
              className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setSmartCardNumber(e.target.value)}
              placeholder="1234567890"
              value={smartCardNumber}
            />
            <Button
              disabled={!smartCardNumber.trim() || cardValidating}
              onClick={() => void submitVerifyCard()}
              variant="secondary"
            >
              {cardValidating ? "Checking..." : "Verify"}
            </Button>
          </div>
          {cardValidation?.valid && (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
              <div className="font-medium">{cardValidation.customerName ?? "Smartcard verified"}</div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Phone number</label>
          <input
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setCablePhone(e.target.value)}
            placeholder="0803 000 0000"
            value={cablePhone}
          />
        </div>

        <div className="mt-4">
          <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">Select package</h2>
          {loadingPackages ? (
            <LoadingBlock label="Loading packages" />
          ) : packages.length === 0 ? (
            <EmptyState
              copy="No packages are currently available for this provider."
              icon={Tv}
              title="No packages available"
            />
          ) : (
            <div className="grid max-h-72 gap-2 overflow-y-auto">
              {packages.map((pkg) => (
                <button
                  className={cn(
                    "flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left transition",
                    selectedPackageCode === pkg.packageCode
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                      : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                  )}
                  key={pkg.id}
                  onClick={() => setSelectedPackageCode(pkg.packageCode)}
                  type="button"
                >
                  <div className="text-sm font-medium">{pkg.displayName}</div>
                  <div className="text-sm font-semibold">
                    {formatNaira(Math.ceil(pkg.costMinor * 1.02))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          className="mt-4 w-full justify-center"
          disabled={
            !smartCardNumber.trim() || !cablePhone.trim() || !selectedPackage || !cardValidation?.valid || submitting
          }
          onClick={() => void submitCable()}
        >
          <Sparkles className="size-4" />
          {submitting ? "Processing..." : "Buy cable subscription"}
        </Button>
      </Panel>
    </motion.div>
  );
}
