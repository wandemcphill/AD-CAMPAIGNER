"use client";

import { useEffect } from "react";

import { Button } from "@fliptrybe/ui";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced for local/dev debugging only.
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ft-bg-base)] px-6 py-16 text-[var(--ft-text-primary)]">
      <div className="relative mx-auto grid max-w-md place-items-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full border border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)]">
          <svg aria-hidden="true" className="size-6 text-[var(--ft-red)]" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 9v4m0 4h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </div>
        <h1 className="mt-4 text-base font-medium text-[var(--ft-text-primary)]">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
          An unexpected error interrupted this page. You can try again, or head back to the command
          center if the problem continues.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => reset()} type="button">
            Try again
          </Button>
          <Button
            onClick={() => {
              window.location.href = "/os";
            }}
            type="button"
            variant="secondary"
          >
            Back to Command Center
          </Button>
        </div>
      </div>
    </main>
  );
}
