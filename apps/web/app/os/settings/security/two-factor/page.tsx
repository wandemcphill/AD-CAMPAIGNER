"use client";

import { useState } from "react";
import { Copy, KeyRound, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, OtpCodeBoxes } from "@fliptrybe/ui";
import { AlertBanner } from "@fliptrybe/ui/components";

type TwoFaStep = "off" | "setup" | "verify" | "enabled";

const MOCK_SECRET = "FTRY-A4K8-M2N9-X7QZ";
const MOCK_BACKUP_CODES = ["482193", "719205", "305847", "926184", "158372", "640918"];

export default function TwoFactorPage() {
  const [step, setStep] = useState<TwoFaStep>("off");
  const [otp, setOtp] = useState("");
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleVerify() {
    if (otp.length === 6) setStep("enabled");
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10">
            <ShieldCheck className="size-5 text-[var(--ft-accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
            <p className="text-sm text-[var(--ft-text-secondary)]">Add an extra layer of security to your account</p>
          </div>
        </div>

        <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
          {step === "off" && (
            <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Authenticator app</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    Use an app like Google Authenticator or Authy
                  </p>
                </div>
                <Badge tone="warning">Not enabled</Badge>
              </div>

              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
                <div className="flex items-center gap-3 text-sm text-[var(--ft-text-secondary)]">
                  <Smartphone className="size-4 text-[var(--ft-accent)]" />
                  Protects against stolen passwords
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--ft-text-secondary)]">
                  <KeyRound className="size-4 text-[var(--ft-accent)]" />
                  Backup codes for emergency access
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--ft-text-secondary)]">
                  <QrCode className="size-4 text-[var(--ft-accent)]" />
                  Quick QR code or manual key setup
                </div>
              </div>

              <Button className="w-full justify-center" onClick={() => setStep("setup")}>
                <ShieldCheck className="size-4" />
                Enable 2FA
              </Button>
            </motion.div>
          )}

          {step === "setup" && (
            <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
              <h2 className="font-semibold">Scan QR code</h2>
              <p className="text-sm text-[var(--ft-text-secondary)]">
                Scan this code with your authenticator app, or enter the key manually.
              </p>

              <div className="mx-auto grid size-48 place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                <QrCode className="size-20 text-[var(--ft-text-muted)]" />
              </div>

              <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3">
                <code className="text-sm font-medium tracking-wider">{MOCK_SECRET}</code>
                <button
                  className="text-sm font-medium text-[var(--ft-accent)] hover:text-[var(--ft-accent-dim)]"
                  onClick={() => handleCopy(MOCK_SECRET)}
                  type="button"
                >
                  <Copy className="size-4" />
                </button>
              </div>
              {copied && <p className="text-xs text-[var(--ft-green)]">Copied to clipboard</p>}

              <Button className="w-full justify-center" onClick={() => setStep("verify")}>
                I&apos;ve scanned the code
              </Button>
            </motion.div>
          )}

          {step === "verify" && (
            <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
              <h2 className="font-semibold">Verify setup</h2>
              <p className="text-sm text-[var(--ft-text-secondary)]">
                Enter the 6-digit code from your authenticator app to confirm.
              </p>

              <div className="mx-auto">
                <OtpCodeBoxes code={otp} label="Enter 6-digit code" />
                <input
                  className="mt-4 h-11 w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[var(--ft-accent)]"
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  value={otp}
                />
              </div>

              <Button className="w-full justify-center" disabled={otp.length < 6} onClick={handleVerify}>
                Verify and enable
              </Button>
            </motion.div>
          )}

          {step === "enabled" && (
            <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-[var(--ft-green)]" />
                  <h2 className="font-semibold">2FA is enabled</h2>
                </div>
                <Badge tone="success">Active</Badge>
              </div>

              <AlertBanner tone="warning">
                Save these backup codes in a safe place. Each code can only be used once.
              </AlertBanner>

              <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
                {MOCK_BACKUP_CODES.map((code) => (
                  <code className="text-center font-mono text-sm" key={code}>{code}</code>
                ))}
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 justify-center" onClick={() => handleCopy(MOCK_BACKUP_CODES.join("\n"))} variant="secondary">
                  <Copy className="size-4" />
                  Copy codes
                </Button>
                <Button className="flex-1 justify-center text-[var(--ft-red)]" onClick={() => setStep("off")} variant="ghost">
                  Disable 2FA
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
