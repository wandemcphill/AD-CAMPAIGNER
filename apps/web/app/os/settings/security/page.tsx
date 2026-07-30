"use client";

import { ArrowRight, Key, KeyRound, Shield, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge, Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

export default function SecuritySettingsPage() {
  return (
    <div className="grid gap-8">
      {/* Password */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Key className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:max-w-sm">
          <Input id="current-pw" label="Current password" type="password" />
          <Input id="new-pw" label="New password" type="password" />
          <Input id="confirm-pw" label="Confirm new password" type="password" />
          <Button className="w-full justify-center sm:w-auto">Update password</Button>
        </div>
      </div>

      {/* 2FA & Devices links */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Account Security</h2>
        </div>

        <div className="mt-6 grid gap-3">
          <Link
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30"
            href="/os/settings/security/two-factor"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="size-5 text-[var(--ft-text-secondary)]" />
              <div>
                <div className="text-sm font-medium">Two-factor authentication</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Add an extra layer of security</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Not enabled</Badge>
              <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
            </div>
          </Link>

          <Link
            className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30"
            href="/os/settings/security/trusted-devices"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="size-5 text-[var(--ft-text-secondary)]" />
              <div>
                <div className="text-sm font-medium">Trusted devices</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Manage devices that skip 2FA</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="info">3 devices</Badge>
              <ArrowRight className="size-4 text-[var(--ft-text-muted)]" />
            </div>
          </Link>
        </div>
      </div>

      {/* Recovery */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Recovery Settings</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:max-w-sm">
          <Input id="recovery-pin" label="Update recovery PIN" type="password" placeholder="4-6 digit PIN" />
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="rq">Recovery question</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="rq"
            >
              <option>What was the name of your first pet?</option>
              <option>What city were you born in?</option>
              <option>What is your mother&apos;s maiden name?</option>
            </select>
          </div>
          <Input id="recovery-answer" label="Recovery answer" type="text" />
          <Button className="w-full justify-center sm:w-auto" variant="secondary">Update recovery</Button>
        </div>
      </div>
    </div>
  );
}
