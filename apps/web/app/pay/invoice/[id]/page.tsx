"use client";

import { use, useEffect, useState } from "react";

import { apiRequest } from "../../../lib/api-client";

type PublicInvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
};

type PublicInvoice = {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  customerName: string;
  currency: string;
  totalMinor: number;
  dueAt: string | null;
  lineItems: PublicInvoiceLineItem[];
};

function formatMoney(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export default function PublicInvoicePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<PublicInvoice>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();

  useEffect(() => {
    apiRequest<PublicInvoice>(`/public/invoices/${encodeURIComponent(id)}`)
      .then((data) => setInvoice(data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "This invoice is not available."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    setPayError(undefined);
    setPaying(true);
    try {
      const result = await apiRequest<{ checkoutUrl: string | null }>(`/public/invoices/${encodeURIComponent(id)}/pay`, {
        method: "POST",
        body: JSON.stringify({ redirectUrl: window.location.href })
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setPayError("Could not start checkout. Please try again.");
      }
    } catch (caught) {
      setPayError(caught instanceof Error ? caught.message : "Could not start checkout. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  const alreadyPaid = invoice?.status === "PAID";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] p-4 text-[var(--ft-text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2">
          <img alt="FlipTrybe" className="size-7" src="/brand/icon-mark.svg" />
          <span className="text-sm font-bold">FlipTrybe</span>
        </div>

        {loading ? (
          <div className="mt-8 text-center text-sm text-[var(--ft-text-muted)]">Loading...</div>
        ) : error || !invoice ? (
          <div className="mt-8 text-center">
            <div className="text-base font-semibold">Invoice unavailable</div>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              {error ?? "This invoice is no longer available."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">
                Invoice {invoice.number}
              </div>
              <h1 className="mt-1 text-xl font-bold">{invoice.customerName}</h1>
            </div>

            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
              <div className="text-xs text-[var(--ft-text-muted)]">Amount due</div>
              <div className="mt-1 font-mono text-2xl font-bold">{formatMoney(invoice.totalMinor, invoice.currency)}</div>
              {invoice.dueAt ? (
                <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                  Due {new Date(invoice.dueAt).toLocaleDateString()}
                </div>
              ) : null}
            </div>

            {alreadyPaid ? (
              <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)] p-3 text-center text-sm font-medium text-[var(--ft-text-secondary)]">
                This invoice has already been paid. Thank you.
              </div>
            ) : (
              <>
                <button
                  className="mt-5 h-11 w-full rounded-[var(--radius-md)] bg-[var(--ft-accent)] text-sm font-semibold text-[var(--ft-on-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={paying}
                  onClick={() => void handlePay()}
                  type="button"
                >
                  {paying ? "Starting checkout..." : "Pay now"}
                </button>
                {payError ? (
                  <p className="mt-2 text-center text-[11px] text-[var(--ft-danger,#dc2626)]">{payError}</p>
                ) : (
                  <p className="mt-2 text-center text-[11px] text-[var(--ft-text-muted)]">
                    You'll be redirected to a secure checkout page to complete payment.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
