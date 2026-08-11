"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Signal, Smartphone, Sparkles, Wifi } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import {
  buyAirtime,
  buyAirtimeEpin,
  buyData,
  buyDataEpin,
  getAirtimeQuote,
  loadDataPlans,
  loadVtuOrders,
  type VtuDataPlan,
  type VtuEpin,
  type VtuNetwork,
  type VtuOrder,
  type VtuQuote
} from "./vtu-api";

const EPIN_VALUES_NAIRA = [100, 200, 500];

const TABS = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "history", label: "History" }
];

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

function maskedOrMsisdn(v: string) {
  return v;
}

export default function AirtimeDataPage() {
  const [tab, setTab] = useState("airtime");
  const [network, setNetwork] = useState<VtuNetwork>("MTN");
  const [phone, setPhone] = useState("");
  const [amountNaira, setAmountNaira] = useState<number>(500);

  const [dataPlans, setDataPlans] = useState<VtuDataPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>();

  const [orders, setOrders] = useState<VtuOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [success, setSuccess] = useState<VtuOrder>();

  const [quote, setQuote] = useState<VtuQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [epinMode, setEpinMode] = useState(false);
  const [epinValueNaira, setEpinValueNaira] = useState(EPIN_VALUES_NAIRA[0]!);
  const [epinQuantity, setEpinQuantity] = useState(1);
  const [epinResult, setEpinResult] = useState<VtuEpin[]>();
  const [epinError, setEpinError] = useState<string>();
  const [epinSubmitting, setEpinSubmitting] = useState(false);

  const [dataEpinMode, setDataEpinMode] = useState(false);
  const [dataEpinQuantity, setDataEpinQuantity] = useState(1);
  const [dataEpinResult, setDataEpinResult] = useState<VtuEpin[]>();
  const [dataEpinError, setDataEpinError] = useState<string>();
  const [dataEpinSubmitting, setDataEpinSubmitting] = useState(false);

  const refreshOrders = useCallback(async () => {
    setForbidden(false);
    try {
      setOrders(await loadVtuOrders());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load order history.");
      setForbidden(isForbiddenError(caught));
    }
  }, []);

  const refreshPlans = useCallback(async (net: VtuNetwork) => {
    try {
      setDataPlans(await loadDataPlans(net));
    } catch {
      setDataPlans([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void Promise.all([refreshOrders(), refreshPlans(network)]).finally(() => setLoading(false));
    // Deep-link support for the "Data" nav item (?tab=data) — read once on mount via
    // window.location instead of useSearchParams to avoid the Suspense-boundary
    // requirement that hook carries in the App Router.
    if (new URLSearchParams(window.location.search).get("tab") === "data") {
      setTab("data");
    }
    // Intentionally run once on mount; the second effect below reacts to network changes.
  }, []);

  useEffect(() => {
    void refreshPlans(network);
    setSelectedPlanId(undefined);
  }, [network, refreshPlans]);

  useEffect(() => {
    if (tab !== "airtime" || epinMode || amountNaira <= 0) {
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
  }, [tab, epinMode, network, amountNaira]);

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
      await refreshOrders();
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

  const selectedPlan = useMemo(
    () => dataPlans.find((p) => p.id === selectedPlanId),
    [dataPlans, selectedPlanId]
  );

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

  async function submitData() {
    if (!phone.trim() || !selectedPlan) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyData({
        network,
        msisdn: phone.trim(),
        providerPlanId: selectedPlan.providerPlanId
      });
      setSuccess(order);
      setPhone("");
      setSelectedPlanId(undefined);
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

  async function submitDataEpin() {
    if (!selectedPlan) return;
    setDataEpinSubmitting(true);
    setDataEpinError(undefined);
    setDataEpinResult(undefined);
    try {
      const result = await buyDataEpin({
        network,
        providerPlanId: selectedPlan.providerPlanId,
        quantity: dataEpinQuantity
      });
      setDataEpinResult(result.epins);
      await refreshOrders();
    } catch (caught) {
      setDataEpinError(
        caught instanceof Error
          ? caught.message
          : "We could not complete this purchase. No wallet balance has moved."
      );
    } finally {
      setDataEpinSubmitting(false);
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

  const PhoneInput = (
    <div className="mt-4">
      <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Phone number</label>
      <input
        className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
        onChange={(e) => setPhone(e.target.value)}
        placeholder="0803 000 0000"
        value={phone}
      />
    </div>
  );

  const SuccessPanel = success && (
    <Panel className="p-6 text-center">
      <CheckCircle2 className="mx-auto size-10 text-[var(--ft-green)]" />
      <h2 className="mt-3 text-lg font-semibold">
        {success.status === "DELIVERED" ? "Delivered" : "Order submitted"}
      </h2>
      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
        {formatNaira(success.amountMinor)} charged for {success.network} → {maskedOrMsisdn(success.msisdnMasked)}.
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

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view airtime and data for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Airtime & Data</h1>
        </div>

        <ErrorNotice message={error} />

        <div className="mt-4">
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        {tab === "airtime" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
              <>
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
                      <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                        Voucher value
                      </label>
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
                      <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                        Quantity (1-100)
                      </label>
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

                    {epinError ? (
                      <div className="mt-3 text-sm text-[var(--ft-red)]">{epinError}</div>
                    ) : null}

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
                    {PhoneInput}

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
              </>
            )}
          </motion.div>
        )}

        {tab === "data" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
              <>
                <label className="mb-3 flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
                  <input
                    checked={dataEpinMode}
                    className="size-4 accent-[var(--ft-accent)]"
                    onChange={(e) => setDataEpinMode(e.target.checked)}
                    type="checkbox"
                  />
                  Buy as E-PIN vouchers instead of direct top-up
                </label>

                <Panel className="p-5">
                  {NetworkPicker}
                  {!dataEpinMode ? PhoneInput : null}

                  <div className="mt-4">
                    <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">
                      Select data plan
                    </h2>
                    {loading ? (
                      <LoadingBlock label="Loading plans" />
                    ) : dataPlans.length === 0 ? (
                      <EmptyState
                        copy="No data plans are currently available for this network."
                        icon={Wifi}
                        title="No plans available"
                      />
                    ) : (
                      <div className="grid gap-2">
                        {dataPlans.map((plan) => (
                          <button
                            className={cn(
                              "flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left transition",
                              selectedPlanId === plan.id
                                ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                                : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                            )}
                            key={plan.id}
                            onClick={() => setSelectedPlanId(plan.id)}
                            type="button"
                          >
                            <div>
                              <div className="text-sm font-medium">{plan.displayName}</div>
                              <div className="text-xs text-[var(--ft-text-muted)]">
                                {plan.validityDays} days
                              </div>
                            </div>
                            <div className="text-sm font-semibold">
                              {formatNaira(Math.ceil(plan.costMinor * 1.02))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {dataEpinMode ? (
                    <>
                      <div className="mt-4">
                        <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                          Quantity (1-100)
                        </label>
                        <input
                          className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                          max={100}
                          min={1}
                          onChange={(e) =>
                            setDataEpinQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                          }
                          type="number"
                          value={dataEpinQuantity}
                        />
                      </div>

                      {dataEpinError ? (
                        <div className="mt-3 text-sm text-[var(--ft-red)]">{dataEpinError}</div>
                      ) : null}

                      <Button
                        className="mt-4 w-full justify-center"
                        disabled={!selectedPlan || dataEpinSubmitting}
                        onClick={() => void submitDataEpin()}
                      >
                        <Sparkles className="size-4" />
                        {dataEpinSubmitting ? "Processing..." : "Buy data vouchers"}
                      </Button>

                      {dataEpinResult ? (
                        <div className="mt-4 grid gap-2">
                          <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                            {dataEpinResult.length} voucher{dataEpinResult.length === 1 ? "" : "s"} issued
                          </div>
                          {dataEpinResult.map((pin, index) => (
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
                    </>
                  ) : (
                    <Button
                      className="mt-4 w-full justify-center"
                      disabled={!phone.trim() || !selectedPlan || submitting}
                      onClick={() => void submitData()}
                    >
                      <Sparkles className="size-4" />
                      {submitting ? "Processing..." : "Buy data plan"}
                    </Button>
                  )}
                </Panel>
              </>
            )}
          </motion.div>
        )}

        {tab === "history" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <h2 className="mb-3 font-semibold">Recent VTU orders</h2>
              {loading ? (
                <LoadingBlock label="Loading history" />
              ) : orders.length === 0 ? (
                <EmptyState
                  copy="Airtime & data purchases you make will show up here."
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
                        {o.productType === "AIRTIME" ? (
                          <Smartphone className="size-4 text-[var(--ft-accent)]" />
                        ) : (
                          <Wifi className="size-4 text-[var(--ft-accent)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {formatNaira(o.amountMinor)} · {o.network}
                        </div>
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
