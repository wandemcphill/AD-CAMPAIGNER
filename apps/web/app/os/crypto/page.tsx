"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bitcoin, Clock, Copy } from "lucide-react";
import { motion } from "framer-motion";

import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PermissionDenied
} from "@fliptrybe/ui";

import { LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import {
  createDepositAddress,
  loadAssets,
  loadCryptoRate,
  loadDepositAddress,
  loadTransactions,
  type CryptoAsset,
  type CryptoRate,
  type CryptoTransaction,
  type DepositAddress
} from "./crypto-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function CryptoPage() {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>();
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rateAmount, setRateAmount] = useState("1");
  const [rate, setRate] = useState<CryptoRate>();
  const [rateLoading, setRateLoading] = useState(false);

  const refreshTransactions = useCallback(async () => {
    try {
      setTransactions(await loadTransactions());
    } catch {
      setTransactions([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setForbidden(false);
    Promise.all([loadAssets(), refreshTransactions()])
      .then(([assetList]) => {
        setAssets(assetList);
        setSelectedAsset((prev) => prev ?? assetList[0]?.symbol);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "We could not load crypto assets.");
        setForbidden(isForbiddenError(caught));
      })
      .finally(() => setLoading(false));
  }, [refreshTransactions]);

  useEffect(() => {
    if (!selectedAsset) return;
    setDepositAddress(null);
    void loadDepositAddress(selectedAsset)
      .then(setDepositAddress)
      .catch(() => setDepositAddress(null));
  }, [selectedAsset]);

  useEffect(() => {
    const amount = Number(rateAmount);
    if (!selectedAsset || !Number.isFinite(amount) || amount <= 0) {
      setRate(undefined);
      return;
    }
    const handle = setTimeout(() => {
      setRateLoading(true);
      void loadCryptoRate(selectedAsset, amount)
        .then(setRate)
        .catch(() => setRate(undefined))
        .finally(() => setRateLoading(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [selectedAsset, rateAmount]);

  async function generateAddress() {
    if (!selectedAsset) return;
    setGenerating(true);
    setError(undefined);
    try {
      const address = await createDepositAddress({
        asset: selectedAsset,
        idempotencyKey: crypto.randomUUID()
      });
      setDepositAddress(address);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "We could not generate a deposit address."
      );
    } finally {
      setGenerating(false);
    }
  }

  function copyAddress() {
    if (!depositAddress) return;
    void navigator.clipboard.writeText(depositAddress.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedAssetInfo = assets.find((a) => a.symbol === selectedAsset);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view crypto for this workspace. Contact your workspace owner
        if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Bitcoin className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Sell Crypto</h1>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6">
            <LoadingBlock label="Loading assets" />
          </div>
        ) : (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Asset</label>
              <select
                className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                onChange={(e) => setSelectedAsset(e.target.value)}
                value={selectedAsset ?? ""}
              >
                {assets.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.name} ({a.symbol.toUpperCase()})
                  </option>
                ))}
              </select>
              {selectedAssetInfo && (
                <p className="mt-2 text-xs text-[var(--ft-text-muted)]">
                  Minimum deposit ${selectedAssetInfo.minDepositUsd} · Network:{" "}
                  {selectedAssetInfo.defaultNetwork}
                </p>
              )}

              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                  Estimate payout for
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="h-9 w-28 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2 text-sm outline-none focus:border-[var(--ft-accent)]"
                    inputMode="decimal"
                    onChange={(e) => setRateAmount(e.target.value)}
                    value={rateAmount}
                  />
                  <span className="text-sm text-[var(--ft-text-secondary)]">
                    {selectedAssetInfo?.symbol.toUpperCase()}
                  </span>
                  {rateLoading ? (
                    <span className="text-xs text-[var(--ft-text-muted)]">Checking rate...</span>
                  ) : rate ? (
                    <span className="ml-auto text-sm font-semibold text-[var(--ft-text-primary)]">
                      ≈ {formatNaira(rate.ngnAmountMinor)}
                    </span>
                  ) : null}
                </div>
                {rate ? (
                  <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                    Rate ₦{rate.usdNgnRate.toLocaleString()}/USD · fee{" "}
                    {formatNaira(rate.feeNgnMinor)}
                  </p>
                ) : null}
              </div>

              {depositAddress ? (
                <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    Send {selectedAssetInfo?.name} ({depositAddress.network}) to:
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 text-sm break-all">{depositAddress.address}</code>
                    <Button onClick={copyAddress} variant="secondary">
                      <Copy className="size-4" />
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  {depositAddress.destinationTag && (
                    <div className="mt-2 text-xs text-[var(--ft-text-muted)]">
                      Destination tag: {depositAddress.destinationTag}
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  className="mt-4 w-full justify-center"
                  disabled={generating}
                  onClick={() => void generateAddress()}
                >
                  {generating ? "Generating..." : "Get deposit address"}
                </Button>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--ft-yellow)]" />
                Only send {selectedAssetInfo?.name ?? "the selected asset"} on the{" "}
                {depositAddress?.network ?? "listed"} network to this address. Sending any other
                asset or using the wrong network may result in permanent loss of funds.
              </div>
            </Panel>

            <Panel className="mt-6 p-5">
              <h2 className="mb-3 font-semibold">Recent deposits</h2>
              {transactions.length === 0 ? (
                <EmptyState icon={Clock} title="No deposits yet">
                  Crypto deposits you make will show up here once credited.
                </EmptyState>
              ) : (
                <div className="grid gap-2">
                  {transactions.map((t) => (
                    <div
                      className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                      key={t.id}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {formatNaira(t.amountMinor)} · {t.asset.toUpperCase()}
                        </div>
                        <div className="text-xs text-[var(--ft-text-muted)]">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge tone={t.status === "completed" ? "success" : "neutral"}>
                        {t.status}
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
