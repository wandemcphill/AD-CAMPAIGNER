"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, RefreshCcw, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type GiftCardSellStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "FLAGGED_FOR_REVIEW"
  | "REJECTED"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED";

type AirtimeCashoutStatus =
  | "INITIATED"
  | "OTP_VERIFIED"
  | "QUOTED"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

interface GiftCardSellRow {
  id: string;
  workspaceId: string;
  brand: string;
  region: string;
  denomination: number;
  currency: string;
  providerName: string;
  quotedCustomerPayoutNgn: number;
  status: GiftCardSellStatus;
  validationStatus: string;
  fraudScore: number;
  approvalRequestId: string | null;
  createdAt: string;
}

interface AirtimeCashoutRow {
  id: string;
  workspaceId: string;
  network: string;
  phoneNumberMasked: string;
  providerName: string;
  requestedAmountNgn: number;
  customerPayoutNgn: number;
  status: AirtimeCashoutStatus;
  createdAt: string;
}

type CryptoTransactionStatus = "pending" | "confirmed" | "credited" | "failed";

interface CryptoTransactionRow {
  id: string;
  workspaceId: string;
  providerName: string;
  txHash: string | null;
  amountMinor: number;
  currency: string;
  status: CryptoTransactionStatus;
  createdAt: string;
}

type RmbOrderStatus = "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

interface RmbOrderRow {
  id: string;
  workspaceId: string;
  providerName: string;
  channel: "ALIPAY" | "WECHAT" | "BANK";
  rmbAmount: string;
  ngnAmountMinor: number;
  recipientName: string;
  status: RmbOrderStatus;
  createdAt: string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  COMPLETED: "success",
  SUBMITTED: "neutral",
  DRAFT: "neutral",
  PENDING_VALIDATION: "neutral",
  QUOTED: "neutral",
  OTP_VERIFIED: "neutral",
  INITIATED: "neutral",
  FLAGGED_FOR_REVIEW: "warning",
  FAILED: "danger",
  REJECTED: "danger",
  CANCELLED: "neutral",
  pending: "neutral",
  confirmed: "neutral",
  credited: "success",
  PROCESSING: "neutral",
  REFUNDED: "neutral"
};

const TABS = [
  { id: "gift-cards", label: "Gift Card Sells" },
  { id: "airtime", label: "Airtime Cashout" },
  { id: "crypto", label: "Crypto Sells" },
  { id: "rmb", label: "RMB Orders" }
];

function formatNaira(amountNgn: number) {
  return `₦${amountNgn.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminDigitalValuePage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("gift-cards");

  const [giftCardSells, setGiftCardSells] = useState<GiftCardSellRow[]>([]);
  const [airtimeCashouts, setAirtimeCashouts] = useState<AirtimeCashoutRow[]>([]);
  const [cryptoTransactions, setCryptoTransactions] = useState<CryptoTransactionRow[]>([]);
  const [rmbOrders, setRmbOrders] = useState<RmbOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [giftCardsRes, airtimeRes, cryptoRes, rmbRes] = await Promise.all([
        apiRequest<GiftCardSellRow[]>("/admin/digital-value/gift-cards/sell"),
        apiRequest<AirtimeCashoutRow[]>("/admin/digital-value/airtime/cashout"),
        apiRequest<CryptoTransactionRow[]>("/admin/crypto/transactions"),
        apiRequest<RmbOrderRow[]>("/admin/rmb/orders")
      ]);
      setGiftCardSells(giftCardsRes);
      setAirtimeCashouts(airtimeRes);
      setCryptoTransactions(cryptoRes);
      setRmbOrders(rmbRes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load digital value data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
  }, [sessionLoading, session, refresh]);

  async function decideFlagged(approvalId: string, approve: boolean) {
    setBusyId(approvalId);
    setError(undefined);
    try {
      await apiRequest(`/admin/digital-value/gift-cards/sell/${encodeURIComponent(approvalId)}/decide`, {
        method: "POST",
        body: JSON.stringify({ approve })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not decide this review.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Digital value auth" />;
  }

  const flaggedCount = giftCardSells.filter((g) => g.status === "FLAGGED_FOR_REVIEW").length;

  return (
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Digital Value — Gift Cards &amp; Airtime</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <TabBar
            items={TABS.map((t) =>
              t.id === "gift-cards" ? { ...t, count: flaggedCount } : t
            )}
            onChange={setTab}
            value={tab}
          />
        </div>

        {tab === "gift-cards" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading gift card sells...</Panel>
            ) : giftCardSells.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No gift card sell transactions yet.</Panel>
            ) : (
              giftCardSells.map((g) => (
                <Panel className="flex items-center gap-4 p-4" key={g.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {g.brand} {g.region} · ${g.denomination} · {formatNaira(g.quotedCustomerPayoutNgn)}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {g.providerName} · fraud score {g.fraudScore} · {new Date(g.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[g.status] ?? "neutral"}>{g.status.toLowerCase().replace(/_/g, " ")}</Badge>
                  {g.status === "FLAGGED_FOR_REVIEW" && g.approvalRequestId && (
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-[var(--ft-yellow)]" />
                      <Button
                        disabled={busyId !== undefined}
                        onClick={() => void decideFlagged(g.approvalRequestId!, false)}
                        variant="secondary"
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={busyId !== undefined}
                        onClick={() => void decideFlagged(g.approvalRequestId!, true)}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "airtime" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading airtime cashouts...</Panel>
            ) : airtimeCashouts.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No airtime cashout transactions yet.</Panel>
            ) : (
              airtimeCashouts.map((a) => (
                <Panel className="flex items-center gap-4 p-4" key={a.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {a.network} · {a.phoneNumberMasked} · {formatNaira(a.customerPayoutNgn)}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {a.providerName} · requested {formatNaira(a.requestedAmountNgn)} ·{" "}
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.toLowerCase().replace(/_/g, " ")}</Badge>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "crypto" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading crypto sell transactions...</Panel>
            ) : cryptoTransactions.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No crypto sell transactions yet.</Panel>
            ) : (
              cryptoTransactions.map((c) => (
                <Panel className="flex items-center gap-4 p-4" key={c.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {formatNaira(c.amountMinor / 100)} {c.currency}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {c.providerName}
                      {c.txHash ? ` · ${c.txHash.slice(0, 10)}...` : ""} · {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "rmb" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading RMB orders...</Panel>
            ) : rmbOrders.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No RMB orders yet.</Panel>
            ) : (
              rmbOrders.map((r) => (
                <Panel className="flex items-center gap-4 p-4" key={r.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      ¥{r.rmbAmount} · {formatNaira(r.ngnAmountMinor / 100)} · {r.recipientName}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {r.channel} · {r.providerName} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Badge>
                </Panel>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
