"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

/**
 * Friendly stand-in for the raw 403 the API's AgeGuard returns when a user has no
 * verified date of birth. Render this (instead of an ErrorNotice) when
 * isAgeRestrictedError(err) is true, so the customer is guided to add their DOB
 * rather than shown an infrastructure error.
 */
export function AgeGateNotice({ feature = "This feature" }: { feature?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-5">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-[var(--ft-yellow)]" />
        <div>
          <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
            Add your date of birth to continue
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            {feature} is only available to customers aged 18 and over. Add your date of birth in
            your profile — it only takes a moment and unlocks it right away.
          </p>
          <Link
            className="mt-3 inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-4 text-sm font-medium text-[var(--ft-text-inverse)] transition hover:opacity-90"
            href="/os/settings/profile"
          >
            Add date of birth
          </Link>
        </div>
      </div>
    </div>
  );
}
