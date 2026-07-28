"use client";

import { Barcode, CalendarDays, Globe2, LockKeyhole, Sparkles } from "lucide-react";

import type { VoucherRecord } from "./api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function barPattern(serial: string) {
  return Array.from(serial).map((char, index) => 2 + ((char.charCodeAt(0) + index) % 5));
}

export function VoucherCard({ voucher, className }: { voucher: VoucherRecord; className?: string }) {
  const sealed = voucher.status === "SEALED" || voucher.status === "CREATED";
  const bars = barPattern(voucher.serialNumber);

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a10] p-6 text-white shadow-[0_30px_120px_rgba(8,8,16,0.55)] ${className ?? ""}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(125,115,255,0.28),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(255,176,91,0.16),_transparent_30%)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-violet-400/80 to-transparent" />
      <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold tracking-tight">
                <span className="text-violet-400">Flip</span> Trybe
              </div>
              <div className="mt-2 text-sm uppercase tracking-[0.45em] text-white/55">Ad Campaigner</div>
            </div>
            <div className="rounded-2xl border border-violet-300/30 bg-violet-400/90 px-4 py-3 text-right text-sm text-[#161326]">
              <div className="text-xs uppercase tracking-[0.3em] text-[#27204e]/70">Card type</div>
              <div className="mt-1 text-lg font-semibold">{voucher.product.name}</div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/96 p-6 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-2xl font-semibold uppercase tracking-tight">FlipTrybe Voucher PIN</div>
            <div className="mt-5 rounded-[18px] bg-[#dedede] px-6 py-8 text-center">
              <div className="relative overflow-hidden rounded-[14px] border border-black/5 bg-[#d8d8d8] py-9">
                <div className="absolute inset-x-6 top-4 h-px bg-black/10" />
                <div className="absolute inset-x-6 bottom-4 h-px bg-black/10" />
                <div className="absolute inset-y-6 left-4 w-px bg-black/10" />
                <div className="absolute inset-y-6 right-4 w-px bg-black/10" />
                <div className="mx-auto max-w-[26rem] text-base tracking-[0.2em] text-black/40">
                  {sealed ? "SEALED — SCRATCH TO REVEAL" : voucher.pin ?? "PIN REVEALED"}
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-[0.35em] text-black/80">
                  {sealed ? "•••• •••• ••••" : voucher.pin ?? "REVEALED"}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">Scratch gently to reveal your PIN</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Date created" value={formatDate(voucher.createdAt)} />
            <Stat label="Expiry date" value={formatDate(voucher.expiresAt)} />
            <Stat label="Value" value={voucher.product.category === "CAMPAIGN" ? "N5,000" : "Flexible"} accent />
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/6 p-5 text-sm leading-6 text-white/78">
            Shareable while sealed. Send this card to anyone, on any platform. Once revealed, it can only be
            redeemed and can no longer be shared or transferred.
          </div>
        </div>

        <div className="grid gap-4 self-start">
          <div className="rounded-[22px] bg-violet-500/85 p-5 text-[#18122f]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4" />
              How to redeem
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#21173d]/80">
              Enter this PIN in FlipTrybe Ad Campaigner to credit your Campaign Wallet instantly.
            </p>
            <div className="mt-6 text-sm text-[#21173d]/80">Support</div>
            <div className="mt-1 text-2xl font-semibold">help.fliptrybe.com</div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/96 p-5 text-slate-900">
            <div className="text-sm text-slate-500">Card ID</div>
            <div className="mt-1 break-all text-xl font-semibold tracking-[0.12em]">{voucher.serialNumber}</div>
            <div className="mt-5 flex gap-1 overflow-hidden">
              {bars.map((height, index) => (
                <span
                  className="w-[3px] bg-slate-900"
                  key={`${voucher.serialNumber}-${index}`}
                  style={{ height: `${height * 10}px` }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/5 p-4 text-sm text-white/72">
            <div className="flex items-center gap-2 text-white/90">
              <LockKeyhole className="size-4 text-violet-300" />
              <span>Sealed voucher</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <CalendarDays className="size-4 text-amber-300" />
              <span>{formatDate(voucher.expiresAt)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Globe2 className="size-4 text-emerald-300" />
              <span>{voucher.product.category}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Barcode className="size-4 text-indigo-300" />
              <span>{voucher.product.handler}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/5 p-4">
      <div className="text-sm text-white/52">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${accent ? "text-violet-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
