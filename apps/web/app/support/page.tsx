import Link from "next/link";
import { ArrowRight, CircleHelp, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

import { OperationalNotice } from "../components/operational-notice";

const RECOVERY_PATHS = [
  {
    title: "A payment looks stuck",
    detail: "Do not submit it again until the outcome is clear. Review the transaction state and use support when delivery is unknown.",
    href: "/support/transaction",
    icon: WalletCards
  },
  {
    title: "Verification needs attention",
    detail: "Pending, rejected, expired and restricted states explain what you need to do next and when you can retry.",
    href: "/support/verification",
    icon: ShieldCheck
  },
  {
    title: "Protect my account",
    detail: "Unrecognized activity should be treated as a security event. Review the guidance before retrying the affected feature.",
    href: "/support/security",
    icon: LockKeyhole
  }
] as const;

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-10 sm:px-8 lg:py-16">
      <header className="max-w-2xl">
        <div className="ft-eyebrow text-[var(--ft-accent)]">FlipTrybe Support</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Clear answers when something needs attention.</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">
          Money, verification and security states stay explicit. When an operation is uncertain, FlipTrybe does not present it as successful.
        </p>
      </header>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <OperationalNotice severity="success" title="Your activity is the source of truth">
          Completed transactions are shown only after a durable completion state is recorded.
        </OperationalNotice>
        <OperationalNotice severity="warning" title="Do not double-submit an uncertain payment">
          A timeout or provider error can mean delivery is unknown. Check the transaction state or request review first.
        </OperationalNotice>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="ft-eyebrow text-[var(--ft-text-muted)]">Recovery paths</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">What happened?</h2>
          </div>
          <CircleHelp className="size-5 text-[var(--ft-text-muted)]" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {RECOVERY_PATHS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="group rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]">
                <span className="grid size-10 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--ft-text-secondary)]">{item.detail}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ft-accent)]">
                  Continue <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 sm:p-7">
        <p className="ft-eyebrow text-[var(--ft-text-muted)]">Safety promise</p>
        <div className="mt-3 grid gap-4 text-sm leading-6 text-[var(--ft-text-secondary)] sm:grid-cols-2">
          <p>Security alerts stay separate from promotional messages.</p>
          <p>Verification and restricted states explain the next action.</p>
          <p>Provider references are retained for reconciliation and support.</p>
          <p>Ambiguous financial outcomes are routed for review instead of being reported as successful.</p>
        </div>
      </section>
    </main>
  );
}
