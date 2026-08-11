"use client";

import { type FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@fliptrybe/ui";
import { Input, AlertBanner } from "@fliptrybe/ui/components";

import { confirmPasswordReset } from "../lib/api-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);

    // Mirrors the server policy in normalizePassword (8-128 characters).
    if (password.length < 8 || password.length > 128) {
      setError("Password must be between 8 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This reset link is invalid or has expired."
      );
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-lg font-semibold">Reset your password</h1>
        </div>
        <AlertBanner className="mt-4" tone="danger">
          This link is missing its reset token. Request a new one.
        </AlertBanner>
        <Link href="/forgot-password">
          <Button className="mt-5 w-full" variant="secondary">
            Request a new link
          </Button>
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-[var(--ft-green)]" />
          <h1 className="text-lg font-semibold">Password updated</h1>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--ft-text-secondary)]">
          Your password has been changed and you&apos;ve been signed out everywhere else. Sign in
          with your new password.
        </p>
        <Link href="/login">
          <Button className="mt-5 w-full">Go to sign in</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-[var(--ft-accent)]" />
        <h1 className="text-lg font-semibold">Choose a new password</h1>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
        This link can only be used once. Signing in elsewhere will require the new password.
      </p>

      {error ? (
        <AlertBanner className="mt-4" tone="danger">
          {error}
        </AlertBanner>
      ) : null}

      <form className="mt-5 grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <Input
          autoComplete="new-password"
          disabled={pending}
          hint="At least 8 characters."
          id="password"
          label="New password"
          onChange={(e) => setPassword(e.currentTarget.value)}
          type="password"
          value={password}
        />
        <Input
          autoComplete="new-password"
          disabled={pending}
          id="confirm-password"
          label="Confirm new password"
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          type="password"
          value={confirmPassword}
        />
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)]">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-7">
          {/* useSearchParams needs a Suspense boundary during prerender. */}
          <Suspense fallback={<div className="h-40" />}>
            <ResetPasswordForm />
          </Suspense>

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
