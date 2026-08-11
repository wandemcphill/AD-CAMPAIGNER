"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Globe2, Smartphone, Sparkles, Wifi } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import {
  buyTelecomAirtime,
  buyTelecomData,
  checkTelecomOrderStatus,
  detectNumber,
  listProducts,
  loadTelecomOrders,
  type DetectedNumber,
  type TelecomAirtimeProduct,
  type TelecomDataBundle,
  type TelecomOrder
} from "./api";

const TERMINAL_ORDER_STATUSES = new Set(["DELIVERED", "FAILED", "REVERSED", "REFUNDED"]);

const TABS = [
  { id: "buy", label: "Buy" },
  { id: "history", label: "History" }
];

function formatMinor(amountMinor: number, currency: string) {
  return `${(amountMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export default function TelecomGatewayPage() {
  const [tab, setTab] = useState("buy");
  const [phone, setPhone] = useState("");
  const [detected, setDetected] = useState<DetectedNumber>();
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>();
  const [airtimeProducts, setAirtimeProducts] = useState<TelecomAirtimeProduct[]>([]);
  const [dataBundles, setDataBundles] = useState<TelecomDataBundle[]>([]);
  const [mode, setMode] = useState<"airtime" | "data">("airtime");
  const [amountInput, setAmountInput] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState<string>();

  const [orders, setOrders] = useState<TelecomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [success, setSuccess] = useState<TelecomOrder>();
  const [checkingOrderId, setCheckingOrderId] = useState<string>();

  const refreshOrders = useCallback(async () => {
    setForbidden(false);
    try {
      setOrders(await loadTelecomOrders());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load order history.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  async function checkOrderStatus(orderId: string) {
    setCheckingOrderId(orderId);
    try {
      const updated = await checkTelecomOrderStatus(orderId);
      setOrders((current) => current.map((order) => (order.id === orderId ? updated : order)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check this order's status.");
    } finally {
      setCheckingOrderId(undefined);
    }
  }

  const selectedOperator = useMemo(
    () => detected?.operators.find((op) => op.operatorId === selectedOperatorId),
    [detected, selectedOperatorId]
  );

  const selectedBundle = useMemo(
    () => dataBundles.find((b) => b.bundleId === selectedBundleId),
    [dataBundles, selectedBundleId]
  );

  async function submitDetect() {
    if (!phone.trim()) return;
    setDetecting(true);
    setError(undefined);
    setDetected(undefined);
    setSelectedOperatorId(undefined);
    setAirtimeProducts([]);
    setDataBundles([]);
    try {
      const result = await detectNumber(phone.trim());
      setDetected(result);
      const first = result.operators[0];
      if (first) void selectOperator(first.operatorId, result.countryIso);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not detect the country or operator for this number.");
    } finally {
      setDetecting(false);
    }
  }

  async function selectOperator(operatorId: string, countryIso: string) {
    setSelectedOperatorId(operatorId);
    setSelectedBundleId(undefined);
    try {
      const products = await listProducts(countryIso, operatorId);
      setAirtimeProducts(products.airtime);
      setDataBundles(products.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load products for this operator.");
    }
  }

  const airtimeProduct = airtimeProducts[0];

  async function submitAirtime() {
    if (!detected || !selectedOperatorId || !airtimeProduct) return;
    const amountMinor = Math.round(Number(amountInput) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyTelecomAirtime({
        phoneNumber: detected.msisdn,
        operatorId: selectedOperatorId,
        amountMinor
      });
      setSuccess(order);
      setPhone("");
      setDetected(undefined);
      setAmountInput("");
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
    if (!detected || !selectedOperatorId || !selectedBundle) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyTelecomData({
        phoneNumber: detected.msisdn,
        operatorId: selectedOperatorId,
        bundleId: selectedBundle.bundleId
      });
      setSuccess(order);
      setPhone("");
      setDetected(undefined);
      setSelectedBundleId(undefined);
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
        {formatMinor(success.amountMinor, success.currency)} charged for {success.countryIso} →{" "}
        {success.msisdnMasked}.
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
        You do not have permission to view telecom for this workspace. Contact your workspace
        owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Globe2 className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">International Airtime &amp; Data</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
          Top up any phone number worldwide — the country and operator are detected automatically.
        </p>

        <ErrorNotice message={error} />

        <div className="mt-4">
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        {tab === "buy" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
              <Panel className="p-5">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                  Phone number (with country code)
                </label>
                <div className="flex gap-2">
                  <input
                    className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 7700 900000"
                    value={phone}
                  />
                  <Button disabled={!phone.trim() || detecting} onClick={() => void submitDetect()}>
                    {detecting ? "Detecting..." : "Detect"}
                  </Button>
                </div>

                {detected && (
                  <div className="mt-4 border-t border-[var(--ft-border)] pt-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
                      <Smartphone className="size-4 text-[var(--ft-accent)]" />
                      {detected.countryIso} · via {detected.provider}
                    </div>

                    {detected.operators.length === 0 ? (
                      <EmptyState
                        copy="No operators are currently supported for this country."
                        icon={Globe2}
                        title="No operators available"
                      />
                    ) : (
                      <>
                        <h2 className="mb-2 mt-4 text-sm font-medium text-[var(--ft-text-muted)]">
                          Operator
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                          {detected.operators.map((op) => (
                            <button
                              className={cn(
                                "rounded-[var(--radius-md)] border p-3 text-left text-sm transition",
                                selectedOperatorId === op.operatorId
                                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                                  : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                              )}
                              key={op.operatorId}
                              onClick={() => void selectOperator(op.operatorId, detected.countryIso)}
                              type="button"
                            >
                              {op.name}
                            </button>
                          ))}
                        </div>

                        {selectedOperator && (
                          <div className="mt-4">
                            <div className="flex gap-2">
                              {selectedOperator.supportsAirtime && (
                                <button
                                  className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium transition",
                                    mode === "airtime"
                                      ? "bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                                      : "border border-[var(--ft-border)] text-[var(--ft-text-secondary)]"
                                  )}
                                  onClick={() => setMode("airtime")}
                                  type="button"
                                >
                                  Airtime
                                </button>
                              )}
                              {selectedOperator.supportsData && (
                                <button
                                  className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium transition",
                                    mode === "data"
                                      ? "bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                                      : "border border-[var(--ft-border)] text-[var(--ft-text-secondary)]"
                                  )}
                                  onClick={() => setMode("data")}
                                  type="button"
                                >
                                  Data
                                </button>
                              )}
                            </div>

                            {mode === "airtime" && airtimeProduct && (
                              <div className="mt-4">
                                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                                  Amount ({airtimeProduct.currency})
                                </label>
                                <input
                                  className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                                  min={airtimeProduct.minAmountMinor / 100}
                                  max={airtimeProduct.maxAmountMinor / 100}
                                  onChange={(e) => setAmountInput(e.target.value)}
                                  placeholder={`${airtimeProduct.minAmountMinor / 100} - ${airtimeProduct.maxAmountMinor / 100}`}
                                  type="number"
                                  value={amountInput}
                                />
                                <Button
                                  className="mt-4 w-full justify-center"
                                  disabled={!amountInput || submitting}
                                  onClick={() => void submitAirtime()}
                                >
                                  <Sparkles className="size-4" />
                                  {submitting ? "Processing..." : "Buy airtime"}
                                </Button>
                              </div>
                            )}

                            {mode === "data" && (
                              <div className="mt-4">
                                {dataBundles.length === 0 ? (
                                  <EmptyState
                                    copy="No data bundles are currently available for this operator."
                                    icon={Wifi}
                                    title="No bundles available"
                                  />
                                ) : (
                                  <div className="grid gap-2">
                                    {dataBundles.map((b) => (
                                      <button
                                        className={cn(
                                          "flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left transition",
                                          selectedBundleId === b.bundleId
                                            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                                            : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                                        )}
                                        key={b.bundleId}
                                        onClick={() => setSelectedBundleId(b.bundleId)}
                                        type="button"
                                      >
                                        <div>
                                          <div className="text-sm font-medium">{b.displayName}</div>
                                          <div className="text-xs text-[var(--ft-text-muted)]">
                                            {b.validityDays} days
                                          </div>
                                        </div>
                                        <div className="text-sm font-semibold">
                                          {formatMinor(b.costMinor, b.currency)}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <Button
                                  className="mt-4 w-full justify-center"
                                  disabled={!selectedBundle || submitting}
                                  onClick={() => void submitData()}
                                >
                                  <Sparkles className="size-4" />
                                  {submitting ? "Processing..." : "Buy data bundle"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Panel>
            )}
          </motion.div>
        )}

        {tab === "history" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <h2 className="mb-3 font-semibold">Recent orders</h2>
              {loading ? (
                <LoadingBlock label="Loading history" />
              ) : orders.length === 0 ? (
                <EmptyState
                  copy="International top-ups you make will show up here."
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
                          {formatMinor(o.amountMinor, o.currency)} · {o.countryIso}
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
                      {!TERMINAL_ORDER_STATUSES.has(o.status) ? (
                        <Button
                          className="h-8 px-2 text-xs"
                          disabled={checkingOrderId !== undefined}
                          onClick={() => void checkOrderStatus(o.id)}
                          variant="secondary"
                        >
                          {checkingOrderId === o.id ? "Checking..." : "Check status"}
                        </Button>
                      ) : null}
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
