"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Panel, ThemeToggle } from "@fliptrybe/ui";

import { getGuestStatus } from "../../guest-checkout-api";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

export default function GuestPaymentStatusPage() {
  const router = useRouter();
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [message, setMessage] = useState("Waiting for your payment to confirm...");
  const [error, setError] = useState<string>();
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const status = await getGuestStatus(reference);

        if (cancelled) return;

        if (status.paymentStatus === "FAILED") {
          setError("Your payment did not go through. Please try again.");
          return;
        }

        if (status.paymentStatus === "PAID" && status.fulfilmentStatus === "DELIVERED") {
          router.replace(`/guest/success/${reference}`);
          return;
        }

        if (status.paymentStatus === "PAID" && status.fulfilmentStatus === "FAILED") {
          setMessage("Payment received — we hit a snag completing your order. Our team has been notified.");
          setTimeout(() => router.replace(`/guest/success/${reference}`), 2000);
          return;
        }

        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setMessage("Still processing — check your email for the receipt, or look up your reference below.");
          return;
        }

        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not check payment status.");
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] px-4 text-[var(--ft-text-primary)]">
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <Panel className="w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-[var(--ft-red)]">Payment issue</h1>
            <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">{error}</p>
            <a className="mt-6 inline-block text-sm font-medium text-[var(--ft-accent)]" href="/guest">
              Try again
            </a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-[var(--ft-accent)]" />
            <h1 className="mt-4 text-xl font-bold">Confirming your payment</h1>
            <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">{message}</p>
            <p className="mt-4 font-mono text-xs text-[var(--ft-text-muted)]">Reference: {reference}</p>
          </>
        )}
      </Panel>
    </main>
  );
}
