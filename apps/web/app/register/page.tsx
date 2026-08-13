"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button, ThemeToggle } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { useApiSession } from "../lib/use-session";
import { migrateGuestPurchases } from "../guest/guest-checkout-api";

// Mirrors normalizeUsername/normalizePassword in the API's auth-session service.
// Kept in sync deliberately so the form fails fast instead of round-tripping a 400.
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;

const BENEFITS = [
  "Buy airtime, data and pay bills in seconds",
  "Send invoices and payment links",
  "Run campaigns that reach real customers",
  "Every transaction receipted and searchable"
];

export default function RegisterPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signUp } = useApiSession();
  const [migrateContact, setMigrateContact] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) {
      router.replace("/onboarding");
    }
  }, [router, session, sessionLoading]);

  useEffect(() => {
    // Read once on mount via window.location instead of useSearchParams to avoid the
    // Suspense-boundary requirement that hook carries in the App Router.
    setMigrateContact(new URLSearchParams(window.location.search).get("migrateContact"));
  }, []);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameError =
    normalizedUsername.length === 0
      ? undefined
      : normalizedUsername.length < USERNAME_MIN || normalizedUsername.length > USERNAME_MAX
        ? `Must be ${USERNAME_MIN}–${USERNAME_MAX} characters`
        : USERNAME_PATTERN.test(normalizedUsername)
          ? undefined
          : "Letters, numbers, periods, underscores and hyphens only";

  const passwordError =
    password.length === 0 || password.length >= PASSWORD_MIN
      ? undefined
      : `At least ${PASSWORD_MIN} characters`;

  const confirmError =
    confirmPassword.length === 0 || password === confirmPassword
      ? undefined
      : "Passwords do not match";

  const canSubmit =
    normalizedUsername.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !usernameError &&
    !passwordError &&
    !confirmError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      await signUp({
        username: normalizedUsername,
        password,
        confirmPassword,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {})
      });

      if (migrateContact) {
        // Best-effort — a guest's past purchases are a bonus, not a blocker on signup.
        try {
          await migrateGuestPurchases(migrateContact);
        } catch {
          // Ignore: the account is created either way; nothing for the user to act on here.
        }
      }

      router.replace("/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* Left — value proposition */}
        <div className="hidden lg:flex lg:flex-col lg:justify-center lg:gap-8 lg:px-16">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <img alt="FlipTrybe" className="h-8 w-auto" src="/brand/logo-horizontal-light.svg" />

            <h2 className="mt-10 text-4xl font-black tracking-tight">
              One account for money, services and growth.
            </h2>

            <div className="mt-8 grid gap-3">
              {BENEFITS.map((item) => (
                <div
                  className="flex items-start gap-3 text-sm text-[var(--ft-text-secondary)]"
                  key={item}
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ft-accent)] text-white">
                    <svg className="size-3" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right — signup form */}
        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <img alt="FlipTrybe" className="h-7 w-auto" src="/brand/logo-horizontal-light.svg" />
              <ThemeToggle />
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-8 shadow-[var(--shadow-lg)]">
              <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                Takes less than a minute. You can add your business details later.
              </p>

              <form className="mt-8 grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  autoComplete="username"
                  autoFocus
                  error={usernameError}
                  hint="This is how you'll sign in"
                  id="username"
                  label="Username"
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  placeholder="tunde"
                  required
                  type="text"
                  value={username}
                />

                <Input
                  autoComplete="name"
                  hint="Optional — shown to your team and on invoices"
                  id="display-name"
                  label="Full name"
                  onChange={(e) => setDisplayName(e.currentTarget.value)}
                  placeholder="Tunde Okoro"
                  type="text"
                  value={displayName}
                />

                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium text-[var(--ft-text-primary)]"
                    htmlFor="new-password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 pr-11 text-sm outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]"
                      id="new-password"
                      minLength={PASSWORD_MIN}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`At least ${PASSWORD_MIN} characters`}
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)] transition hover:text-[var(--ft-text-primary)]"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      type="button"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {passwordError ? (
                    <span className="text-xs text-[var(--ft-red)]">{passwordError}</span>
                  ) : null}
                </div>

                <Input
                  autoComplete="new-password"
                  error={confirmError}
                  id="confirm-password"
                  label="Confirm password"
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  placeholder="Re-enter your password"
                  required
                  type="password"
                  value={confirmPassword}
                />

                {error ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] px-4 py-3 text-sm text-[var(--ft-red)]"
                    initial={{ opacity: 0, y: -4 }}
                  >
                    {error}
                  </motion.div>
                ) : null}

                <Button
                  className="h-11 w-full justify-center"
                  disabled={submitting || !canSubmit}
                  type="submit"
                >
                  {submitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        className="size-4 rounded-full border-2 border-[var(--ft-text-inverse)]/30 border-t-[var(--ft-text-inverse)]"
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Create account
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                <span className="text-[var(--ft-text-secondary)]">Already have an account?</span>
                <a
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
                  href="/login"
                >
                  Sign in
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            <p className="mt-6 px-2 text-center text-xs text-[var(--ft-text-muted)]">
              By creating an account you agree to our{" "}
              <a className="underline transition hover:text-[var(--ft-text-secondary)]" href="/terms">
                Terms
              </a>{" "}
              and{" "}
              <a className="underline transition hover:text-[var(--ft-text-secondary)]" href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
