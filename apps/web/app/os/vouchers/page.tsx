"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Plus, RefreshCw, Share2, Sparkles, Ticket } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip, ValueSkeleton, cn, humanizeStatus } from "@fliptrybe/ui";

import {
  createVoucher,
  loadVoucherProducts,
  loadVouchers,
  redeemVoucher,
  revealVoucher,
  shareVoucher,
  type VoucherProduct,
  type VoucherRecord
} from "../../vouchers/api";
import { VoucherCard } from "../../vouchers/voucher-card";
import { EmptyState, ErrorNotice, LoadingBlock, PageHeader } from "../../campaigns/components";

function statusTone(status: string): "neutral" | "success" | "warning" | "info" {
  const normalized = status.toUpperCase();

  if (normalized === "REDEEMED") return "success";
  if (normalized === "REVEALED") return "warning";
  if (normalized === "SEALED" || normalized === "CREATED") return "info";

  return "neutral";
}

export default function VouchersPage() {
  const [products, setProducts] = useState<VoucherProduct[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [shareLink, setShareLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [epinNetwork, setEpinNetwork] = useState<string>("MTN");
  const [epinValue, setEpinValue] = useState<string>("10000");
  const [dataPlanId, setDataPlanId] = useState<string>("");

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [productList, voucherList] = await Promise.all([loadVoucherProducts(), loadVouchers()]);
      setProducts(productList);
      setVouchers(voucherList);
      setSelectedProduct((current) => current || productList[0]?.id || "");
    } catch {
      setError("We could not load vouchers right now. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentProduct = useMemo(
    () => products.find((product) => product.id === selectedProduct) ?? products[0],
    [products, selectedProduct]
  );

  async function run(key: string, action: () => Promise<unknown>, failure: string) {
    setBusy(key);
    setError(undefined);
    try {
      await action();
      await refresh();
    } catch {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  }

  async function issueVoucher() {
    if (!currentProduct) return;

    const metadata: Record<string, unknown> = {};

    if (currentProduct.id === "airtime-epin-voucher") {
      metadata.network = epinNetwork;
      metadata.valueMinor = parseInt(epinValue, 10);
    } else if (currentProduct.id === "data-epin-voucher") {
      metadata.network = epinNetwork;
      metadata.providerPlanId = dataPlanId;
    }

    await run(
      "issue",
      () =>
        createVoucher({
          productId: currentProduct.id,
          giftNote: "Shared from FlipTrybe",
          ...(Object.keys(metadata).length > 0 ? { metadata } : {})
        }),
      "We could not issue that voucher. No credit has been deducted."
    );
  }

  async function onShare(voucherId: string) {
    setBusy(`share-${voucherId}`);
    setError(undefined);
    try {
      const result = await shareVoucher(voucherId);
      setShareLink(result.claimUrl);
      setCopied(false);
    } catch {
      setError("We could not create a share link for this voucher.");
    } finally {
      setBusy(undefined);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
    } catch {
      setError("Copying failed — select the link and copy it manually.");
    }
  }

  const sealedCount = vouchers.filter(
    (voucher) => voucher.status === "SEALED" || voucher.status === "CREATED"
  ).length;
  const redeemedCount = vouchers.filter((voucher) => voucher.status === "REDEEMED").length;

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Button disabled={!currentProduct || busy === "issue"} onClick={() => void issueVoucher()}>
              <Plus className="size-4 stroke-[1.5]" />
              {busy === "issue" ? "Issuing..." : "Issue voucher"}
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Voucher engine</Badge>
            <Badge tone="neutral">Sealed credit</Badge>
          </>
        }
        title="Campaign Credit Cards"
      />

      <ErrorNotice message={error} />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "vouchers issued", value: loading ? <ValueSkeleton width="w-10" /> : vouchers.length },
            { label: "still sealed", value: loading ? <ValueSkeleton width="w-10" /> : sealedCount },
            { label: "redeemed", value: loading ? <ValueSkeleton width="w-10" /> : redeemedCount },
            { label: "products available", value: loading ? <ValueSkeleton width="w-10" /> : products.length }
          ]}
        />
      </section>

      {shareLink ? (
        <section className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
            <Share2 className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
            Share link ready
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="h-10 flex-1 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 font-mono text-xs text-[var(--ft-text-primary)] outline-none"
              readOnly
              value={shareLink}
            />
            <Button onClick={() => void copyShareLink()} variant="secondary">
              {copied ? <Check className="size-4 stroke-[1.5]" /> : <Copy className="size-4 stroke-[1.5]" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button onClick={() => setShareLink(undefined)} variant="ghost">
              Dismiss
            </Button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
            The recipient can claim this voucher while the PIN stays sealed.
          </p>
        </section>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Products</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Choose what the next sealed voucher should carry.
              </p>
            </div>
            <Ticket className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>

          <div className="mt-5 grid gap-2">
            {loading ? (
              <LoadingBlock label="Loading products" />
            ) : products.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border)] p-6 text-center text-sm text-[var(--ft-text-muted)]">
                No voucher products are available yet.
              </div>
            ) : (
              products.map((product) => (
                <button
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-4 py-3 text-left transition",
                    selectedProduct === product.id
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]"
                      : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]"
                  )}
                  key={product.id}
                  onClick={() => setSelectedProduct(product.id)}
                  type="button"
                >
                  <div className="font-medium text-[var(--ft-text-primary)]">{product.name}</div>
                  <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    {product.category} · {product.handler}
                  </div>
                </button>
              ))
            )}
          </div>

          <p className="mt-5 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
            Issue a voucher, share it while sealed, then reveal and redeem from this same view.
          </p>

          {currentProduct?.id === "airtime-epin-voucher" && (
            <div className="mt-5 grid gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-[var(--ft-text-primary)]">Network</span>
                <select
                  className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  value={epinNetwork}
                  onChange={(e) => setEpinNetwork(e.target.value)}
                >
                  <option value="MTN">MTN</option>
                  <option value="GLO">Glo</option>
                  <option value="AIRTEL">Airtel</option>
                  <option value="NINE_MOBILE">9mobile</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-[var(--ft-text-primary)]">Value (₦)</span>
                <select
                  className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  value={epinValue}
                  onChange={(e) => setEpinValue(e.target.value)}
                >
                  <option value="10000">₦100</option>
                  <option value="20000">₦200</option>
                  <option value="50000">₦500</option>
                </select>
              </label>
            </div>
          )}

          {currentProduct?.id === "data-epin-voucher" && (
            <div className="mt-5 grid gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-[var(--ft-text-primary)]">Network</span>
                <select
                  className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  value={epinNetwork}
                  onChange={(e) => setEpinNetwork(e.target.value)}
                >
                  <option value="MTN">MTN</option>
                  <option value="GLO">Glo</option>
                  <option value="AIRTEL">Airtel</option>
                  <option value="NINE_MOBILE">9mobile</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="text-[var(--ft-text-primary)]">Data Plan ID</span>
                <input
                  className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  placeholder="e.g. 1000 for MTN 1GB"
                  type="text"
                  value={dataPlanId}
                  onChange={(e) => setDataPlanId(e.target.value)}
                />
              </label>
            </div>
          )}
        </Panel>

        <div className="grid gap-5">
          {loading ? (
            <Panel className="p-4">
              <LoadingBlock label="Loading vouchers" />
            </Panel>
          ) : vouchers.length === 0 ? (
            <Panel className="p-4">
              <EmptyState
                action={
                  <Button
                    disabled={!currentProduct || busy === "issue"}
                    onClick={() => void issueVoucher()}
                  >
                    <Plus className="size-4 stroke-[1.5]" />
                    Issue voucher
                  </Button>
                }
                copy="Issue a sealed voucher and it will appear here instantly."
                icon={Sparkles}
                title="No vouchers yet"
              />
            </Panel>
          ) : (
            vouchers.map((voucher) => (
              <div className="grid gap-3" key={voucher.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(voucher.status)}>{humanizeStatus(voucher.status)}</Badge>
                  <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    {voucher.serialNumber}
                  </span>
                  <span className="text-sm text-[var(--ft-text-secondary)]">
                    {voucher.product.name}
                  </span>
                </div>
                <VoucherCard voucher={voucher} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy === `share-${voucher.id}`}
                    onClick={() => void onShare(voucher.id)}
                    variant="secondary"
                  >
                    <Share2 className="size-4 stroke-[1.5]" />
                    {busy === `share-${voucher.id}` ? "Creating link..." : "Share"}
                  </Button>
                  <Button
                    disabled={busy === `reveal-${voucher.id}`}
                    onClick={() =>
                      void run(
                        `reveal-${voucher.id}`,
                        () => revealVoucher(voucher.id),
                        "We could not reveal this voucher PIN."
                      )
                    }
                    variant="secondary"
                  >
                    <Eye className="size-4 stroke-[1.5]" />
                    {busy === `reveal-${voucher.id}` ? "Revealing..." : "Reveal PIN"}
                  </Button>
                  <Button
                    disabled={busy === `redeem-${voucher.id}` || voucher.status === "REDEEMED"}
                    onClick={() =>
                      void run(
                        `redeem-${voucher.id}`,
                        () => redeemVoucher(voucher.id, { redeemedBy: "Studio" }),
                        "We could not redeem this voucher. No credit has moved."
                      )
                    }
                  >
                    <Sparkles className="size-4 stroke-[1.5]" />
                    {voucher.status === "REDEEMED"
                      ? "Redeemed"
                      : busy === `redeem-${voucher.id}`
                        ? "Redeeming..."
                        : "Redeem"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
