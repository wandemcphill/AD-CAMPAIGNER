"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@fliptrybe/ui";
import { Input, AlertBanner } from "@fliptrybe/ui/components";

import { requestPasswordReset } from "../lib/api-client";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (!identifier.trim()) {
      setError("Enter your username or email address.");
      return;
    }

    setPending(true);
    try {
      await requestPasswordReset(identifier.trim());
      // Deliberately shown for every outcome. The API cannot tell us whether an
      // account matched — saying anything more specific would turn this screen
      // into an account-enumeration oracle.
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)]">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-7">
          {submitted ? (
            <>
              <div className="flex items-center gap-2">
                <MailCheck className="size-5 text-[var(--ft-green)]" />
                <h1 className="text-lg font-semibold">Check your email</h1>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--ft-text-secondary)]">
                If that account exists and has an email address, we&apos;ve sent a reset link. It
                expires in 60 minutes and can only be used once.
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--ft-text-muted)]">
                Didn&apos;t get it? Check your spam folder, or{" "}
                <button
                  className="font-medium text-[var(--ft-accent)] hover:underline"
                  onClick={() => setSubmitted(false)}
                  type="button"
                >
                  try a different username or email
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <KeyRound className="size-5 text-[var(--ft-accent)]" />
                <h1 className="text-lg font-semibold">Reset your password</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                Enter your username or email address and we&apos;ll send you a link to set a new
                password.
              </p>

              {error ? (
                <AlertBanner className="mt-4" tone="danger">
                  {error}
                </AlertBanner>
              ) : null}

              <form className="mt-5 grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
                <Input
                  autoComplete="username"
                  disabled={pending}
                  id="identifier"
                  label="Username or email"
                  onChange={(e) => setIdentifier(e.currentTarget.value)}
                  type="text"
                  value={identifier}
                />
                <Button className="w-full" disabled={pending} type="submit">
                  {pending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-7">
            <Link href="/login">
              <Button className="w-full" variant="secondary">
                <ArrowLeft className="size-4" /> Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
