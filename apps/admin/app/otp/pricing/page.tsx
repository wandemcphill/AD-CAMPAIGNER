"use client";

import { BadgeDollarSign, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { setOtpPricingRule } from "../api";
import { AdminOtpShell, AdminPageHeader, EmptyState } from "../components";
import type { AdminOtpPricingRule } from "../data";
import { useAdminOtpDashboard } from "../use-admin-otp-dashboard";

const defaultRule: AdminOtpPricingRule = {
  tier: "BUDGET",
  markupBps: 5500,
  minimumMarginMinor: 15000,
  platformFeeMinor: 5000,
  customerCurrency: "NGN",
  usdToNgnRate: 1600
};

function percentFromBps(value: number) {
  return `${(value / 100).toFixed(1)}%`;
}

function moneyMinor(value: number, currency: string) {
  return `${currency} ${(value / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0
  })}`;
}

export default function AdminOtpPricingPage() {
  const { data, error, isLoading, refresh } = useAdminOtpDashboard();
  const [selectedTier, setSelectedTier] = useState<AdminOtpPricingRule["tier"]>("BUDGET");
  const selectedRule = useMemo(
    () => data?.pricingRules.find((rule) => rule.tier === selectedTier) ?? defaultRule,
    [data?.pricingRules, selectedTier]
  );
  const [form, setForm] = useState<AdminOtpPricingRule>(selectedRule);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({ ...selectedRule, tier: selectedTier });
  }, [selectedRule, selectedTier]);

  const saveRule = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await setOtpPricingRule(form);
      await refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Unable to update OTP pricing.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminOtpShell active="/otp/pricing">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Margin rules</Badge>}
        title="Pricing"
        action={
          <Button disabled={isSaving || isLoading} onClick={() => void saveRule()}>
            <Save className="size-4" /> Save rule
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Panel className="p-4">
          <BadgeDollarSign className="size-5 text-[var(--ft-text-primary)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
            Global guardrails
          </h2>
          {error || saveError ? (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
              {saveError ?? error}
            </div>
          ) : null}
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Tier
              <select
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                onChange={(event) =>
                  setSelectedTier(event.target.value as AdminOtpPricingRule["tier"])
                }
                value={selectedTier}
              >
                <option value="BUDGET">Budget</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Markup basis points
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={0}
                onChange={(event) =>
                  setForm((current) => ({ ...current, markupBps: Number(event.target.value) }))
                }
                type="number"
                value={form.markupBps}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Minimum margin minor units
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minimumMarginMinor: Number(event.target.value)
                  }))
                }
                type="number"
                value={form.minimumMarginMinor}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Platform fee minor units
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    platformFeeMinor: Number(event.target.value)
                  }))
                }
                type="number"
                value={form.platformFeeMinor}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              USD/NGN rate
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={1}
                onChange={(event) =>
                  setForm((current) => ({ ...current, usdToNgnRate: Number(event.target.value) }))
                }
                type="number"
                value={form.usdToNgnRate}
              />
            </label>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[0.7fr_0.6fr_0.8fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
            <div>Tier</div>
            <div>Markup</div>
            <div>Minimum margin</div>
            <div>Platform fee</div>
            <div>FX rate</div>
            <div>Currency</div>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {isLoading ? (
              <EmptyState title="Loading pricing" detail="Fetching live OTP pricing rules." />
            ) : data?.pricingRules.length === 0 ? (
              <EmptyState
                title="No pricing rules"
                detail="Save a tier rule to activate OTP pricing guardrails."
              />
            ) : (
              data?.pricingRules.map((row) => (
                <button
                  className="grid w-full gap-3 p-4 text-left transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[0.7fr_0.6fr_0.8fr_0.8fr_0.8fr_0.7fr] lg:items-center"
                  key={row.tier}
                  onClick={() => setSelectedTier(row.tier)}
                  type="button"
                >
                  <Badge tone={row.tier === selectedTier ? "info" : "neutral"}>{row.tier}</Badge>
                  <div className="font-mono text-sm text-[var(--ft-text-primary)]">
                    {percentFromBps(row.markupBps)}
                  </div>
                  <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                    {moneyMinor(row.minimumMarginMinor, row.customerCurrency)}
                  </div>
                  <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                    {moneyMinor(row.platformFeeMinor, row.customerCurrency)}
                  </div>
                  <div className="font-mono text-sm text-[var(--ft-text-secondary)]">
                    {row.usdToNgnRate.toLocaleString("en-NG")}
                  </div>
                  <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                    {row.customerCurrency}
                  </div>
                </button>
              ))
            )}
          </div>
        </Panel>
      </div>
    </AdminOtpShell>
  );
}
