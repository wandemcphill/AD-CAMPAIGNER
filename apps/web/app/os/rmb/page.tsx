"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Clock, Landmark, QrCode, X } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";

import { EmptyState, LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import {
  createOrder,
  loadOrders,
  loadRates,
  uploadQrCode,
  type RmbAccountType,
  type RmbChannel,
  type RmbOrder,
  type RmbRatesSnapshot
} from "./rmb-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

const CHANNEL_LABELS: Record<RmbChannel, string> = {
  alipay: "Alipay",
  wechat: "WeChat Pay",
  bank: "Chinese Bank Account"
};

export default function RmbPage() {
  const [rates, setRates] = useState<RmbRatesSnapshot>();
  const [orders, setOrders] = useState<RmbOrder[]>([]);
  const [channel, setChannel] = useState<RmbChannel>("alipay");
  const [accountType, setAccountType] = useState<RmbAccountType>("nigerian");
  const [rmbAmount, setRmbAmount] = useState<number>(500);
  const [recipientName, setRecipientName] = useState("");
  const [recipientIdentifier, setRecipientIdentifier] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [description, setDescription] = useState("");
  const [qrFile, setQrFile] = useState<File>();
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>();
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [success, setSuccess] = useState<RmbOrder>();

  useEffect(() => {
    setLoading(true);
    setForbidden(false);
    Promise.all([loadRates(), loadOrders()])
      .then(([r, o]) => {
        setRates(r);
        setOrders(o);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "We could not load rates.");
        setForbidden(isForbiddenError(caught));
      })
      .finally(() => setLoading(false));
  }, []);

  const channelRates = rates?.channels.find((c) => c.channel === channel);
  const isBank = channel === "bank";

  const tier = useMemo(() => {
    if (!channelRates) return undefined;
    const source = channelRates.accountTypes.find((a) => a.type === accountType)?.rates ?? channelRates.rates;
    return source.find((t) => rmbAmount >= t.minRmb && (t.maxRmb === null || rmbAmount <= t.maxRmb));
  }, [channelRates, accountType, rmbAmount]);

  const estimatedNgnMinor = tier ? Math.round(rmbAmount * tier.ngnPerRmb * 100) : undefined;

  function selectQrFile(file: File | undefined) {
    setQrFile(file);
    setQrPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : undefined;
    });
  }

  async function submit() {
    if (!recipientName.trim() || !description.trim() || rmbAmount <= 0) return;
    if (isBank && (!bankName.trim() || !bankAccount.trim())) return;
    if (!isBank && !recipientIdentifier.trim() && !qrFile) return;

    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      let qrCodeUrl: string | undefined;
      if (!isBank && qrFile) {
        setUploadingQr(true);
        try {
          qrCodeUrl = await uploadQrCode(qrFile);
        } finally {
          setUploadingQr(false);
        }
      }

      const order = await createOrder({
        channel,
        ...(channel !== "bank" ? { accountType } : {}),
        ...(qrCodeUrl ? { qrCodeUrl } : {}),
        rmbAmount,
        recipientName: recipientName.trim(),
        ...(recipientIdentifier.trim() ? { recipientIdentifier: recipientIdentifier.trim() } : {}),
        ...(bankName.trim() ? { recipientBankName: bankName.trim() } : {}),
        ...(bankAccount.trim() ? { recipientBankAccountNumber: bankAccount.trim() } : {}),
        description: description.trim(),
        idempotencyKey: crypto.randomUUID()
      });
      setSuccess(order);
      setRecipientName("");
      setRecipientIdentifier("");
      setBankName("");
      setBankAccount("");
      setDescription("");
      selectQrFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOrders(await loadOrders());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not submit this order. No wallet balance has moved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view RMB for this workspace. Contact your workspace owner
        if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Banknote className="size-5 text-[var(--ft-accent)]" />
          <div><h1 className="text-xl font-bold">Buy RMB & pay China</h1><p className="mt-1 text-sm text-[var(--ft-text-muted)]">Buy Chinese yuan for supported Alipay, WeChat Pay and Chinese bank-account payments.</p></div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-3 text-center"><div className="text-sm font-semibold">¥ RMB</div><div className="mt-1 text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Buy</div></div><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-3 text-center"><div className="text-sm font-semibold">Alipay</div><div className="mt-1 text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Pay</div></div><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-3 text-center"><div className="text-sm font-semibold">WeChat</div><div className="mt-1 text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Pay</div></div></div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6">
            <LoadingBlock label="Loading rates" />
          </div>
        ) : success ? (
          <Panel className="mt-6 p-6 text-center">
            <Landmark className="mx-auto size-10 text-[var(--ft-green)]" />
            <h2 className="mt-3 text-lg font-semibold">Order submitted</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              {formatNaira(success.ngnAmountMinor)} debited for ¥{success.rmbAmount} to{" "}
              {success.recipientName}.
            </p>
            <Button className="mt-4" onClick={() => setSuccess(undefined)} variant="secondary">
              Buy another
            </Button>
          </Panel>
        ) : (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {(["alipay", "wechat", "bank"] as RmbChannel[]).map((c) => (
                  <button
                    className={cn(
                      "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                      channel === c
                        ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                        : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                    )}
                    disabled={!rates?.channels.find((r) => r.channel === c)?.isAvailable}
                    key={c}
                    onClick={() => setChannel(c)}
                    type="button"
                  >
                    {CHANNEL_LABELS[c]}
                  </button>
                ))}
              </div>

              {!isBank && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["nigerian", "chinese"] as RmbAccountType[]).map((t) => (
                    <button
                      className={cn(
                        "rounded-[var(--radius-md)] border py-2 text-sm font-medium transition",
                        accountType === t
                          ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                          : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/30"
                      )}
                      key={t}
                      onClick={() => setAccountType(t)}
                      type="button"
                    >
                      {t === "nigerian" ? "Nigerian account" : "Chinese account"}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Amount (¥)</label>
                <input
                  className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                  min={rates?.limits.minRmb}
                  max={rates?.limits.maxRmb}
                  onChange={(e) => setRmbAmount(Number(e.target.value))}
                  type="number"
                  value={rmbAmount}
                />
                {tier && estimatedNgnMinor !== undefined && (
                  <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                    Rate ₦{tier.ngnPerRmb}/¥ · You pay {formatNaira(estimatedNgnMinor)}
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Recipient name</label>
                <input
                  className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Zhang Wei"
                  value={recipientName}
                />
              </div>

              {isBank ? (
                <>
                  <div className="mt-4">
                    <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Bank name</label>
                    <input
                      className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                      onChange={(e) => setBankName(e.target.value)}
                      value={bankName}
                    />
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Bank account number</label>
                    <input
                      className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                      onChange={(e) => setBankAccount(e.target.value)}
                      value={bankAccount}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4">
                    <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                      Receive QR code {recipientIdentifier.trim() ? "(optional)" : ""}
                    </label>
                    {qrPreviewUrl ? (
                      <div className="relative mt-1 w-fit">
                        <img
                          alt="QR code preview"
                          className="h-40 w-40 rounded-[var(--radius-md)] border border-[var(--ft-border)] object-contain"
                          src={qrPreviewUrl}
                        />
                        <button
                          className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[var(--ft-bg-raised)] text-[var(--ft-text-muted)] shadow-[var(--shadow-sm)] hover:text-[var(--ft-text-primary)]"
                          onClick={() => {
                            selectQrFile(undefined);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          type="button"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="mt-1 flex h-24 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border)] text-sm text-[var(--ft-text-muted)] hover:border-[var(--ft-accent)]/50"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        <QrCode className="size-4" />
                        Upload the recipient&apos;s receive QR code
                      </button>
                    )}
                    <input
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => selectQrFile(e.target.files?.[0])}
                      ref={fileInputRef}
                      type="file"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                      {channel === "wechat" ? "WeChat ID" : "Alipay account ID / email / phone"}{" "}
                      {qrFile ? "(optional)" : ""}
                    </label>
                    <input
                      className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                      onChange={(e) => setRecipientIdentifier(e.target.value)}
                      value={recipientIdentifier}
                    />
                  </div>
                </>
              )}

              <div className="mt-4">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Description</label>
                <input
                  className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Invoice #2025-0045"
                  value={description}
                />
              </div>

              <Button
                className="mt-4 w-full justify-center"
                disabled={
                  submitting ||
                  uploadingQr ||
                  !recipientName.trim() ||
                  !description.trim() ||
                  rmbAmount <= 0 ||
                  (isBank
                    ? !bankName.trim() || !bankAccount.trim()
                    : !recipientIdentifier.trim() && !qrFile)
                }
                onClick={() => void submit()}
              >
                {uploadingQr
                  ? "Uploading QR code..."
                  : submitting
                    ? "Processing..."
                    : `Buy ¥${rmbAmount.toLocaleString()}`}
              </Button>
            </Panel>

            <Panel className="mt-6 p-5">
              <h2 className="mb-3 font-semibold">Recent orders</h2>
              {orders.length === 0 ? (
                <EmptyState copy="RMB orders you place will show up here." icon={Clock} title="No orders yet" />
              ) : (
                <div className="grid gap-2">
                  {orders.map((o) => (
                    <div
                      className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                      key={o.id}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {formatNaira(o.ngnAmountMinor)} · ¥{o.rmbAmount}
                        </div>
                        <div className="text-xs text-[var(--ft-text-muted)]">
                          {o.recipientName} · {new Date(o.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge tone={o.status === "COMPLETED" ? "success" : "neutral"}>
                        {o.status.toLowerCase()}
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
