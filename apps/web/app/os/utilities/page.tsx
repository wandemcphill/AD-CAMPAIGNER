"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Lightbulb, Sparkles, Tv, Zap } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  buyCable,
  buyElectricity,
  loadBillsOrders,
  loadCablePackages,
  validateMeter,
  verifyCable,
  CABLE_PROVIDERS,
  ELECTRIC_COMPANIES,
  type BillsOrder,
  type CablePackage,
  type MeterType,
  type MeterValidation
} from "./vtu-api";

const TABS = [
  { id: "electricity", label: "Electricity" },
  { id: "cable", label: "Cable TV" },
  { id: "history", label: "History" }
];

const QUICK_AMOUNTS_NAIRA = [1000, 2000, 5000, 10000, 20000, 50000];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function UtilitiesPage() {
  const [tab, setTab] = useState("electricity");

  // Electricity state
  const [disco, setDisco] = useState(ELECTRIC_COMPANIES[0]!.code);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState<MeterType>("PREPAID");
  const [amountNaira, setAmountNaira] = useState<number>(2000);
  const [elecPhone, setElecPhone] = useState("");
  const [validation, setValidation] = useState<MeterValidation>();
  const [validating, setValidating] = useState(false);

  // Cable state
  const [cableProvider, setCableProvider] = useState(CABLE_PROVIDERS[0]!.id);
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [cablePhone, setCablePhone] = useState("");
  const [packages, setPackages] = useState<CablePackage[]>([]);
  const [selectedPackageCode, setSelectedPackageCode] = useState<string>();
  const [cardValidation, setCardValidation] = useState<MeterValidation>();
  const [cardValidating, setCardValidating] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [orders, setOrders] = useState<BillsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<BillsOrder>();

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(await loadBillsOrders());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load order history.");
    }
  }, []);

  const refreshPackages = useCallback(async (provider: string) => {
    setLoadingPackages(true);
    try {
      setPackages(await loadCablePackages(provider));
    } catch {
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refreshOrders().finally(() => setLoading(false));
  }, [refreshOrders]);

  useEffect(() => {
    void refreshPackages(cableProvider);
    setSelectedPackageCode(undefined);
  }, [cableProvider, refreshPackages]);

  useEffect(() => {
    setValidation(undefined);
  }, [disco, meterNumber, meterType]);

  useEffect(() => {
    setCardValidation(undefined);
  }, [cableProvider, smartCardNumber]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.packageCode === selectedPackageCode),
    [packages, selectedPackageCode]
  );

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
      await refreshOrders();
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
      await refreshOrders();
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

  const SuccessPanel = success && (
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
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Utilities</h1>
        </div>

        <ErrorNotice message={error} />

        <div className="mt-4">
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        {tab === "electricity" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
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
                  <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                    Meter number
                  </label>
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
                  <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                    Phone number
                  </label>
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
                    !meterNumber.trim() ||
                    !elecPhone.trim() ||
                    amountNaira <= 0 ||
                    !validation?.valid ||
                    submitting
                  }
                  onClick={() => void submitElectricity()}
                >
                  <Sparkles className="size-4" />
                  {submitting ? "Processing..." : `Buy ₦${amountNaira.toLocaleString()} electricity`}
                </Button>
              </Panel>
            )}
          </motion.div>
        )}

        {tab === "cable" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
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
                      <div className="font-medium">
                        {cardValidation.customerName ?? "Smartcard verified"}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                    Phone number
                  </label>
                  <input
                    className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) => setCablePhone(e.target.value)}
                    placeholder="0803 000 0000"
                    value={cablePhone}
                  />
                </div>

                <div className="mt-4">
                  <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">
                    Select package
                  </h2>
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
                    !smartCardNumber.trim() ||
                    !cablePhone.trim() ||
                    !selectedPackage ||
                    !cardValidation?.valid ||
                    submitting
                  }
                  onClick={() => void submitCable()}
                >
                  <Sparkles className="size-4" />
                  {submitting ? "Processing..." : "Buy cable subscription"}
                </Button>
              </Panel>
            )}
          </motion.div>
        )}

        {tab === "history" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <h2 className="mb-3 font-semibold">Recent bill payments</h2>
              {loading ? (
                <LoadingBlock label="Loading history" />
              ) : orders.length === 0 ? (
                <EmptyState
                  copy="Electricity and cable purchases you make will show up here."
                  icon={Clock}
                  title="No purchases yet"
                />
              ) : (
                <div className="grid gap-2">
                  {orders.map((o) => (
                    <div
                      className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                      key={o.id}
                    >
                      <div className="grid size-9 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                        {o.productType === "CABLE" ? (
                          <Tv className="size-4 text-[var(--ft-accent)]" />
                        ) : (
                          <Zap className="size-4 text-[var(--ft-accent)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{formatNaira(o.amountMinor)}</div>
                        <div className="text-xs text-[var(--ft-text-muted)]">
                          {o.msisdnMasked} · {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge
                        tone={
                          o.status === "DELIVERED"
                            ? "success"
                            : o.status === "AMBIGUOUS" || o.status === "FAILED"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {o.status.toLowerCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </motion.div>
        )}
      </div>
    </div>
  );
}
