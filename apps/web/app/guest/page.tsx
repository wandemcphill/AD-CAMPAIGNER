"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Wifi, Zap, Tv, Dices, GraduationCap } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { Input, SelectCard } from "@fliptrybe/ui/components";

import { startGuestCheckout, initiateGuestPayment, type GuestProductType } from "./guest-checkout-api";

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
  const [disco, setDisco] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [cableProvider, setCableProvider] = useState("");
  const [smartCardNumber, setSmartCardNumber] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [examType, setExamType] = useState("");
  const [amountNaira, setAmountNaira] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const needsAmount = productType === "AIRTIME" || productType === "ELECTRICITY" || productType === "BETTING";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
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
              <Input
                hint="Provider plan ID from the data plan catalog"
                id="bundleId"
                label="Data bundle"
                onChange={(e) => setBundleId(e.currentTarget.value)}
                placeholder="e.g. 1000"
                required
                value={bundleId}
              />
            )}

            {productType === "ELECTRICITY" && (
              <>
                <Input id="disco" label="Disco" onChange={(e) => setDisco(e.currentTarget.value)} placeholder="e.g. ikeja-electric" required value={disco} />
                <Input id="meterNumber" label="Meter number" onChange={(e) => setMeterNumber(e.currentTarget.value)} required value={meterNumber} />
              </>
            )}

            {productType === "CABLE" && (
              <>
                <Input id="cableProvider" label="Provider" onChange={(e) => setCableProvider(e.currentTarget.value)} placeholder="dstv / gotv / startimes" required value={cableProvider} />
                <Input id="smartCardNumber" label="Smart card number" onChange={(e) => setSmartCardNumber(e.currentTarget.value)} required value={smartCardNumber} />
                <Input id="packageCode" label="Package" onChange={(e) => setPackageCode(e.currentTarget.value)} placeholder="e.g. dstv-padi" required value={packageCode} />
              </>
            )}

            {productType === "BETTING" && (
              <>
                <Input id="bookmaker" label="Bookmaker" onChange={(e) => setBookmaker(e.currentTarget.value)} placeholder="e.g. product-bet-king" required value={bookmaker} />
                <Input id="customerId" label="Customer / account ID" onChange={(e) => setCustomerId(e.currentTarget.value)} required value={customerId} />
              </>
            )}

            {productType === "EDUCATION" && (
              <Input id="examType" label="Exam PIN" onChange={(e) => setExamType(e.currentTarget.value)} placeholder="waecdirect" required value={examType} />
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

            <Button className="h-11 w-full justify-center" disabled={submitting} type="submit">
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
