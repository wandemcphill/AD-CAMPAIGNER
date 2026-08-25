import Link from "next/link";
import { ArrowRight, CircleHelp, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

import { OperationalNotice } from "../components/operational-notice";

const RECOVERY_PATHS = [
  {
    title: "A payment looks stuck",
    detail: "Check Orders & Activity before attempting another payment. An ambiguous provider response can require review rather than a second charge.",
    href: "/orders",
    icon: WalletCards
  },
  {
    title: "Verification needs attention",
    detail: "Complete or retry identity verification when FlipTrybe asks for it. Restricted features will explain the next action.",
    href: "/verification",
    icon: ShieldCheck
  },
  {
    title: "Protect my account",
    detail: "If you do not recognize an activity or security event, stop using the affected feature and contact support before retrying.",
    href: "/security",
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
          We keep money, verification and security states explicit. If an operation is uncertain, FlipTrybe will not pretend it succeeded.
        </p>
      </header>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <OperationalNotice severity="success" title="Your activity is the source of truth">
          Completed transactions appear in Orders &amp; Activity only after the platform has a durable completion state.
        </OperationalNotice>
        <OperationalNotice severity="warning" title="Do not double-submit an uncertain payment">
          A timeout or provider error can mean delivery is unknown. Check activity or wait for reconciliation before trying again.
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
          <p>Verification and restricted states always explain the next step.</p>
          <p>Provider references are retained for reconciliation and support.</p>
          <p>Ambiguous financial outcomes are routed for review instead of being reported as successful.</p>
        </div>
      </section>
    </main>
  );
}
