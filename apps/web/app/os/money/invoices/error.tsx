"use client";

import { useEffect } from "react";

import { Button } from "@fliptrybe/ui";

export default function InvoiceError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Invoice route error", error);
  }, [error]);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <h1 className="text-lg font-semibold">Invoices could not be loaded</h1>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          The invoice screen hit an unexpected application error. Your existing invoice data has not been altered by this screen error.
        </p>
        {error.digest ? (
          <div className="mt-4 rounded-md bg-[var(--ft-bg-muted)] p-3 font-mono text-xs text-[var(--ft-text-muted)]">
            Error ID: {error.digest}
          </div>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button onClick={() => { window.location.href = "/os"; }} variant="secondary">
            Back to Command Center
          </Button>
        </div>
      </div>
    </main>
  );
}
