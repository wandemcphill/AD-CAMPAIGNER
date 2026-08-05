"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Send, Smartphone, Tags } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { apiRequest } from "../../lib/api-client";

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
  const [sellBrand, setSellBrand] = useState(sellBrands[0] ?? "APPLE_GIFT_CARD");
  const [sellRegion, setSellRegion] = useState(sellRegions[0] ?? "US");
  const [sellDenomination, setSellDenomination] = useState(50);
  const [sellCode, setSellCode] = useState("");
  const [sellQuote, setSellQuote] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const availableProducts = useMemo(
    () => products.filter((product) => product.available),
    [products]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [giftCards, airtime] = await Promise.all([
        apiRequest<GiftCardProduct[]>("/digital-value/gift-cards/products"),
        apiRequest<{ networks: AirtimeNetwork[] }>("/digital-value/airtime/networks")
      ]);
      setProducts(giftCards);
      setNetworks(airtime.networks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Digital value catalog is unavailable.");
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
        ) : null}
      </div>
    </div>
  );
}
