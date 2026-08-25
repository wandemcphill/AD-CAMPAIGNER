import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SecuritySupportPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-16">
      <Link href="/support" className="text-sm font-semibold text-[var(--ft-accent)]">← Back to Support</Link>
      <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 sm:p-8">
        <ShieldAlert className="size-7 text-red-500" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Protect your account</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
          Security notifications are separate from promotional communications. A security event should be treated as an operational alert, not as an ordinary marketing message.
        </p>
      </div>
      <section className="mt-8 space-y-4 text-sm leading-6 text-[var(--ft-text-secondary)]">
        <p>Do not repeat a financial operation that has an uncertain outcome. Check the recorded transaction state first.</p>
        <p>Do not share passwords, one-time codes, recovery links or private provider references with someone claiming to represent support.</p>
        <p>When an activity is unrecognized, secure the affected session or account and contact support with the transaction or event reference.</p>
      </section>
    </main>
  );
}
