"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Send, Smartphone, Tags } from "lucide-react";

import { Badge, Button, Panel, PermissionDenied, SummaryStatStrip, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
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

type AirtimeNetwork = {
  id?: string;
  code?: string;
  name?: string;
  displayName?: string;
};

type CashoutQuote = {
  amountNgn: number;
  feeNgn: number;
  payoutNgn: number;
  expiresAt: string;
};

const tabs = [
  { id: "buy", label: "Buy gift cards" },
  { id: "sell", label: "Sell gift cards" },
  { id: "airtime", label: "Airtime cashout" }
];

const sellBrands = ["APPLE_GIFT_CARD", "AMAZON", "STEAM", "GOOGLE_PLAY", "PLAYSTATION"];
const sellRegions = ["US", "UK", "EU", "GLOBAL"];

function formatNgn(value: number) {
  return `NGN ${(value / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function networkLabel(network: AirtimeNetwork) {
  return network.displayName ?? network.name ?? network.code ?? network.id ?? "Network";
}

export default function DigitalValuePage() {
  const [activeTab, setActiveTab] = useState("buy");
  const [products, setProducts] = useState<GiftCardProduct[]>([]);
  const [networks, setNetworks] = useState<AirtimeNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [sellBrand, setSellBrand] = useState(sellBrands[0] ?? "APPLE_GIFT_CARD");
  const [sellRegion, setSellRegion] = useState(sellRegions[0] ?? "US");
  const [sellDenomination, setSellDenomination] = useState(50);
  const [sellCode, setSellCode] = useState("");
  const [sellQuote, setSellQuote] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [success, setSuccess] = useState<string>();

  // Airtime cashout — a 4-step flow: request an OTP on the phone's own network
  // (not FlipTrybe's), verify it to unlock the balance check, quote a specific
  // amount, then initiate. sessionId is minted by verify and must ride along
  // into initiate — it's how the provider knows this phone was proven owned.
  const [cashoutNetwork, setCashoutNetwork] = useState("");
  const [cashoutPhone, setCashoutPhone] = useState("");
  const [cashoutOtp, setCashoutOtp] = useState("");
  const [cashoutSessionId, setCashoutSessionId] = useState<string>();
  const [cashoutBalanceNgn, setCashoutBalanceNgn] = useState<number>();
  const [cashoutAmountNgn, setCashoutAmountNgn] = useState<number>(500);
  const [cashoutQuote, setCashoutQuote] = useState<CashoutQuote>();
  const [cashoutPin, setCashoutPin] = useState("");
  const [cashoutResult, setCashoutResult] = useState<{ transactionId: string; status: string }>();
  const [cashoutError, setCashoutError] = useState<string>();

  const availableProducts = useMemo(
    () => products.filter((product) => product.available),
    [products]
  );

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Digital value catalog is unavailable.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function quoteSellCard() {
    setError(undefined);
    setSellQuote(undefined);
    try {
      const quote = await apiRequest<{
        estimatedPayoutNgn: number;
        finalPayoutNgn: number;
        feeNgn: number;
      }>("/digital-value/gift-cards/sell/rate", {
        method: "POST",
        body: JSON.stringify({
          brand: sellBrand,
          region: sellRegion,
          denomination: sellDenomination
        })
      });
      setSellQuote(
        `Estimated payout: ${formatNgn(quote.finalPayoutNgn * 100)} after ${formatNgn(quote.feeNgn * 100)} fee.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not quote this gift card.");
    }
  }

  async function buyGiftCard(product: GiftCardProduct) {
    setBusy(`buy-${product.productId}`);
    setError(undefined);
    setSuccess(undefined);
    try {
      const quote = await apiRequest<{ quoteId: string }>("/digital-value/gift-cards/buy/quote", {
        method: "POST",
        body: JSON.stringify({ productId: product.productId, quantity: 1 })
      });
      const result = await apiRequest<{ transactionId: string; status: string }>(
        "/digital-value/gift-cards/buy",
        {
          method: "POST",
          body: JSON.stringify({ quoteId: quote.quoteId })
        }
      );
      setSuccess(`Gift card order ${result.transactionId} is ${result.status.toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not buy this gift card.");
    } finally {
      setBusy(undefined);
    }
  }

  async function submitSellCard() {
    if (!sellCode.trim()) {
      setError("Enter the gift card code before submitting.");
      return;
    }

    setBusy("sell");
    setError(undefined);
    setSuccess(undefined);
    try {
      const quote = await apiRequest<{ quoteId: string }>("/digital-value/gift-cards/sell/rate", {
        method: "POST",
        body: JSON.stringify({
          brand: sellBrand,
          region: sellRegion,
          denomination: sellDenomination
        })
      });
      const result = await apiRequest<{ transactionId: string; status: string }>(
        "/digital-value/gift-cards/sell",
        {
          method: "POST",
          body: JSON.stringify({
            quoteId: quote.quoteId,
            brand: sellBrand,
            region: sellRegion,
            denomination: sellDenomination,
            cardInfo: {
              currency: "USD",
              cardCode: sellCode.trim(),
              cardType: "ecode"
            }
          })
        }
      );
      setSellCode("");
      setSuccess(`Gift card sale ${result.transactionId} is ${result.status.toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit this gift card.");
    } finally {
      setBusy(undefined);
    }
  }

  function resetCashoutFlow() {
    setCashoutOtp("");
    setCashoutSessionId(undefined);
    setCashoutBalanceNgn(undefined);
    setCashoutQuote(undefined);
    setCashoutPin("");
    setCashoutResult(undefined);
    setCashoutError(undefined);
  }

  async function requestCashoutOtp() {
    if (!cashoutNetwork || !cashoutPhone.trim()) {
      setCashoutError("Choose a network and enter the phone number.");
      return;
    }
    setBusy("cashout-otp");
    setCashoutError(undefined);
    try {
      await apiRequest("/digital-value/airtime/cashout/otp", {
        method: "POST",
        body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim() })
      });
    } catch (caught) {
      setCashoutError(caught instanceof Error ? caught.message : "Could not request a code.");
    } finally {
      setBusy(undefined);
    }
  }

  async function verifyCashoutOtp() {
    if (!cashoutOtp.trim()) {
      setCashoutError("Enter the code that was sent.");
      return;
    }
    setBusy("cashout-verify");
    setCashoutError(undefined);
    try {
      const result = await apiRequest<{ verified: boolean; airtimeBalanceNgn: number; sessionId: string }>(
        "/digital-value/airtime/cashout/verify",
        {
          method: "POST",
          body: JSON.stringify({ network: cashoutNetwork, phone: cashoutPhone.trim(), otp: cashoutOtp.trim() })
        }
      );
      setCashoutSessionId(result.sessionId);
      setCashoutBalanceNgn(result.airtimeBalanceNgn);
    } catch (caught) {
      setCashoutError(caught instanceof Error ? caught.message : "That code didn't verify.");
    } finally {
      setBusy(undefined);
    }
  }

  async function getCashoutQuote() {
    if (!cashoutAmountNgn || cashoutAmountNgn <= 0) {
      setCashoutError("Enter an amount to cash out.");
      return;
    }
    setBusy("cashout-quote");
    setCashoutError(undefined);
    try {
      const quote = await apiRequest<CashoutQuote>("/digital-value/airtime/cashout/quote", {
        method: "POST",
        body: JSON.stringify({
          network: cashoutNetwork,
          phone: cashoutPhone.trim(),
          amountMinor: Math.round(cashoutAmountNgn * 100)
        })
      });
      setCashoutQuote(quote);
    } catch (caught) {
      setCashoutError(caught instanceof Error ? caught.message : "Could not quote this amount.");
    } finally {
      setBusy(undefined);
    }
  }

  async function initiateCashout() {
    if (!cashoutSessionId) return;
    setBusy("cashout-initiate");
    setCashoutError(undefined);
    try {
      const result = await apiRequest<{ transactionId: string; status: string }>(
        "/digital-value/airtime/cashout",
        {
          method: "POST",
          body: JSON.stringify({
            network: cashoutNetwork,
            phone: cashoutPhone.trim(),
            amountMinor: Math.round(cashoutAmountNgn * 100),
            sessionId: cashoutSessionId,
            ...(cashoutPin.trim() ? { pin: cashoutPin.trim() } : {})
          })
        }
      );
      setCashoutResult(result);
    } catch (caught) {
      setCashoutError(caught instanceof Error ? caught.message : "Could not start the cashout.");
    } finally {
      setBusy(undefined);
    }
  }

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view gift cards and cashout for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gift className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Gift Cards & Cashout</h1>
            </div>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Buy Reloadly gift cards, sell unused cards through SOGO, or convert airtime.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <ErrorNotice message={error} />
        {success ? (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-text-primary)]">
            {success}
          </div>
        ) : null}

        <section className="mt-5">
          <SummaryStatStrip
            items={[
              { label: "gift card products", value: loading ? "..." : products.length },
              { label: "available to buy", value: loading ? "..." : availableProducts.length },
              { label: "cashout networks", value: loading ? "..." : networks.length }
            ]}
          />
        </section>

        <div className="mt-5">
          <TabBar items={tabs} onChange={setActiveTab} value={activeTab} />
        </div>

        {activeTab === "buy" ? (
          <section className="mt-5">
            {loading ? (
              <Panel className="p-5">
                <LoadingBlock label="Loading gift card catalog" />
              </Panel>
            ) : availableProducts.length === 0 ? (
              <Panel className="p-5">
                <EmptyState
                  copy="Reloadly gift card products are not available yet. Check provider credentials and refresh."
                  icon={Tags}
                  title="No gift cards exposed"
                />
              </Panel>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {availableProducts.slice(0, 18).map((product) => (
                  <Panel className="p-4" key={product.productId}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                          {product.brand}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                          {product.country} - {product.region}
                        </div>
                      </div>
                      <Badge tone="success">Available</Badge>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[var(--ft-text-secondary)]">Face value</span>
                        <span className="font-semibold">
                          {product.currency} {product.denomination}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[var(--ft-text-secondary)]">Wallet price</span>
                        <span className="font-semibold">{formatNgn(product.priceNgn)}</span>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full justify-center"
                      disabled={busy === `buy-${product.productId}`}
                      onClick={() => void buyGiftCard(product)}
                      type="button"
                    >
                      {busy === `buy-${product.productId}` ? "Buying..." : "Buy with wallet"}
                    </Button>
                  </Panel>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "sell" ? (
          <Panel className="mt-5 p-5">
            <div className="flex items-center gap-2">
              <Send className="size-5 text-[var(--ft-accent)]" />
              <h2 className="text-lg font-semibold">Quote unused gift card</h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-[var(--ft-text-secondary)]">
                Brand
                <select
                  className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3"
                  onChange={(event) => setSellBrand(event.target.value)}
                  value={sellBrand}
                >
                  {sellBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--ft-text-secondary)]">
                Region
                <select
                  className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3"
                  onChange={(event) => setSellRegion(event.target.value)}
                  value={sellRegion}
                >
                  {sellRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[var(--ft-text-secondary)]">
                Denomination
                <input
                  className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3"
                  min={1}
                  onChange={(event) => setSellDenomination(Number(event.target.value))}
                  type="number"
                  value={sellDenomination}
                />
              </label>
            </div>
            <Button className="mt-4" onClick={() => void quoteSellCard()} type="button">
              Get SOGO quote
            </Button>
            <label className="mt-4 grid gap-2 text-sm text-[var(--ft-text-secondary)]">
              Gift card code
              <input
                className="h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3"
                onChange={(event) => setSellCode(event.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                value={sellCode}
              />
            </label>
            <Button
              className="mt-3"
              disabled={busy === "sell"}
              onClick={() => void submitSellCard()}
              type="button"
              variant="secondary"
            >
              {busy === "sell" ? "Submitting..." : "Submit to SOGO"}
            </Button>
            {sellQuote ? (
              <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-text-primary)]">
                {sellQuote}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {activeTab === "airtime" ? (
          <>
          <Panel className="mt-5 p-5">
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-[var(--ft-accent)]" />
              <h2 className="text-lg font-semibold">Airtime cashout networks</h2>
            </div>
            {loading ? (
              <div className="mt-4">
                <LoadingBlock label="Loading networks" />
              </div>
            ) : networks.length === 0 ? (
              <EmptyState
                copy="No airtime cashout networks are currently exposed by the provider."
                icon={Smartphone}
                title="No cashout networks"
              />
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {networks.map((network, index) => (
                  <div
                    className={cn(
                      "rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm font-semibold",
                      "text-[var(--ft-text-primary)]"
                    )}
                    key={`${networkLabel(network)}-${index}`}
                  >
                    {networkLabel(network)}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="mt-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Send className="size-5 text-[var(--ft-accent)]" />
                <h2 className="text-lg font-semibold">Cash out airtime</h2>
              </div>
              {cashoutSessionId ? (
                <Button onClick={resetCashoutFlow} variant="secondary">
                  Start over
                </Button>
              ) : null}
            </div>

            {cashoutError ? (
              <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-text-primary)]">
                {cashoutError}
              </div>
            ) : null}

            {cashoutResult ? (
              <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-text-primary)]">
                Cashout {cashoutResult.transactionId} is {cashoutResult.status.toLowerCase()}. Payout lands in
                your wallet once the network confirms.
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                    Network
                    <select
                      className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                      disabled={busy !== undefined || Boolean(cashoutSessionId)}
                      onChange={(event) => setCashoutNetwork(event.target.value)}
                      value={cashoutNetwork}
                    >
                      <option value="">Choose a network</option>
                      {networks.map((network, index) => {
                        const value = network.code ?? network.id ?? networkLabel(network);
                        return (
                          <option key={`${value}-${index}`} value={value}>
                            {networkLabel(network)}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                    Phone number
                    <input
                      className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                      disabled={busy !== undefined || Boolean(cashoutSessionId)}
                      onChange={(event) => setCashoutPhone(event.target.value)}
                      placeholder="080..."
                      value={cashoutPhone}
                    />
                  </label>
                </div>

                {!cashoutSessionId ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                      Verification code
                      <input
                        className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                        disabled={busy !== undefined}
                        onChange={(event) => setCashoutOtp(event.target.value)}
                        placeholder="Sent to your phone"
                        value={cashoutOtp}
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button
                        disabled={busy !== undefined || !cashoutNetwork || !cashoutPhone.trim()}
                        onClick={() => void requestCashoutOtp()}
                        variant="secondary"
                      >
                        {busy === "cashout-otp" ? "Sending..." : "Send code"}
                      </Button>
                      <Button disabled={busy !== undefined || !cashoutOtp.trim()} onClick={() => void verifyCashoutOtp()}>
                        {busy === "cashout-verify" ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-secondary)]">
                      Verified. Available balance:{" "}
                      <span className="font-semibold text-[var(--ft-text-primary)]">
                        {cashoutBalanceNgn !== undefined ? formatNgn(cashoutBalanceNgn * 100) : "—"}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                        Amount to cash out (NGN)
                        <input
                          className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                          disabled={busy !== undefined}
                          onChange={(event) => setCashoutAmountNgn(Number(event.target.value) || 0)}
                          type="number"
                          value={cashoutAmountNgn}
                        />
                      </label>
                      <Button disabled={busy !== undefined} onClick={() => void getCashoutQuote()} variant="secondary">
                        {busy === "cashout-quote" ? "Quoting..." : "Get quote"}
                      </Button>
                    </div>

                    {cashoutQuote ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                            <div className="text-xs text-[var(--ft-text-muted)]">Amount</div>
                            <div className="font-semibold text-[var(--ft-text-primary)]">
                              {formatNgn(cashoutQuote.amountNgn * 100)}
                            </div>
                          </div>
                          <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                            <div className="text-xs text-[var(--ft-text-muted)]">Fee</div>
                            <div className="font-semibold text-[var(--ft-text-primary)]">
                              {formatNgn(cashoutQuote.feeNgn * 100)}
                            </div>
                          </div>
                          <div className="rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3">
                            <div className="text-xs text-[var(--ft-text-muted)]">You receive</div>
                            <div className="font-semibold text-[var(--ft-text-primary)]">
                              {formatNgn(cashoutQuote.payoutNgn * 100)}
                            </div>
                          </div>
                        </div>
                        <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                          PIN (if your network requires one)
                          <input
                            className="h-10 max-w-xs rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                            disabled={busy !== undefined}
                            onChange={(event) => setCashoutPin(event.target.value)}
                            type="password"
                            value={cashoutPin}
                          />
                        </label>
                        <div>
                          <Button disabled={busy !== undefined} onClick={() => void initiateCashout()}>
                            {busy === "cashout-initiate" ? "Starting..." : "Cash out now"}
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}
