"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button, ThemeToggle } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { useApiSession } from "../lib/use-session";
import { migrateGuestPurchases } from "../guest/guest-checkout-api";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const BENEFITS = [
  "One account for money, global payments and growth",
  "Track every transaction with receipts and activity history",
  "Start with one job and unlock the rest of FlipTrybe anytime",
  "Secure onboarding without repeating your details"
];

const INTENTS = [
  { id: "nigeria", label: "Send money to Nigeria", destination: "/os/money", eyebrow: "USA · UK · Europe · Canada" },
  { id: "china", label: "Pay China / buy RMB", destination: "/os/rmb", eyebrow: "RMB · suppliers · China payments" },
  { id: "crypto", label: "Buy or sell USDT / USDC", destination: "/os/crypto", eyebrow: "Stablecoins · digital dollars" },
  { id: "card", label: "Get a virtual card", destination: "/os/financial-products/cards", eyebrow: "Subscriptions · global spending" },
  { id: "giftcards", label: "Buy or sell gift cards", destination: "/os/digital-value", eyebrow: "Buy · sell · digital value" },
  { id: "travel", label: "Book travel", destination: "/os/travel", eyebrow: "Flights · hotels · tours" },
  { id: "tiktok", label: "Grow Nigerian TikTok reach", destination: "/os/growth", eyebrow: "Followers · views · LIVE" },
  { id: "campaign", label: "Launch an ad campaign", destination: "/os/campaigns/new", eyebrow: "Reach customers" }
] as const;

type IntentId = (typeof INTENTS)[number]["id"];

export default function RegisterPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signUp } = useApiSession();
  const [migrateContact, setMigrateContact] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [intent, setIntent] = useState<IntentId>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) router.replace("/onboarding");
  }, [router, session, sessionLoading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMigrateContact(params.get("migrateContact"));
    const requested = params.get("intent") as IntentId | null;
    if (requested && INTENTS.some((option) => option.id === requested)) setIntent(requested);
  }, []);

  const normalizedUsername = username.trim().toLowerCase();
  const usernameError = normalizedUsername.length === 0 ? undefined : normalizedUsername.length < USERNAME_MIN || normalizedUsername.length > USERNAME_MAX ? `Must be ${USERNAME_MIN}–${USERNAME_MAX} characters` : USERNAME_PATTERN.test(normalizedUsername) ? undefined : "Letters, numbers, periods, underscores and hyphens only";
  const normalizedEmail = email.trim().toLowerCase();
  const emailError = normalizedEmail.length === 0 || EMAIL_PATTERN.test(normalizedEmail) ? undefined : "Enter a valid email address";
  const passwordError = password.length === 0 || password.length >= PASSWORD_MIN ? undefined : `At least ${PASSWORD_MIN} characters`;
  const confirmError = confirmPassword.length === 0 || password === confirmPassword ? undefined : "Passwords do not match";
  const canSubmit = normalizedUsername.length > 0 && password.length > 0 && confirmPassword.length > 0 && !usernameError && !emailError && !passwordError && !confirmError;
  const selectedIntent = INTENTS.find((option) => option.id === intent);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await signUp({ username: normalizedUsername, password, confirmPassword, ...(displayName.trim() ? { displayName: displayName.trim() } : {}), ...(normalizedEmail ? { email: normalizedEmail } : {}) });
      if (migrateContact) {
        try { await migrateGuestPurchases(migrateContact); } catch { /* Account creation remains successful. */ }
      }
      router.replace(selectedIntent?.destination ?? "/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <div className="hidden lg:flex lg:flex-col lg:justify-center lg:gap-8 lg:px-16">
          <motion.div animate={{ opacity: 1, y: 0 }} className="max-w-md" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.5 }}>
            <img alt="FlipTrybe" className="h-8 w-auto" src="/brand/logo-horizontal-light.svg" />
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--ft-accent)]/25 bg-[var(--ft-accent-subtle)] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-accent)]">Your account. Your jobs. One operating layer.</div>
            <h2 className="mt-6 text-4xl font-black tracking-tight">Start with the thing you came here to do.</h2>
            <div className="mt-8 grid gap-3">{BENEFITS.map((item) => <div className="flex items-start gap-3 text-sm text-[var(--ft-text-secondary)]" key={item}><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ft-accent)] text-white">✓</span>{item}</div>)}</div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <motion.div animate={{ opacity: 1, y: 0 }} className="w-full max-w-[520px]" initial={{ opacity: 0, y: 12 }} transition={{ duration: 0.35, delay: 0.05 }}>
            <div className="mb-8 flex items-center justify-between lg:hidden"><img alt="FlipTrybe" className="h-7 w-auto" src="/brand/logo-horizontal-light.svg" /><ThemeToggle /></div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-xl)] sm:p-8">
              <div className="ft-eyebrow text-[var(--ft-accent)]">FlipTrybe Technology</div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">Takes less than a minute. We&apos;ll take you straight to what brought you here.</p>

              {selectedIntent ? <div className="mt-5 rounded-2xl border border-[var(--ft-accent)]/35 bg-[var(--ft-accent-subtle)] px-4 py-3 shadow-[var(--shadow-xs)]"><div className="ft-eyebrow text-[var(--ft-accent)]">Your starting point</div><div className="mt-1 font-semibold">{selectedIntent.label}</div><div className="mt-0.5 text-xs text-[var(--ft-text-secondary)]">{selectedIntent.eyebrow}</div></div> : null}

              <form className="mt-7 grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
                <Input autoComplete="username" autoFocus error={usernameError} hint="This is how you&apos;ll sign in" id="username" label="Username" onChange={(e) => setUsername(e.currentTarget.value)} placeholder="tunde" required type="text" value={username} />
                <Input autoComplete="name" hint="Optional — shown to your team and on invoices" id="display-name" label="Full name" onChange={(e) => setDisplayName(e.currentTarget.value)} placeholder="Tunde Okoro" type="text" value={displayName} />
                <Input autoComplete="email" error={emailError} hint="Optional, but needed to reset a forgotten password" id="email" label="Email" onChange={(e) => setEmail(e.currentTarget.value)} placeholder="tunde@example.com" type="email" value={email} />
                <div className="grid gap-1.5"><label className="text-sm font-medium" htmlFor="new-password">Password</label><div className="relative"><input autoComplete="new-password" className="h-11 w-full rounded-[14px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] px-4 pr-11 text-sm outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]" id="new-password" minLength={PASSWORD_MIN} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${PASSWORD_MIN} characters`} required type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{passwordError ? <span className="text-xs text-[var(--ft-red)]">{passwordError}</span> : null}</div>
                <Input autoComplete="new-password" error={confirmError} id="confirm-password" label="Confirm password" onChange={(e) => setConfirmPassword(e.currentTarget.value)} placeholder="Re-enter your password" required type="password" value={confirmPassword} />

                <div className="grid gap-2"><div><span className="text-sm font-medium">What brings you here?</span><p className="mt-1 text-xs text-[var(--ft-text-muted)]">Optional. Pick your first job and we&apos;ll take you there after signup.</p></div><div className="grid gap-2 sm:grid-cols-2">{INTENTS.map((option) => <button aria-pressed={intent === option.id} className={`ft-choice-card rounded-2xl px-3 py-3 text-left ${intent === option.id ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]" : ""}`} key={option.id} onClick={() => setIntent((prev) => prev === option.id ? undefined : option.id)} type="button"><div className="text-sm font-semibold">{option.label}</div><div className="mt-1 text-[11px] text-[var(--ft-text-muted)]">{option.eyebrow}</div></button>)}</div></div>

                {error ? <motion.div animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] px-4 py-3 text-sm text-[var(--ft-red)]" initial={{ opacity: 0, y: -4 }}>{error}</motion.div> : null}
                <Button className="ft-auth-primary h-12 w-full justify-center rounded-full" disabled={submitting || !canSubmit} type="submit">{submitting ? <><motion.div animate={{ rotate: 360 }} className="size-4 rounded-full border-2 border-white/30 border-t-white" transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />Creating account...</> : <><UserPlus className="size-4" />Create my account</>}</Button>
              </form>
              <div className="mt-6 flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center"><span className="text-[var(--ft-text-secondary)]">Already have an account?</span><a className="inline-flex items-center gap-1.5 font-medium text-[var(--ft-accent)]" href="/login">Sign in<ArrowRight className="size-3.5" /></a></div>
            </div>
            <p className="mt-6 px-2 text-center text-xs text-[var(--ft-text-muted)]">By creating an account you agree to our <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy Policy</a>.</p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
