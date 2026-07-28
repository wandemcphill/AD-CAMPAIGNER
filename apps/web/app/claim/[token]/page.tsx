"use client";

import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Panel } from "@fliptrybe/ui";

import { claimVoucher, loadClaimPreview, type VoucherRecord } from "../../vouchers/api";
import { VoucherCard } from "../../vouchers/voucher-card";

export default function ClaimPage({ params }: { params: { token: string } }) {
  const [voucher, setVoucher] = useState<VoucherRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadClaimPreview(params.token)
      .then(setVoucher)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Claim link not found."));
  }, [params.token]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const claimed = await claimVoucher(params.token);
      setVoucher(claimed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to claim voucher.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05050a] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.4em] text-white/45">Voucher claim</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Secure sealed card</h1>
          </div>
          <a className="inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200" href="/login">
            Sign in <ArrowRight className="size-4" />
          </a>
        </div>

        {error ? (
          <Panel className="mb-6 border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</Panel>
        ) : null}

        {voucher ? (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <VoucherCard voucher={voucher} />
            <Panel className="h-fit p-5">
              <div className="flex items-center gap-2 text-violet-300">
                <LockKeyhole className="size-4" />
                <span className="text-sm uppercase tracking-[0.35em]">Claim this voucher</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/70">
                Once you claim this card, it attaches to your workspace and can be revealed or redeemed from
                your studio wallet.
              </p>
              <div className="mt-5 grid gap-3">
                <Button disabled={busy} onClick={() => void claim()}>
                  <Sparkles className="size-4" />
                  {busy ? "Claiming..." : "Claim voucher"}
                </Button>
                <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  The claim link works while sealed. After reveal, the PIN stays in your wallet and the card is no
                  longer transferable.
                </div>
              </div>
            </Panel>
          </div>
        ) : (
          <Panel className="p-8 text-white/60">Loading claim preview...</Panel>
        )}
      </div>
    </main>
  );
}
