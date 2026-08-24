"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Signal, Sparkles, Wifi } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel, cn } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  buyData,
  buyDataEpin,
  loadDataPlans,
  type VtuDataPlan,
  type VtuEpin,
  type VtuNetwork,
  type VtuOrder
} from "../vtu-api";

const NETWORKS: { id: VtuNetwork; label: string }[] = [
  { id: "MTN", label: "MTN" },
  { id: "AIRTEL", label: "Airtel" },
  { id: "GLO", label: "Glo" },
  { id: "NINE_MOBILE", label: "9mobile" }
];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function DataTabPage() {
  const [network, setNetwork] = useState<VtuNetwork>("MTN");
  const [phone, setPhone] = useState("");
  const [dataPlans, setDataPlans] = useState<VtuDataPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [plansLoading, setPlansLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<VtuOrder>();

  const [dataEpinMode, setDataEpinMode] = useState(false);
  const [dataEpinQuantity, setDataEpinQuantity] = useState(1);
  const [dataEpinResult, setDataEpinResult] = useState<VtuEpin[]>();
  const [dataEpinError, setDataEpinError] = useState<string>();
  const [dataEpinSubmitting, setDataEpinSubmitting] = useState(false);

  const refreshPlans = useCallback(async (net: VtuNetwork) => {
    setPlansLoading(true);
    try {
      setDataPlans(await loadDataPlans(net));
    } catch {
      setDataPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlans(network);
    setSelectedPlanId(undefined);
  }, [network, refreshPlans]);

  const selectedPlan = useMemo(
    () => dataPlans.find((p) => p.id === selectedPlanId),
    [dataPlans, selectedPlanId]
  );

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
          <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">Select data plan</h2>
          {plansLoading ? (
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
                    <div className="text-xs text-[var(--ft-text-muted)]">{plan.validityDays} days</div>
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
              <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Quantity (1-100)</label>
              <input
                className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                max={100}
                min={1}
                onChange={(e) => setDataEpinQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                type="number"
                value={dataEpinQuantity}
              />
            </div>

            {dataEpinError ? <div className="mt-3 text-sm text-[var(--ft-red)]">{dataEpinError}</div> : null}

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
    </motion.div>
  );
}
