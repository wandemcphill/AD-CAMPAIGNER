"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Monitor, Moon, Sun } from "lucide-react";

import {
  DEFAULT_THEME,
  applyFliptrybeTheme,
  cn,
  type FliptrybeTheme
} from "@fliptrybe/ui";

/**
 * Customer preferences. Deliberately limited to settings that actually do
 * something today: appearance is real (it drives the `--ft-*` theme tokens and
 * persists to localStorage). Language and currency are NOT offered here — the
 * app ships no translations and prices in NGN only, so a picker for either
 * would imply behaviour that doesn't exist. Notification preferences already
 * have their own page, so this links there rather than duplicating the controls.
 */
const THEME_OPTIONS: Array<{
  description: string;
  icon: typeof Sun;
  label: string;
  value: FliptrybeTheme;
}> = [
  { description: "Bright surfaces, dark type", icon: Sun, label: "Light", value: "studio" },
  { description: "Dimmed surfaces, easier at night", icon: Moon, label: "Dark", value: "clay" }
];

export default function PreferencesPage() {
  // Start from the SSR default so the first paint matches the server, then sync
  // to whatever the theme script already applied (same pattern as ThemeToggle).
  const [theme, setTheme] = useState<FliptrybeTheme>(DEFAULT_THEME);

  useEffect(() => {
    const active = document.documentElement.dataset.theme;
    if (active === "studio" || active === "clay") {
      setTheme(active);
    }
  }, []);

  function choose(next: FliptrybeTheme) {
    setTheme(next);
    applyFliptrybeTheme(next);
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Monitor className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Appearance</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Choose how FlipTrybe looks on this device. Saved to this browser.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition",
                  active
                    ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]"
                    : "border-[var(--ft-border)] hover:border-[var(--ft-accent)]/40"
                )}
                key={option.value}
                onClick={() => choose(option.value)}
                type="button"
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)]",
                    active
                      ? "bg-[var(--ft-accent)] text-white"
                      : "bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
                  )}
                >
                  <option.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {option.label}
                    {active ? <Check className="size-3.5 text-[var(--ft-accent)]" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--ft-text-muted)]">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Choose which updates reach you, and where.
        </p>
        <Link
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
          href="/os/settings/notifications"
        >
          Manage notification preferences
        </Link>
      </section>
    </div>
  );
}
