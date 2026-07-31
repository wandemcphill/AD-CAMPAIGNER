"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Signal, Smartphone, Sparkles, Wifi } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  buyAirtime,
  buyData,
  loadDataPlans,
  loadVtuOrders,
  type VtuDataPlan,
  type VtuNetwork,
  type VtuOrder
} from "./vtu-api";

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
  const [success, setSuccess] = useState<VtuOrder>();

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(await loadVtuOrders());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load order history.");
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
        )}

        {tab === "data" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            {success ? (
              SuccessPanel
            ) : (
              <Panel className="p-5">
                {NetworkPicker}
                {PhoneInput}

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

                <Button
                  className="mt-4 w-full justify-center"
                  disabled={!phone.trim() || !selectedPlan || submitting}
                  onClick={() => void submitData()}
                >
                  <Sparkles className="size-4" />
                  {submitting ? "Processing..." : "Buy data plan"}
                </Button>
              </Panel>
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
