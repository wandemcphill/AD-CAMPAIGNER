"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { AlertBanner } from "@fliptrybe/ui/components";

import {
  confirmTwoFactor,
  disableTwoFactor,
  loadTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorStatus
} from "../../../../security/api";

type Step = "loading" | "off" | "setup" | "verify" | "enabled" | "disabling";

export default function TwoFactorPage() {
  const [step, setStep] = useState<Step>("loading");
  const [status, setStatus] = useState<TwoFactorStatus>();
  const [secret, setSecret] = useState<string>();
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadTwoFactorStatus()
      .then((s) => {
        setStatus(s);
        setStep(s.enabled ? "enabled" : "off");
      })
      .catch(() => setStep("off"));
  }, []);

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function startSetup() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await setupTwoFactor();
      setSecret(result.secret);
      setStep("setup");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start two-factor setup.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndEnable() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await confirmTwoFactor(code);
      setBackupCodes(result.backupCodes);
      setCode("");
      const refreshed = await loadTwoFactorStatus();
      setStatus(refreshed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(undefined);
    try {
      await disableTwoFactor(disableCode);
      setDisableCode("");
      setBackupCodes(undefined);
      setSecret(undefined);
      const refreshed = await loadTwoFactorStatus();
      setStatus(refreshed);
      setStep("off");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
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

      {error ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-text-secondary)]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        {step === "loading" && (
          <p className="text-sm text-[var(--ft-text-muted)]">Loading...</p>
        )}

        {step === "off" && (
          <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Authenticator app</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Use an app like Google Authenticator, Authy, or 1Password
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
            </div>

            <Button className="w-full justify-center" disabled={busy} onClick={() => void startSetup()}>
              <ShieldCheck className="size-4" />
              {busy ? "Starting..." : "Enable 2FA"}
            </Button>
          </motion.div>
        )}

        {step === "setup" && secret && (
          <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
            <h2 className="font-semibold">Add to your authenticator app</h2>
            <p className="text-sm text-[var(--ft-text-secondary)]">
              This account doesn&apos;t render a QR image — enter this key manually in your
              authenticator app (most apps support this as a fallback to scanning).
            </p>

            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3">
              <code className="break-all text-sm font-medium tracking-wider">{secret}</code>
              <button
                className="shrink-0 text-sm font-medium text-[var(--ft-accent)] hover:text-[var(--ft-accent-dim)]"
                onClick={() => handleCopy(secret)}
                type="button"
              >
                <Copy className="size-4" />
              </button>
            </div>
            {copied && <p className="text-xs text-[var(--ft-green)]">Copied to clipboard</p>}

            <Button className="w-full justify-center" onClick={() => setStep("verify")}>
              I&apos;ve added the key
            </Button>
          </motion.div>
        )}

        {step === "verify" && (
          <motion.div animate={{ opacity: 1 }} className="grid gap-6" initial={{ opacity: 0 }}>
            <h2 className="font-semibold">Verify setup</h2>
            <p className="text-sm text-[var(--ft-text-secondary)]">
              Enter the 6-digit code from your authenticator app to confirm.
            </p>

            <input
              className="mx-auto h-11 w-full max-w-xs rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[var(--ft-accent)]"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              value={code}
            />

            <Button
              className="w-full justify-center"
              disabled={code.length < 6 || busy}
              onClick={() => void verifyAndEnable()}
            >
              {busy ? "Verifying..." : "Verify and enable"}
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

            {backupCodes ? (
              <>
                <AlertBanner tone="warning">
                  Save these backup codes in a safe place. Each code can only be used once, and they
                  won&apos;t be shown again.
                </AlertBanner>
                <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
                  {backupCodes.map((c) => (
                    <code className="text-center font-mono text-sm" key={c}>{c}</code>
                  ))}
                </div>
                <Button onClick={() => handleCopy(backupCodes.join("\n"))} variant="secondary">
                  <Copy className="size-4" />
                  Copy codes
                </Button>
              </>
            ) : (
              <p className="text-sm text-[var(--ft-text-secondary)]">
                {status?.remainingBackupCodes ?? 0} backup codes remaining.
              </p>
            )}

            <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
              <label className="text-xs text-[var(--ft-text-muted)]" htmlFor="disable-code">
                Enter a code to disable 2FA
              </label>
              <input
                className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-3 text-center font-mono tracking-[0.2em] outline-none focus:border-[var(--ft-accent)]"
                id="disable-code"
                maxLength={11}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="123456 or backup code"
                value={disableCode}
              />
              <Button
                className="justify-center text-[var(--ft-red)]"
                disabled={!disableCode.trim() || busy}
                onClick={() => void disable()}
                variant="ghost"
              >
                {busy ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
