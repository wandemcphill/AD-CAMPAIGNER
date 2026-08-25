import Link from "next/link";

const STATES = [
  ["Pending", "Your verification is still being reviewed. Avoid restarting it unless the app explicitly asks you to."],
  ["Approved", "Verification is complete. Features that require the verified state can proceed subject to other product rules."],
  ["Rejected", "The verification attempt was not accepted. Review the reason shown in the product and correct the requested information before retrying."],
  ["Expired", "The previous verification is no longer valid. Start a fresh verification only when prompted."],
  ["Needs action", "A missing step or document requires your attention. Complete the stated action before retrying."],
  ["Restricted", "Some features may remain unavailable while verification or risk review is unresolved. Support can explain the next operational step."]
] as const;

export default function VerificationSupportPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-16">
      <Link href="/support" className="text-sm font-semibold text-[var(--ft-accent)]">← Back to Support</Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Verification states, explained</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
        Identity verification can gate higher-risk or higher-value features. The product should always show the current state and the next actionable step.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {STATES.map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">{detail}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
