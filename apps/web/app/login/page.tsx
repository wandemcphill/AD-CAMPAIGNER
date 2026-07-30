"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Badge, Button, ThemeToggle } from "@fliptrybe/ui";
import { Input, Checkbox, Divider } from "@fliptrybe/ui/components";

import { useApiSession } from "../lib/use-session";

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          animate={{
            y: [0, -30, 0],
            opacity: [0.15, 0.4, 0.15],
          }}
          className="absolute rounded-full bg-[var(--ft-accent)]"
          initial={{ opacity: 0 }}
          key={i}
          style={{
            width: `${2 + (i % 4) * 2}px`,
            height: `${2 + (i % 4) * 2}px`,
            left: `${5 + (i * 4.1) % 90}%`,
            top: `${10 + (i * 7.3) % 80}%`,
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function AnimatedLogo() {
  return (
    <motion.div
      animate={{ rotate: [0, 360] }}
      className="relative"
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <div className="grid size-20 place-items-center rounded-[var(--radius-xl)] border border-[var(--ft-accent)]/30 bg-[var(--ft-accent)]/10 shadow-[0_0_60px_var(--ft-accent-glow)]">
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="size-8 text-[var(--ft-accent)]" />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, signIn } = useApiSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!sessionLoading && session) {
      router.replace("/studio");
    }
  }, [router, session, sessionLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      await signIn({ username, password });
      router.replace("/studio");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <FloatingParticles />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* Left — branding panel */}
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-8 lg:px-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid max-w-md gap-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            <AnimatedLogo />

            <div>
              <h2 className="text-4xl font-bold tracking-tight text-[var(--ft-text-primary)]">
                FlipTrybe
              </h2>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                AI Growth Operating System
              </p>
            </div>

            <p className="text-sm leading-7 text-[var(--ft-text-secondary)]">
              Create, launch, and grow businesses with AI.
              One platform for advertisements, creative production,
              growth services, and campaign intelligence.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Campaigns", value: "AI-powered" },
                { label: "Creative", value: "Auto-gen" },
                { label: "Growth", value: "Real-time" },
              ].map((stat) => (
                <div
                  className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                  key={stat.label}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--ft-accent)]">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right — login form */}
        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Mobile logo */}
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-[var(--ft-accent)] font-mono text-xs font-bold text-[var(--ft-text-inverse)]">
                  FT
                </div>
                <span className="text-lg font-bold text-[var(--ft-text-primary)]">FlipTrybe</span>
              </div>
              <ThemeToggle />
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-8 shadow-[var(--shadow-lg)]">
              <div className="flex items-center gap-2">
                <Badge tone="info">Secure login</Badge>
              </div>

              <h1 className="mt-5 text-2xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                Sign in to your AI workspace
              </p>

              <form className="mt-8 grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  autoComplete="username"
                  id="username"
                  label="Username"
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  placeholder="Enter your username"
                  required
                  type="text"
                  value={username}
                />

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      autoComplete="current-password"
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 pr-11 text-sm text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]"
                      id="password"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ft-text-muted)] transition hover:text-[var(--ft-text-primary)]"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      type="button"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Input
                  autoComplete="off"
                  id="recovery-pin"
                  hint="Optional — use if your password needs recovery"
                  label="Recovery PIN"
                  onChange={(e) => setRecoveryPin(e.currentTarget.value)}
                  placeholder="4-6 digit PIN"
                  type="password"
                  value={recoveryPin}
                />

                <Checkbox
                  checked={trustDevice}
                  id="trust-device"
                  onChange={setTrustDevice}
                >
                  Trust this device for 30 days
                </Checkbox>

                {error ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] px-4 py-3 text-sm text-[var(--ft-red)]"
                    initial={{ opacity: 0, y: -4 }}
                  >
                    {error}
                  </motion.div>
                ) : null}

                <Button className="h-11 w-full justify-center text-sm" disabled={submitting} type="submit">
                  {submitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        className="size-4 rounded-full border-2 border-[var(--ft-text-inverse)]/30 border-t-[var(--ft-text-inverse)]"
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Continue
                    </>
                  )}
                </Button>
              </form>

              <Divider label="or" />

              <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                <a
                  className="font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
                  href="/forgot-password"
                >
                  Forgot password?
                </a>
                <a
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
                  href="/register"
                >
                  Create workspace
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between px-2 text-xs text-[var(--ft-text-muted)]">
              <div className="flex gap-4">
                <span>Privacy</span>
                <span>Terms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline"><ThemeToggle /></span>
                <span className="font-mono text-[10px]">v2.0</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
