"use client";

import { ArrowRight, Copy, Plus, RefreshCw, Share2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { createVoucher, loadVoucherProducts, loadVouchers, redeemVoucher, revealVoucher, shareVoucher, type VoucherProduct, type VoucherRecord } from "./api";
import { VoucherCard } from "./voucher-card";

export default function VouchersPage() {
  const [products, setProducts] = useState<VoucherProduct[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [productList, voucherList] = await Promise.all([loadVoucherProducts(), loadVouchers()]);
    setProducts(productList);
    setVouchers(voucherList);
    setSelectedProduct((current) => current || productList[0]?.id || "");
  }

  useEffect(() => {
    void refresh();
  }, []);

  const currentProduct = useMemo(
    () => products.find((product) => product.id === selectedProduct) ?? products[0],
    [products, selectedProduct]
  );

  async function issue() {
    if (!currentProduct) return;
    setBusy(true);
    try {
      await createVoucher({ productId: currentProduct.id, giftNote: "Shared from FlipTrybe" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onShare(voucherId: string) {
    await shareVoucher(voucherId);
  }

  async function onReveal(voucherId: string) {
    await revealVoucher(voucherId);
    await refresh();
  }

  async function onRedeem(voucherId: string) {
    await redeemVoucher(voucherId, { redeemedBy: "Studio" });
    await refresh();
  }

  return (
    <main className="min-h-screen bg-[#05050a] text-white">
      <div className="border-b border-white/10 bg-white/3 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.4em] text-white/45">Wallet</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Voucher engine</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button onClick={() => void issue()} disabled={!currentProduct || busy}>
              <Plus className="size-4" />
              {busy ? "Issuing..." : "Issue voucher"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/50">Products</div>
              <div className="mt-1 text-xl font-semibold">Create sealed credit</div>
            </div>
            <Badge tone="info">{products.length} live</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {products.map((product) => (
              <button
                className={`rounded-[18px] border px-4 py-4 text-left transition ${
                  selectedProduct === product.id
                    ? "border-violet-400/70 bg-violet-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                }`}
                key={product.id}
                onClick={() => setSelectedProduct(product.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{product.name}</div>
                    <div className="mt-1 text-sm text-white/52">
                      {product.category} · {product.handler}
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-white/35" />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-white/65">
            Issue a voucher, share it while sealed, then reveal and redeem from the same wallet view.
          </div>
        </Panel>

        <div className="grid gap-5">
          {vouchers.length === 0 ? (
            <Panel className="p-8 text-center text-white/60">
              <Sparkles className="mx-auto size-8 text-violet-300" />
              <div className="mt-4 text-xl font-semibold text-white">No vouchers yet</div>
              <p className="mt-2">Issue a sealed voucher and the wallet will populate instantly.</p>
            </Panel>
          ) : (
            vouchers.map((voucher) => (
              <div className="grid gap-3" key={voucher.id}>
                <VoucherCard voucher={voucher} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void onShare(voucher.id)} variant="secondary">
                    <Share2 className="size-4" />
                    Share
                  </Button>
                  <Button onClick={() => void onReveal(voucher.id)} variant="secondary">
                    <Copy className="size-4" />
                    Reveal PIN
                  </Button>
                  <Button onClick={() => void onRedeem(voucher.id)}>
                    <Sparkles className="size-4" />
                    Redeem
                  </Button>
                </div>
              </div>
            ))
          )}
          <div className="rounded-[18px] border border-white/10 bg-white/5 p-5 text-sm text-white/60">
            <a className="inline-flex items-center gap-2 text-violet-300 hover:text-violet-200" href="/claim/demo">
              Public claim experience <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
