"use client";

import { type FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

const RECOVERY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite food?",
];

type Step = "questions" | "pin" | "reset" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("questions");
  const [username, setUsername] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>();

  function handleQuestions(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!username.trim() || !recoveryAnswer.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setStep("pin");
  }

  function handlePin(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!/^\d{4,6}$/.test(recoveryPin)) {
      setError("Recovery PIN must be 4-6 digits.");
      return;
    }
    setStep("reset");
  }

  function handleReset(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setStep("success");
  }

  const steps: Array<{ key: Step; label: string }> = [
    { key: "questions", label: "Verify identity" },
    { key: "pin", label: "Recovery PIN" },
    { key: "reset", label: "New password" },
    { key: "success", label: "Done" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)]">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.4 }}
      >
        <a className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-accent)]" href="/login">
          <ArrowLeft className="size-4" />
          Back to login
        </a>

        <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-8 shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-2">
            <Badge tone="warning">Account recovery</Badge>
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
            No email needed — use your recovery questions and PIN
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center gap-1">
            {steps.map((s, i) => (
              <div className="flex flex-1 items-center gap-1" key={s.key}>
                <div
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= currentIndex ? "bg-[var(--ft-accent)]" : "bg-[var(--ft-bg-muted)]"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Step {currentIndex + 1} of {steps.length} — {steps[currentIndex]?.label}
          </div>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              {step === "questions" ? (
                <motion.form
                  animate={{ opacity: 1, x: 0 }}
                  className="grid gap-5"
                  exit={{ opacity: 0, x: -20 }}
                  initial={{ opacity: 0, x: 20 }}
                  key="questions"
                  onSubmit={handleQuestions}
                >
                  <Input
                    id="username"
                    label="Username"
                    onChange={(e) => setUsername(e.currentTarget.value)}
                    placeholder="Enter your username"
                    required
                    type="text"
                    value={username}
                  />

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium" htmlFor="rq">Recovery question</label>
                    <select
                      className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                      id="rq"
                    >
                      {RECOVERY_QUESTIONS.map((q) => (
                        <option key={q}>{q}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    id="recovery-answer"
                    label="Your answer"
                    onChange={(e) => setRecoveryAnswer(e.currentTarget.value)}
                    placeholder="Type your answer"
                    required
                    type="text"
                    value={recoveryAnswer}
                  />

                  {error ? <p className="text-sm text-[var(--ft-red)]">{error}</p> : null}

                  <Button className="h-11 w-full justify-center" type="submit">
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                </motion.form>
              ) : null}

              {step === "pin" ? (
                <motion.form
                  animate={{ opacity: 1, x: 0 }}
                  className="grid gap-5"
                  exit={{ opacity: 0, x: -20 }}
                  initial={{ opacity: 0, x: 20 }}
                  key="pin"
                  onSubmit={handlePin}
                >
                  <div className="grid place-items-center gap-3 py-4">
                    <div className="grid size-14 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                      <KeyRound className="size-6 text-[var(--ft-accent)]" />
                    </div>
                    <p className="text-sm text-[var(--ft-text-secondary)]">
                      Enter the recovery PIN you set during registration
                    </p>
                  </div>

                  <Input
                    id="pin"
                    label="Recovery PIN"
                    onChange={(e) => setRecoveryPin(e.currentTarget.value)}
                    placeholder="4-6 digit PIN"
                    required
                    type="password"
                    value={recoveryPin}
                  />

                  {error ? <p className="text-sm text-[var(--ft-red)]">{error}</p> : null}

                  <div className="flex gap-3">
                    <Button className="flex-1 justify-center" onClick={() => setStep("questions")} type="button" variant="secondary">
                      Back
                    </Button>
                    <Button className="flex-1 justify-center" type="submit">
                      Verify PIN
                    </Button>
                  </div>
                </motion.form>
              ) : null}

              {step === "reset" ? (
                <motion.form
                  animate={{ opacity: 1, x: 0 }}
                  className="grid gap-5"
                  exit={{ opacity: 0, x: -20 }}
                  initial={{ opacity: 0, x: 20 }}
                  key="reset"
                  onSubmit={handleReset}
                >
                  <div className="grid place-items-center gap-3 py-4">
                    <div className="grid size-14 place-items-center rounded-full bg-[var(--ft-green)]/10">
                      <ShieldCheck className="size-6 text-[var(--ft-green)]" />
                    </div>
                    <p className="text-sm text-[var(--ft-text-secondary)]">
                      Identity verified. Create your new password.
                    </p>
                  </div>

                  <Input
                    autoComplete="new-password"
                    id="new-pw"
                    label="New password"
                    onChange={(e) => setNewPassword(e.currentTarget.value)}
                    placeholder="Create a new password"
                    required
                    type="password"
                    value={newPassword}
                  />

                  <Input
                    autoComplete="new-password"
                    error={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Passwords do not match" : undefined}
                    id="confirm-pw"
                    label="Confirm password"
                    onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    placeholder="Re-enter password"
                    required
                    type="password"
                    value={confirmPassword}
                  />

                  {error ? <p className="text-sm text-[var(--ft-red)]">{error}</p> : null}

                  <Button className="h-11 w-full justify-center" type="submit">
                    Reset password
                  </Button>
                </motion.form>
              ) : null}

              {step === "success" ? (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid place-items-center gap-4 py-8 text-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  key="success"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    className="grid size-16 place-items-center rounded-full bg-[var(--ft-green)]/10"
                    transition={{ duration: 0.5 }}
                  >
                    <CheckCircle2 className="size-8 text-[var(--ft-green)]" />
                  </motion.div>
                  <h2 className="text-xl font-bold">Password updated</h2>
                  <p className="text-sm text-[var(--ft-text-secondary)]">
                    Your password has been reset successfully. You can now sign in.
                  </p>
                  <a href="/login">
                    <Button className="mt-2">
                      Sign in now
                      <ArrowRight className="size-4" />
                    </Button>
                  </a>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
