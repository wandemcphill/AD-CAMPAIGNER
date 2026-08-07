"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, RotateCcw, ShoppingCart, Download } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { apiRequest, getApiBaseUrl, getStoredToken, ApiClientError } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type PaymentStatus = "PENDING" | "PAID" | "FAILED";
type FulfilmentStatus = "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED" | "REFUNDED";

interface AdminGuestTransaction {
  id: string;
  reference: string;
  email: string;
  phone: string | null;
  productType: string;
  provider: string;
  beneficiaryMasked: string;
  amountMinor: number;
  currency: string;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
}

interface AdminGuestTransactionsResponse {
  items: AdminGuestTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  PAID: "success",
  DELIVERED: "success",
  PENDING: "neutral",
  PROCESSING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral"
};

const TABS = [
  { id: "all", label: "All" },
  { id: "pending-fulfilment", label: "Pending Fulfilment" },
  { id: "failed-fulfilment", label: "Failed Fulfilment" }
];

function formatMinor(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function fetchCsvExport(query: string): Promise<Blob> {
  const token = getStoredToken();
  const response = await fetch(`${getApiBaseUrl()}/admin/guest-checkout/transactions/export?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    throw new ApiClientError(`Export failed (${response.status})`, response.status);
  }
  return response.blob();
}

export default function AdminGuestCheckoutPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("all");

  const [items, setItems] = useState<AdminGuestTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyReference, setBusyReference] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const [emailFilter, setEmailFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [referenceFilter, setReferenceFilter] = useState("");

  const buildQuery = useCallback(
    (forPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(forPage));
      params.set("pageSize", String(pageSize));
      if (tab === "pending-fulfilment") params.set("fulfilmentStatus", "PENDING");
      if (tab === "failed-fulfilment") params.set("fulfilmentStatus", "FAILED");
      if (emailFilter.trim()) params.set("email", emailFilter.trim());
      if (phoneFilter.trim()) params.set("phone", phoneFilter.trim());
      if (referenceFilter.trim()) params.set("reference", referenceFilter.trim());
      return params.toString();
    },
    [tab, emailFilter, phoneFilter, referenceFilter]
  );

  const refresh = useCallback(
    async (forPage: number) => {
      setError(undefined);
      try {
        const res = await apiRequest<AdminGuestTransactionsResponse>(
          `/admin/guest-checkout/transactions?${buildQuery(forPage)}`
        );
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load guest transactions.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh(1);
  }, [sessionLoading, session, tab, emailFilter, phoneFilter, referenceFilter, refresh]);

  async function retry(reference: string) {
    setBusyReference(reference);
    setError(undefined);
    try {
      await apiRequest(`/admin/guest-checkout/transactions/${encodeURIComponent(reference)}/retry`, {
        method: "POST"
      });
      await refresh(page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not retry this transaction.");
    } finally {
      setBusyReference(undefined);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(undefined);
    try {
      const blob = await fetchCsvExport(buildQuery(1));
      downloadBlob(blob, `guest-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export guest transactions.");
    } finally {
      setExporting(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Guest checkout auth" />;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Guest Checkout</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={exporting} onClick={() => void exportCsv()} variant="secondary">
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button disabled={loading} onClick={() => void refresh(page)} variant="secondary">
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
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent px-3 py-2 text-sm"
            onChange={(e) => setEmailFilter(e.target.value)}
            placeholder="Filter by email"
            value={emailFilter}
          />
          <input
            className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent px-3 py-2 text-sm"
            onChange={(e) => setPhoneFilter(e.target.value)}
            placeholder="Filter by phone"
            value={phoneFilter}
          />
          <input
            className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent px-3 py-2 text-sm"
            onChange={(e) => setReferenceFilter(e.target.value)}
            placeholder="Filter by reference"
            value={referenceFilter}
          />
        </div>

        <div className="mt-4 grid gap-2">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading guest transactions...</Panel>
          ) : items.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No guest transactions found.</Panel>
          ) : (
            items.map((t) => (
              <Panel className="flex items-center gap-4 p-4" key={t.id}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {t.productType} · {t.provider} · {formatMinor(t.amountMinor, t.currency)}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    {t.reference} · {t.email} · {t.beneficiaryMasked}
                  </div>
                  {t.failureReason && (
                    <div className="text-xs text-[var(--ft-red)]">{t.failureReason}</div>
                  )}
                </div>
                <Badge tone={STATUS_TONE[t.paymentStatus] ?? "neutral"}>
                  pay: {t.paymentStatus.toLowerCase()}
                </Badge>
                <Badge tone={STATUS_TONE[t.fulfilmentStatus] ?? "neutral"}>
                  fulfil: {t.fulfilmentStatus.toLowerCase()}
                </Badge>
                {t.paymentStatus === "PAID" && t.fulfilmentStatus === "FAILED" && (
                  <Button disabled={busyReference !== undefined} onClick={() => void retry(t.reference)}>
                    <RotateCcw className="size-4" /> Retry
                  </Button>
                )}
              </Panel>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--ft-text-muted)]">
          <span>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-2">
            <Button disabled={page <= 1 || loading} onClick={() => void refresh(page - 1)} variant="secondary">
              Previous
            </Button>
            <Button disabled={page >= totalPages || loading} onClick={() => void refresh(page + 1)} variant="secondary">
              Next
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
