"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Badge, Button, ThemeToggle } from "@fliptrybe/ui";
import { Input, Divider } from "@fliptrybe/ui/components";

import { useApiSession } from "../lib/use-session";
import { migrateGuestPurchases } from "../guest/guest-checkout-api";

const RECOVERY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite food?",
];

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.1, 0.35, 0.1] }}
          className="absolute rounded-full bg-[var(--ft-accent)]"
          initial={{ opacity: 0 }}
          key={i}
          style={{
            width: `${2 + (i % 3) * 2}px`,
            height: `${2 + (i % 3) * 2}px`,
            left: `${8 + (i * 5.2) % 85}%`,
            top: `${15 + (i * 6.1) % 70}%`,
          }}
          transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signUp } = useApiSession();
  const [migrateContact, setMigrateContact] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState(RECOVERY_QUESTIONS[0]);
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
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

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const pinValid = recoveryPin.length === 0 || /^\d{4,6}$/.test(recoveryPin);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (recoveryPin && !/^\d{4,6}$/.test(recoveryPin)) {
      setError("Recovery PIN must be 4-6 digits.");
      return;
    }

    setSubmitting(true);

    try {
      await signUp({
        username,
        password,
        confirmPassword,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <FloatingParticles />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* Left — branding */}
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid max-w-md gap-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto grid size-20 place-items-center rounded-[var(--radius-xl)] border border-[var(--ft-accent)]/30 bg-[var(--ft-accent)]/10 shadow-[0_0_60px_var(--ft-accent-glow)]">
              <Sparkles className="size-8 text-[var(--ft-accent)]" />
            </div>

            <div>
              <h2 className="text-4xl font-bold tracking-tight">Start growing</h2>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                Your AI workspace is one step away
              </p>
            </div>

            <p className="text-sm leading-7 text-[var(--ft-text-secondary)]">
              After signup, FlipTrybe AI automatically provisions your workspace,
              wallet, campaign space, AI studio, and default settings.
            </p>

            <div className="grid gap-2 text-left">
              {[
                "AI-powered campaign creation",
                "Automated wallet & billing",
                "Growth services marketplace",
                "Creative production studio",
              ].map((item) => (
                <div className="flex items-center gap-3 text-sm text-[var(--ft-text-secondary)]" key={item}>
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ft-accent)] text-[var(--ft-text-inverse)]">
                    <svg className="size-3" fill="none" viewBox="0 0 12 12">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
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
            className="w-full max-w-[440px]"
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Mobile logo */}
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <img alt="FlipTrybe" className="size-9" src="/brand/icon-mark.svg" />
                <span className="text-lg font-bold">FlipTrybe</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-8 shadow-[var(--shadow-lg)]">
              <Badge tone="info">Create workspace</Badge>

              <h1 className="mt-5 text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                Set up your identity and workspace in one step
              </p>

              <form className="mt-8 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    autoComplete="username"
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
                    id="display-name"
                    label="Display name"
                    onChange={(e) => setDisplayName(e.currentTarget.value)}
                    placeholder="Tunde Okoro"
                    type="text"
                    value={displayName}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="new-password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 pr-11 text-sm outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]"
                      id="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      type="button"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Input
                  autoComplete="new-password"
                  error={!passwordsMatch ? "Passwords do not match" : undefined}
                  id="confirm-password"
                  label="Confirm password"
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  placeholder="Re-enter your password"
                  required
                  type="password"
                  value={confirmPassword}
                />

                <Divider label="recovery" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    error={!pinValid ? "Must be 4-6 digits" : undefined}
                    hint="Used for password recovery"
                    id="recovery-pin"
                    label="Recovery PIN"
                    onChange={(e) => setRecoveryPin(e.currentTarget.value)}
                    placeholder="4-6 digits"
                    type="password"
                    value={recoveryPin}
                  />
                  <Input
                    id="workspace-name"
                    label="Workspace name"
                    hint="Your team sees this"
                    onChange={(e) => setWorkspaceName(e.currentTarget.value)}
                    placeholder="My Business"
                    type="text"
                    value={workspaceName}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="recovery-q">
                    Recovery question
                  </label>
                  <select
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]"
                    id="recovery-q"
                    onChange={(e) => setRecoveryQuestion(e.target.value)}
                    value={recoveryQuestion}
                  >
                    {RECOVERY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <Input
                  id="recovery-answer"
                  label="Recovery answer"
                  onChange={(e) => setRecoveryAnswer(e.currentTarget.value)}
                  placeholder="Your answer"
                  type="text"
                  value={recoveryAnswer}
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

                <Button className="h-11 w-full justify-center" disabled={submitting || !passwordsMatch} type="submit">
                  {submitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        className="size-4 rounded-full border-2 border-[var(--ft-text-inverse)]/30 border-t-[var(--ft-text-inverse)]"
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Creating workspace...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Create workspace
                    </>
                  )}
                </Button>
              </form>

              <Divider label="or" />

              <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                <span className="text-[var(--ft-text-secondary)]">Already have an account?</span>
                <a
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--ft-accent)] hover:text-[var(--ft-accent-dim)]"
                  href="/login"
                >
                  Sign in
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between px-2 text-xs text-[var(--ft-text-muted)]">
              <div className="flex gap-4">
                <span>Privacy</span>
                <span>Terms</span>
              </div>
              <span className="font-mono text-[10px]">v2.0</span>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
