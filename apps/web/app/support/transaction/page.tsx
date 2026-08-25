import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function TransactionSupportPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-16">
      <Link href="/support" className="text-sm font-semibold text-[var(--ft-accent)]">← Back to Support</Link>
      <div className="mt-6 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6 sm:p-8">
        <AlertTriangle className="size-7 text-amber-500" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">When a payment looks stuck</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
          A timeout, provider error or interrupted connection does not prove that the provider did not receive the request.
        </p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5"><h2 className="font-semibold">1. Stop</h2><p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">Do not submit the same financial request again.</p></article>
        <article className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5"><h2 className="font-semibold">2. Check</h2><p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">Review the transaction and Orders &amp; Activity state when available.</p></article>
        <article className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5"><h2 className="font-semibold">3. Escalate</h2><p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">Provide the transaction reference to support when the outcome remains unclear.</p></article>
      </div>
    </main>
  );
}
