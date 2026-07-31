"use client";

import { useEffect, useState } from "react";
import { Clock, Globe, Monitor, Shield, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { AlertBanner } from "@fliptrybe/ui/components";

import { loadSessions, parseUserAgent, revokeSession, type SessionRecord } from "../../../../security/api";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function TrustedDevicesPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setSessions(await loadSessions());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sessions failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleRevoke(id: string) {
    setBusy(id);
    setError(undefined);
    try {
      await revokeSession(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke that session.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10">
          <Shield className="size-5 text-[var(--ft-accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Active Sessions</h1>
          <p className="text-sm text-[var(--ft-text-secondary)]">Devices currently signed into your account</p>
        </div>
      </div>

      <AlertBanner className="mt-6" tone="info">
        Revoking a session signs that device out immediately. Your current session is always shown
        first and can&apos;t be revoked from here — use Sign Out instead.
      </AlertBanner>

      {error ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-text-secondary)]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {loading ? (
          <p className="text-sm text-[var(--ft-text-muted)]">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[var(--ft-text-muted)]">No active sessions found.</p>
        ) : (
          <AnimatePresence>
            {sessions.map((session) => (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4"
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                initial={{ opacity: 1, height: "auto" }}
                key={session.id}
                layout
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)]">
                  <Monitor className="size-5 text-[var(--ft-text-secondary)]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{parseUserAgent(session.userAgent)}</span>
                    {session.isCurrent && <Badge tone="success">Current</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--ft-text-muted)]">
                    {session.ipAddress ? (
                      <span className="flex items-center gap-1"><Globe className="size-3" />{session.ipAddress}</span>
                    ) : null}
                    <span className="flex items-center gap-1"><Clock className="size-3" />Signed in {formatDate(session.createdAt)}</span>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    className="shrink-0 text-[var(--ft-red)]"
                    disabled={busy === session.id}
                    onClick={() => void handleRevoke(session.id)}
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                    Revoke
                  </Button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
