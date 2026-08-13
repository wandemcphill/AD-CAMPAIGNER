"use client";

import { use, useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

type PublicPaymentLink = {
  reference: string;
  title: string;
  description: string | null;
  amountMinor: number | null;
  currency: string;
  collectCustomerInfo: boolean;
};

function formatMoney(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export default function PublicPaymentLinkPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [link, setLink] = useState<PublicPaymentLink>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string>();

  useEffect(() => {
    apiRequest<PublicPaymentLink>(`/public/payment-links/${encodeURIComponent(reference)}`)
      .then((data) => setLink(data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "This payment link is not available."))
      .finally(() => setLoading(false));
  }, [reference]);

  async function handlePay() {
    setPayError(undefined);
    setPaying(true);
    try {
      const result = await apiRequest<{ checkoutUrl: string }>(`/public/payment-links/${encodeURIComponent(reference)}/pay`, {
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

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] p-4 text-[var(--ft-text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2">
          <img alt="FlipTrybe" className="size-7" src="/brand/icon-mark.svg" />
          <span className="text-sm font-bold">FlipTrybe</span>
        </div>

        {loading ? (
          <div className="mt-8 text-center text-sm text-[var(--ft-text-muted)]">Loading...</div>
        ) : error || !link ? (
          <div className="mt-8 text-center">
            <div className="text-base font-semibold">Link unavailable</div>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              {error ?? "This payment link is no longer available."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">Payment request</div>
              <h1 className="mt-1 text-xl font-bold">{link.title}</h1>
              {link.description ? (
                <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">{link.description}</p>
              ) : null}
            </div>

            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
              <div className="text-xs text-[var(--ft-text-muted)]">Amount</div>
              <div className="mt-1 font-mono text-2xl font-bold">
                {link.amountMinor === null ? "You choose" : formatMoney(link.amountMinor, link.currency)}
              </div>
            </div>

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
      </div>
    </main>
  );
}
