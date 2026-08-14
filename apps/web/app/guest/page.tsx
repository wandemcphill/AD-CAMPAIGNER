"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Wifi, Zap, Tv, Dices, GraduationCap } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { Input, SelectCard } from "@fliptrybe/ui/components";

import {
  startGuestCheckout,
  initiateGuestPayment,
  loadGuestDataPlans,
  loadGuestCablePackages,
  loadGuestEducationPlans,
  verifyGuestMeter,
  verifyGuestCable,
  type GuestProductType,
  type GuestDataPlan,
  type GuestCablePackage,
  type GuestEducationPlan,
  type GuestMeterValidation
} from "./guest-checkout-api";
import { CABLE_PROVIDERS, ELECTRIC_COMPANIES } from "../os/utilities/vtu-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

const PRODUCTS: Array<{ id: GuestProductType; title: string; description: string; icon: React.ReactNode }> = [
  { id: "AIRTIME", title: "Airtime", description: "Top up any Nigerian network", icon: <Smartphone className="size-4" /> },
  { id: "DATA", title: "Data", description: "Buy a data bundle", icon: <Wifi className="size-4" /> },
  { id: "ELECTRICITY", title: "Electricity", description: "Prepaid & postpaid tokens", icon: <Zap className="size-4" /> },
  { id: "CABLE", title: "Cable TV", description: "DStv, GOtv, Startimes", icon: <Tv className="size-4" /> },
  { id: "BETTING", title: "Betting", description: "Fund a bookmaker wallet", icon: <Dices className="size-4" /> },
  { id: "EDUCATION", title: "Exam PINs", description: "WAEC result checker & more", icon: <GraduationCap className="size-4" /> }
];

const NETWORKS = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];

export default function GuestBillsPage() {
  const router = useRouter();
  const [productType, setProductType] = useState<GuestProductType>("AIRTIME");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("MTN");
  const [msisdn, setMsisdn] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [dataPlans, setDataPlans] = useState<GuestDataPlan[]>([]);
  const [loadingDataPlans, setLoadingDataPlans] = useState(false);
  const [disco, setDisco] = useState(ELECTRIC_COMPANIES[0]!.code);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterValidation, setMeterValidation] = useState<GuestMeterValidation>();
  const [meterValidating, setMeterValidating] = useState(false);
  const [cableProvider, setCableProvider] = useState(CABLE_PROVIDERS[0]!.id);
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [cablePackages, setCablePackages] = useState<GuestCablePackage[]>([]);
  const [loadingCablePackages, setLoadingCablePackages] = useState(false);
  const [cardValidation, setCardValidation] = useState<GuestMeterValidation>();
  const [cardValidating, setCardValidating] = useState(false);
  const [bookmaker, setBookmaker] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [examType, setExamType] = useState("");
  const [educationPlans, setEducationPlans] = useState<GuestEducationPlan[]>([]);
  const [loadingEducationPlans, setLoadingEducationPlans] = useState(false);
  const [amountNaira, setAmountNaira] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const needsAmount = productType === "AIRTIME" || productType === "ELECTRICITY" || productType === "BETTING";

  useEffect(() => {
    if (productType !== "DATA") return;
    setLoadingDataPlans(true);
    setBundleId("");
    loadGuestDataPlans(network)
      .then(setDataPlans)
      .catch(() => setDataPlans([]))
      .finally(() => setLoadingDataPlans(false));
  }, [productType, network]);

  useEffect(() => {
    if (productType !== "EDUCATION") return;
    setLoadingEducationPlans(true);
    loadGuestEducationPlans()
      .then((plans) => {
        setEducationPlans(plans);
        setExamType((prev) => prev || plans[0]?.productCode || "");
      })
      .catch(() => setEducationPlans([]))
      .finally(() => setLoadingEducationPlans(false));
  }, [productType]);

  useEffect(() => {
    if (productType !== "CABLE") return;
    setLoadingCablePackages(true);
    setPackageCode("");
    loadGuestCablePackages(cableProvider)
      .then(setCablePackages)
      .catch(() => setCablePackages([]))
      .finally(() => setLoadingCablePackages(false));
  }, [productType, cableProvider]);

  useEffect(() => {
    setCardValidation(undefined);
  }, [cableProvider, smartCardNumber]);

  useEffect(() => {
    setMeterValidation(undefined);
  }, [disco, meterNumber]);

  const selectedPackage = useMemo(
    () => cablePackages.find((p) => p.packageCode === packageCode),
    [cablePackages, packageCode]
  );

  async function submitVerifyMeter() {
    if (!meterNumber.trim()) return;
    setMeterValidating(true);
    setError(undefined);
    setMeterValidation(undefined);
    try {
      const result = await verifyGuestMeter({ disco, meterNumber: meterNumber.trim(), meterType: "PREPAID" });
      setMeterValidation(result);
      if (!result.valid) setError("Meter validation failed. Check the meter number and provider.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not validate this meter.");
    } finally {
      setMeterValidating(false);
    }
  }

  async function submitVerifyCard() {
    if (!smartCardNumber.trim()) return;
    setCardValidating(true);
    setError(undefined);
    setCardValidation(undefined);
    try {
      const result = await verifyGuestCable({ provider: cableProvider, smartCardNumber: smartCardNumber.trim() });
      setCardValidation(result);
      if (!result.valid) setError("Smartcard verification failed. Check the smartcard/IUC number.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not verify this smartcard.");
    } finally {
      setCardValidating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (productType === "ELECTRICITY" && !meterValidation?.valid) {
      setError("Verify the meter number before paying.");
      return;
    }
    if (productType === "CABLE" && !cardValidation?.valid) {
      setError("Verify the smartcard number before paying.");
      return;
    }

    setSubmitting(true);

    try {
      const amountMinor = amountNaira ? Math.round(Number(amountNaira) * 100) : undefined;
      const transaction = await startGuestCheckout({
        productType,
        email,
        ...(phone ? { phone } : {}),
        ...(needsAmount && amountMinor !== undefined ? { amountMinor } : {}),
        ...(productType === "AIRTIME" || productType === "DATA" ? { network, msisdn } : {}),
        ...(productType === "DATA" ? { bundleId } : {}),
        ...(productType === "ELECTRICITY" ? { disco, meterNumber, meterType: "PREPAID" } : {}),
        ...(productType === "CABLE" ? { cableProvider, smartCardNumber, packageCode } : {}),
        ...(productType === "BETTING" ? { bookmaker, customerId } : {}),
        ...(productType === "EDUCATION" ? { examType } : {})
      });

      const payment = await initiateGuestPayment(transaction.reference, `${window.location.origin}/guest/pay/${transaction.reference}`);
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      } else {
        router.push(`/guest/pay/${transaction.reference}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start your purchase.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <a className="flex items-center gap-3" href="/">
            <img alt="FlipTrybe" className="h-7 w-auto" src="/brand/logo-horizontal-light.svg" />
          </a>
          <ThemeToggle />
        </div>

        <div className="mt-8">
          <Badge tone="info">No account required</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Pay a bill in under a minute</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
            Airtime, data, electricity, cable TV, betting funding and exam PINs — pay as a guest, no signup required.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <SelectCard
              active={productType === p.id}
              description={p.description}
              icon={p.icon}
              key={p.id}
              onClick={() => setProductType(p.id)}
              title={p.title}
            />
          ))}
        </div>

        <Panel className="mt-6 p-6">
          <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <Input
              autoComplete="email"
              id="email"
              label="Email (for your receipt)"
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="tel"
              hint="Optional"
              id="phone"
              label="Phone"
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="0801 234 5678"
              type="tel"
              value={phone}
            />

            {(productType === "AIRTIME" || productType === "DATA") && (
              <>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="network">Network</label>
                  <select
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                    id="network"
                    onChange={(e) => setNetwork(e.target.value)}
                    value={network}
                  >
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>{n.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <Input
                  id="msisdn"
                  label="Phone number to top up"
                  onChange={(e) => setMsisdn(e.currentTarget.value)}
                  placeholder="0801 234 5678"
                  required
                  value={msisdn}
                />
              </>
            )}

            {productType === "DATA" && (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Choose a data plan</span>
                {loadingDataPlans ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                    Loading plans…
                  </div>
                ) : dataPlans.length === 0 ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                    No data plans available for this network right now.
                  </div>
                ) : (
                  <div className="grid max-h-64 gap-2 overflow-y-auto">
                    {dataPlans.map((plan) => (
                      <button
                        className={`flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left text-sm transition ${
                          bundleId === plan.providerPlanId
                            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                            : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                        }`}
                        key={plan.providerPlanId}
                        onClick={() => setBundleId(plan.providerPlanId)}
                        type="button"
                      >
                        <span className="font-medium">{plan.displayName}</span>
                        <span className="font-semibold">{formatNaira(Math.ceil(plan.costMinor * 1.02))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {productType === "ELECTRICITY" && (
              <>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="disco">Distribution company</label>
                  <select
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                    id="disco"
                    onChange={(e) => setDisco(e.target.value)}
                    value={disco}
                  >
                    {ELECTRIC_COMPANIES.map((d) => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="meterNumber">Meter number</label>
                  <div className="flex gap-2">
                    <input
                      className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                      id="meterNumber"
                      onChange={(e) => setMeterNumber(e.target.value)}
                      value={meterNumber}
                    />
                    <Button
                      disabled={!meterNumber.trim() || meterValidating}
                      onClick={() => void submitVerifyMeter()}
                      type="button"
                      variant="secondary"
                    >
                      {meterValidating ? "Checking..." : "Verify"}
                    </Button>
                  </div>
                  {meterValidation?.valid && (
                    <div className="rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
                      <div className="font-medium">{meterValidation.customerName ?? "Meter verified"}</div>
                      {meterValidation.address && (
                        <div className="text-xs text-[var(--ft-text-muted)]">{meterValidation.address}</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {productType === "CABLE" && (
              <>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="cableProvider">Provider</label>
                  <select
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                    id="cableProvider"
                    onChange={(e) => setCableProvider(e.target.value)}
                    value={cableProvider}
                  >
                    {CABLE_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="smartCardNumber">Smart card number</label>
                  <div className="flex gap-2">
                    <input
                      className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                      id="smartCardNumber"
                      onChange={(e) => setSmartCardNumber(e.target.value)}
                      value={smartCardNumber}
                    />
                    <Button
                      disabled={!smartCardNumber.trim() || cardValidating}
                      onClick={() => void submitVerifyCard()}
                      type="button"
                      variant="secondary"
                    >
                      {cardValidating ? "Checking..." : "Verify"}
                    </Button>
                  </div>
                  {cardValidation?.valid && (
                    <div className="rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
                      <div className="font-medium">{cardValidation.customerName ?? "Smartcard verified"}</div>
                    </div>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">Select package</span>
                  {loadingCablePackages ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                      Loading packages…
                    </div>
                  ) : cablePackages.length === 0 ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                      No packages available for this provider right now.
                    </div>
                  ) : (
                    <div className="grid max-h-64 gap-2 overflow-y-auto">
                      {cablePackages.map((pkg) => (
                        <button
                          className={`flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left text-sm transition ${
                            packageCode === pkg.packageCode
                              ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                              : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                          }`}
                          key={pkg.id}
                          onClick={() => setPackageCode(pkg.packageCode)}
                          type="button"
                        >
                          <span className="font-medium">{pkg.displayName}</span>
                          <span className="font-semibold">{formatNaira(Math.ceil(pkg.costMinor * 1.02))}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {productType === "BETTING" && (
              <>
                <Input id="bookmaker" label="Bookmaker" onChange={(e) => setBookmaker(e.currentTarget.value)} placeholder="e.g. product-bet-king" required value={bookmaker} />
                <Input id="customerId" label="Customer / account ID" onChange={(e) => setCustomerId(e.currentTarget.value)} required value={customerId} />
              </>
            )}

            {productType === "EDUCATION" && (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">Choose an exam PIN</span>
                {loadingEducationPlans ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                    Loading products…
                  </div>
                ) : educationPlans.length === 0 ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] px-4 py-3 text-sm text-[var(--ft-text-muted)]">
                    No exam PIN products are available right now.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {educationPlans.map((plan) => (
                      <button
                        className={`flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left text-sm transition ${
                          examType === plan.productCode
                            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                            : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                        }`}
                        key={plan.productCode}
                        onClick={() => setExamType(plan.productCode)}
                        type="button"
                      >
                        <span className="font-medium">{plan.displayName}</span>
                        <span className="font-semibold">{formatNaira(plan.costMinor)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {needsAmount && (
              <Input
                id="amount"
                label="Amount (NGN)"
                min={1}
                onChange={(e) => setAmountNaira(e.currentTarget.value)}
                required
                type="number"
                value={amountNaira}
              />
            )}

            {error && (
              <div className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] px-4 py-3 text-sm text-[var(--ft-red)]">
                {error}
              </div>
            )}

            <Button
              className="h-11 w-full justify-center"
              disabled={
                submitting ||
                (productType === "DATA" && !bundleId) ||
                (productType === "CABLE" && (!selectedPackage || !cardValidation?.valid)) ||
                (productType === "ELECTRICITY" && !meterValidation?.valid) ||
                (productType === "EDUCATION" && !examType)
              }
              type="submit"
            >
              {submitting ? "Starting..." : "Continue to payment"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </Panel>

        <p className="mt-6 text-center text-xs text-[var(--ft-text-muted)]">
          Already have an account?{" "}
          <a className="text-[var(--ft-accent)]" href="/login">
            Sign in
          </a>{" "}
          to keep every receipt in one place.
        </p>
      </div>
    </main>
  );
}
