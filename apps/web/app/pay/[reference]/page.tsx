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

  useEffect(() => {
    apiRequest<PublicPaymentLink>(`/public/payment-links/${encodeURIComponent(reference)}`)
      .then((data) => setLink(data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "This payment link is not available."))
      .finally(() => setLoading(false));
  }, [reference]);

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

            {/* Honest state: the link resolves and shows what is owed, but live
                payment collection is not wired to a gateway yet. Do not present a
                pay button that would imply a completed payment. */}
            <button
              className="mt-5 h-11 w-full cursor-not-allowed rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)] text-sm font-medium text-[var(--ft-text-muted)]"
              disabled
              type="button"
            >
              Secure checkout coming soon
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--ft-text-muted)]">
              Online payment for this link is being set up.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
