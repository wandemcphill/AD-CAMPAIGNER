"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Smartphone, Tags } from "lucide-react";

import { Badge, Button, Panel, PermissionDenied, SummaryStatStrip, ValueSkeleton } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { apiRequest, isForbiddenError } from "../../lib/api-client";

type GiftCardProduct = {
  productId: string;
  brand: string;
  region: string;
  country: string;
  denomination: number;
  currency: string;
  priceNgn: number;
  available: boolean;
};

type AirtimeNetwork = { id?: string; code?: string; name?: string; displayName?: string };
type CashoutQuote = { amountNgn: number; feeNgn: number; payoutNgn: number; expiresAt: string };
type TransactionResult = { transactionId: string; status: string };

const tabs = [
  { id: "buy", label: "Buy gift cards" },
  { id: "sell", label: "Sell gift cards" },
  { id: "airtime", label: "Airtime cashout" }
];
const sellBrands = ["APPLE", "AMAZON", "STEAM", "GOOGLE_PLAY", "PLAYSTATION"];
const sellRegions = ["US", "UK", "EU", "GLOBAL"];

function ngn(value: number) {
  return `NGN ${Number(value || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function networkName(network: AirtimeNetwork) {
  return network.displayName ?? network.name ?? network.code ?? network.id ?? "Network";
}

export default function DigitalValuePage() {
  const [activeTab, setActiveTab] = useState("buy");
  const [products, setProducts] = useState<GiftCardProduct[]>([]);
  const [networks, setNetworks] = useState<AirtimeNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const [sellBrand, setSellBrand] = useState(sellBrands[0]);
  const [sellRegion, setSellRegion] = useState(sellRegions[0]);
  const [sellDenomination, setSellDenomination] = useState(50);
  const [sellCode, setSellCode] = useState("");
  const [sellQuote, setSellQuote] = useState<{ payout: number; fee: number }>();

  const [cashoutNetwork, setCashoutNetwork] = useState("");
  const [cashoutPhone, setCashoutPhone] = useState("");
  const [cashoutOtp, setCashoutOtp] = useState("");
  const [cashoutSessionId, setCashoutSessionId] = useState<string>();
  const [cashoutBalance, setCashoutBalance] = useState<number>();
  const [cashoutAmount, setCashoutAmount] = useState(500);
  const [cashoutQuote, setCashoutQuote] = useState<CashoutQuote>();
  const [cashoutPin, setCashoutPin] = useState("");
  const [cashoutResult, setCashoutResult] = useState<TransactionResult>();
  const [cashoutError, setCashoutError] = useState<string>();

  const availableProducts = useMemo(() => products.filter((p) => p.available), [products]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setForbidden(false);
    try {
      const [giftCards, airtime] = await Promise.all([
        apiRequest<GiftCardProduct[]>("/digital-value/gift-cards/products"),
        apiRequest<{ networks: AirtimeNetwork[] }>("/digital-value/airtime/networks")
      ]);
      setProducts(giftCards);
      setNetworks(airtime.networks);
      if (!cashoutNetwork && airtime.networks[0]) setCashoutNetwork(airtime.networks[0].code ?? airtime.networks[0].id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Digital value catalog is unavailable.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, [cashoutNetwork]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function buyGiftCard(product: GiftCardProduct) {
    setBusy(`buy-${product.productId}`);
    setError(undefined);
    setSuccess(undefined);
    try {
      const quote = await apiRequest<{ quoteId: string }>("/digital-value/gift-cards/buy/quote", {
        method: "POST", body: JSON.stringify({ productId: product.productId, quantity: 1 })
      });
      const result = await apiRequest<TransactionResult>("/digital-value/gift-cards/buy", {
        method: "POST", body: JSON.stringify({ quoteId: quote.quoteId })
      });
      setSuccess(`Gift card order ${result.transactionId} is ${result.status.toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not buy this gift card.");
    } finally { setBusy(undefined); }
  }

  async function quoteSellCard() {
    setBusy("sell-quote"); setError(undefined); setSellQuote(undefined);
    try {
      const quote = await apiRequest<{ estimatedPayoutNgn: number; finalPayoutNgn: number; feeNgn: number }>("/digital-value/gift-cards/sell/rate", {
        method: "POST", body: JSON.stringify({ brand: sellBrand, region: sellRegion, denomination: sellDenomination })
      });
      setSellQuote({ payout: quote.finalPayoutNgn, fee: quote.feeNgn });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not quote this gift card."); }
    finally { setBusy(undefined); }
  }

  async function submitSellCard() {
    if (!sellCode.trim()) { setError("Enter the gift card code before submitting."); return; }
    setBusy("sell"); setError(undefined); setSuccess(undefined);
    try {
      const quote = await apiRequest<{ quoteId: string }>("/digital-value/gift-cards/sell/rate", {
        method: "POST", body: JSON.stringify({ brand: sellBrand, region: sellRegion, denomination: sellDenomination })
      });
      const result = await apiRequest<TransactionResult>("/digital-value/gift-cards/sell", {
        method: "POST", body: JSON.stringify({ quoteId: quote.quoteId, brand: sellBrand, region: sellRegion, denomination: sellDenomination, cardInfo: { currency: "USD", cardCode: sellCode.trim(), cardType: "ecode" } })
      });
      setSellCode("");
      setSellQuote(undefined);
      setSuccess(`Gift card sale ${result.transactionId} is ${result.status.toLowerCase()}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit this gift card."); }
    finally { setBusy(undefined); }
  }

  async function requestOtp() {
    if (!cashoutNetwork || !cashoutPhone.trim()) { setCashoutError("Choose a network and enter the phone number."); return; }
    setBusy("cashout-otp"); setCashoutError(undefined);
    try {
      await apiRequest("/digital-value/airtime/cashout/otp", { method: "POST", body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim() }) });
    } catch (caught) { setCashoutError(caught instanceof Error ? caught.message : "Could not request a code."); }
    finally { setBusy(undefined); }
  }

  async function verifyOtp() {
    if (!cashoutOtp.trim()) { setCashoutError("Enter the code that was sent."); return; }
    setBusy("cashout-verify"); setCashoutError(undefined);
    try {
      const result = await apiRequest<{ verified: boolean; airtimeBalanceNgn: number; sessionId: string }>("/digital-value/airtime/cashout/verify", {
        method: "POST", body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim(), otp: cashoutOtp.trim() })
      });
      setCashoutSessionId(result.sessionId); setCashoutBalance(result.airtimeBalanceNgn);
    } catch (caught) { setCashoutError(caught instanceof Error ? caught.message : "That code did not verify."); }
    finally { setBusy(undefined); }
  }

  async function getCashoutQuote() {
    if (!cashoutAmount || cashoutAmount <= 0) { setCashoutError("Enter an amount to cash out."); return; }
    setBusy("cashout-quote"); setCashoutError(undefined);
    try {
      const quote = await apiRequest<CashoutQuote>("/digital-value/airtime/cashout/quote", {
        method: "POST", body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim(), amountMinor: Math.round(cashoutAmount * 100) })
      });
      setCashoutQuote(quote);
    } catch (caught) { setCashoutError(caught instanceof Error ? caught.message : "Could not quote this amount."); }
    finally { setBusy(undefined); }
  }

  async function initiateCashout() {
    if (!cashoutSessionId || !cashoutQuote) return;
    setBusy("cashout-initiate"); setCashoutError(undefined);
    try {
      const result = await apiRequest<TransactionResult>("/digital-value/airtime/cashout", {
        method: "POST", body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim(), amountMinor: Math.round(cashoutAmount * 100), sessionId: cashoutSessionId, ...(cashoutPin.trim() ? { pin: cashoutPin.trim() } : {}) })
      });
      setCashoutResult(result);
    } catch (caught) { setCashoutError(caught instanceof Error ? caught.message : "Could not start the cashout."); }
    finally { setBusy(undefined); }
  }

  if (forbidden) return <PermissionDenied>You do not have permission to view gift cards and cashout for this workspace. Contact your workspace owner if you believe this is a mistake.</PermissionDenied>;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Gift className="size-5 text-[var(--ft-accent)]" /><h1 className="text-xl font-bold">Gift Cards & Cashout</h1></div>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Buy gift cards, sell eligible cards, or convert airtime to cash.</p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw className="size-4" />Refresh</Button>
        </div>

        <ErrorNotice message={error} />
        {success ? <div className="mt-4 rounded-xl border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm">{success}</div> : null}

        <section className="mt-5"><SummaryStatStrip items={[
          { label: "gift card products", value: loading ? <ValueSkeleton width="w-10" /> : products.length },
          { label: "available to buy", value: loading ? <ValueSkeleton width="w-10" /> : availableProducts.length },
          { label: "cashout networks", value: loading ? <ValueSkeleton width="w-10" /> : networks.length }
        ]} /></section>

        <div className="mt-5"><TabBar items={tabs} onChange={(value) => { setActiveTab(value); setError(undefined); setSuccess(undefined); }} value={activeTab} /></div>

        {activeTab === "buy" ? (
          <section className="mt-5">
            {loading ? <Panel className="p-5"><LoadingBlock label="Loading gift card catalog" /></Panel> : availableProducts.length === 0 ? (
              <Panel className="p-5"><div className="flex items-center gap-3"><Tags className="size-5 text-[var(--ft-text-muted)]" /><div><div className="font-semibold">No gift cards available</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">Try refreshing the catalog shortly.</div></div></div></Panel>
            ) : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{availableProducts.slice(0, 18).map((product) => (
              <Panel className="p-4" key={product.productId}>
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{product.brand}</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">{product.country} · {product.region}</div></div><Badge tone="success">Available</Badge></div>
                <div className="mt-4 rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm"><div className="flex justify-between"><span className="text-[var(--ft-text-secondary)]">Face value</span><span className="font-semibold">{product.currency} {product.denomination}</span></div><div className="mt-2 flex justify-between"><span className="text-[var(--ft-text-secondary)]">Wallet price</span><span className="font-semibold">{ngn(product.priceNgn)}</span></div></div>
                <Button className="mt-4 w-full justify-center" disabled={busy === `buy-${product.productId}`} onClick={() => void buyGiftCard(product)}>{busy === `buy-${product.productId}` ? "Buying..." : "Buy with wallet"}</Button>
              </Panel>
            ))}</div>}
          </section>
        ) : null}

        {activeTab === "sell" ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <Panel className="p-5"><div className="flex items-center gap-3"><Gift className="size-5 text-[var(--ft-accent)]" /><div><h2 className="font-semibold">Sell your gift card</h2><p className="mt-1 text-xs text-[var(--ft-text-muted)]">Get an estimate first, then submit the eligible card for settlement.</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Brand<select className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" value={sellBrand} onChange={(e) => setSellBrand(e.target.value)}>{sellBrands.map((v) => <option key={v}>{v}</option>)}</select></label><label className="text-xs font-medium">Region<select className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" value={sellRegion} onChange={(e) => setSellRegion(e.target.value)}>{sellRegions.map((v) => <option key={v}>{v}</option>)}</select></label><label className="text-xs font-medium sm:col-span-2">Denomination (USD)<input className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" min="1" type="number" value={sellDenomination} onChange={(e) => setSellDenomination(Number(e.target.value))} /></label></div>
              <Button className="mt-4" disabled={busy === "sell-quote"} onClick={() => void quoteSellCard()} variant="secondary">{busy === "sell-quote" ? "Getting quote..." : "Get payout quote"}</Button>
              {sellQuote ? <div className="mt-4 rounded-xl border border-[var(--ft-accent)]/25 bg-[var(--ft-accent)]/5 p-4"><div className="text-xs text-[var(--ft-text-muted)]">Estimated payout</div><div className="mt-1 text-xl font-bold">{ngn(sellQuote.payout)}</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">Estimated fee: {ngn(sellQuote.fee)}</div></div> : null}
              <label className="mt-5 block text-xs font-medium">Gift card code<input className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" placeholder="Enter card code" value={sellCode} onChange={(e) => setSellCode(e.target.value)} /></label>
              <Button className="mt-3" disabled={busy === "sell" || !sellQuote} onClick={() => void submitSellCard()}>{busy === "sell" ? "Submitting..." : "Sell gift card"}</Button>
            </Panel>
            <Panel className="p-5"><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-accent)]">How it works</div><div className="mt-4 space-y-4">{[["1", "Choose", "Select the brand, region and denomination."],["2", "Quote", "See the estimated payout and fee before submission."],["3", "Submit", "Provide the eligible card code for review."],["4", "Settle", "Track the resulting transaction status."]].map(([n, title, text]) => <div className="flex gap-3" key={n}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ft-bg-muted)] font-mono text-[10px]">{n}</span><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{text}</div></div></div>)}</div></Panel>
          </section>
        ) : null}

        {activeTab === "airtime" ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <Panel className="p-5"><div className="flex items-center gap-3"><Smartphone className="size-5 text-[var(--ft-accent)]" /><div><h2 className="font-semibold">Convert airtime to cash</h2><p className="mt-1 text-xs text-[var(--ft-text-muted)]">Verify ownership, check the balance, get a quote and confirm the cashout.</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Network<select className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" value={cashoutNetwork} onChange={(e) => { setCashoutNetwork(e.target.value); setCashoutSessionId(undefined); }}>{networks.map((n) => { const value = n.code ?? n.id ?? ""; return <option key={value} value={value}>{networkName(n)}</option>; })}</select></label><label className="text-xs font-medium">Phone number<input className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" placeholder="080..." value={cashoutPhone} onChange={(e) => setCashoutPhone(e.target.value)} /></label></div>
              <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy === "cashout-otp"} onClick={() => void requestOtp()} variant="secondary">{busy === "cashout-otp" ? "Sending..." : "Send verification code"}</Button><input className="w-32 rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-sm" placeholder="OTP" value={cashoutOtp} onChange={(e) => setCashoutOtp(e.target.value)} /><Button disabled={busy === "cashout-verify"} onClick={() => void verifyOtp()}>{busy === "cashout-verify" ? "Verifying..." : "Verify"}</Button></div>
              {cashoutBalance !== undefined ? <div className="mt-4 rounded-xl border border-[var(--ft-green)]/25 bg-[var(--ft-green-subtle)] p-3 text-sm"><span className="text-[var(--ft-text-muted)]">Verified airtime balance</span><span className="ml-2 font-semibold">{ngn(cashoutBalance)}</span></div> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Cashout amount<input className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" min="1" type="number" value={cashoutAmount} onChange={(e) => setCashoutAmount(Number(e.target.value))} /></label><div className="flex items-end"><Button disabled={!cashoutSessionId || busy === "cashout-quote"} onClick={() => void getCashoutQuote()} variant="secondary">{busy === "cashout-quote" ? "Quoting..." : "Get cashout quote"}</Button></div></div>
              {cashoutQuote ? <div className="mt-4 rounded-xl border border-[var(--ft-accent)]/25 bg-[var(--ft-accent)]/5 p-4"><div className="grid grid-cols-3 gap-3 text-sm"><div><div className="text-[10px] uppercase text-[var(--ft-text-muted)]">Amount</div><div className="mt-1 font-semibold">{ngn(cashoutQuote.amountNgn)}</div></div><div><div className="text-[10px] uppercase text-[var(--ft-text-muted)]">Fee</div><div className="mt-1 font-semibold">{ngn(cashoutQuote.feeNgn)}</div></div><div><div className="text-[10px] uppercase text-[var(--ft-text-muted)]">You receive</div><div className="mt-1 font-semibold">{ngn(cashoutQuote.payoutNgn)}</div></div></div><label className="mt-4 block text-xs font-medium">Optional PIN<input className="mt-1 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2.5 text-sm" inputMode="numeric" value={cashoutPin} onChange={(e) => setCashoutPin(e.target.value)} /></label><Button className="mt-3" disabled={busy === "cashout-initiate"} onClick={() => void initiateCashout()}>{busy === "cashout-initiate" ? "Starting..." : "Confirm cashout"}</Button></div> : null}
              {cashoutError ? <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm">{cashoutError}</div> : null}
              {cashoutResult ? <div className="mt-4 rounded-xl border border-[var(--ft-green)]/25 bg-[var(--ft-green-subtle)] p-3 text-sm">Cashout {cashoutResult.transactionId} is {cashoutResult.status.toLowerCase()}.</div> : null}
            </Panel>
            <Panel className="p-5"><div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-accent)]">Protected flow</div><h3 className="mt-2 text-sm font-semibold">Your phone is verified before balance access</h3><p className="mt-2 text-xs leading-5 text-[var(--ft-text-muted)]">The verification session is carried into the cashout request. Quotes show the amount, fee and expected payout before confirmation.</p></Panel>
          </section>
        ) : null}
      </div>
    </div>
  );
}
