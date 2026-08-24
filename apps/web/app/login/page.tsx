"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button, ThemeToggle } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { useApiSession } from "../lib/use-session";

const POST_LOGIN_ROUTE = "/os";

export default function LoginPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signIn } = useApiSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) router.replace(POST_LOGIN_ROUTE);
  }, [router, session, sessionLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await signIn({ username: username.trim().toLowerCase(), password, ...(needsTwoFactor ? { totpCode: totpCode.trim() } : {}) });
      router.replace(POST_LOGIN_ROUTE);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Login failed.";
      if (message === "TWO_FACTOR_REQUIRED") {
        setNeedsTwoFactor(true);
        setError(undefined);
      } else {
        setError(needsTwoFactor ? "That code is invalid or expired." : message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <motion.div animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]" initial={{ opacity: 0, y: 12 }} transition={{ duration: 0.35 }}>
          <div className="mb-8 flex items-center justify-between">
            <a href="/"><img alt="FlipTrybe" className="h-7 w-auto" src="/brand/logo-horizontal-light.svg" /></a>
            <ThemeToggle />
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-xl)] sm:p-8">
            <div className="ft-eyebrow text-[var(--ft-accent)]">FlipTrybe Technology</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">Sign in to continue to your money, services and growth workspace.</p>

            <form className="mt-8 grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
              {needsTwoFactor ? (
                <>
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-accent)]/30 bg-[var(--ft-accent-subtle)] px-4 py-3 text-sm text-[var(--ft-text-secondary)]">Enter the 6-digit code from your authenticator app, or a backup code.</div>
                  <Input autoComplete="one-time-code" autoFocus id="totp-code" inputMode="numeric" label="Two-factor code" onChange={(e) => setTotpCode(e.currentTarget.value)} placeholder="123456" required type="text" value={totpCode} />
                  <button className="justify-self-start text-sm font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]" onClick={() => { setNeedsTwoFactor(false); setTotpCode(""); }} type="button">Back to password</button>
                </>
              ) : (
                <>
                  <Input autoComplete="username" autoFocus id="username" label="Username" onChange={(e) => setUsername(e.currentTarget.value)} placeholder="Enter your username" required type="text" value={username} />
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="password">Password</label><a className="text-xs font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]" href="/forgot-password">Forgot?</a></div>
                    <div className="relative">
                      <input autoComplete="current-password" className="h-11 w-full rounded-[14px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] px-4 pr-11 text-sm text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]" id="password" onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required type={showPassword ? "text" : "password"} value={password} />
                      <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)] transition hover:text-[var(--ft-text-primary)]" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    </div>
                  </div>
                </>
              )}

              {error ? <motion.div animate={{ opacity: 1, y: 0 }} className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] px-4 py-3 text-sm text-[var(--ft-red)]" initial={{ opacity: 0, y: -4 }}>{error}</motion.div> : null}

              <Button className="ft-auth-primary h-12 w-full justify-center rounded-full" disabled={submitting} type="submit">
                {submitting ? <><motion.div animate={{ rotate: 360 }} className="size-4 rounded-full border-2 border-white/30 border-t-white" transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />Signing in...</> : <><LogIn className="size-4" />Sign in securely</>}
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center">
              <span className="text-[var(--ft-text-secondary)]">New to FlipTrybe?</span>
              <a className="inline-flex items-center gap-1.5 font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]" href="/start">Choose what you want to do <ArrowRight className="size-3.5" /></a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--ft-text-muted)]">Just need airtime or to pay a bill? <a className="font-medium text-[var(--ft-accent)] underline transition hover:text-[var(--ft-accent-dim)]" href="/guest">Continue without an account</a></p>
        </motion.div>
      </div>
    </main>
  );
}
