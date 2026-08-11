"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, RefreshCcw, Trash2 } from "lucide-react";

import { Badge, Button, Panel, PermissionDenied } from "@fliptrybe/ui";

import { ErrorNotice, LoadingBlock } from "../../../../../campaigns/components";
import { isForbiddenError } from "../../../../../lib/api-client";
import {
  loadNumberDetail,
  releaseNumber,
  renewNumber,
  type VirtualNumber
} from "../../../api";

const RENEW_DURATIONS = [30, 90, 180, 360];

export default function ManageNumberPage() {
  const params = useParams<{ id: string }>();
  const numberId = params.id;

  const [number, setNumber] = useState<VirtualNumber>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [renewNote, setRenewNote] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setNumber(await loadNumberDetail(numberId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load this number.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, [numberId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRenew(durationDays: number) {
    setBusy(true);
    setError(undefined);
    setRenewNote(undefined);
    try {
      const { sameNumber } = await renewNumber(numberId, durationDays);
      setRenewNote(
        sameNumber
          ? "Renewed — this is still the same number."
          : "Renewed, but note the provider issued a different number for this SIM."
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Renewal failed. Your wallet was not charged.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    setBusy(true);
    setError(undefined);
    try {
      await releaseNumber(numberId);
      window.location.href = "/os/numbers/mine";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not release this number.");
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view your virtual numbers for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <a
          className="inline-flex items-center gap-1 text-sm text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
          href={`/os/numbers/mine/${numberId}`}
        >
          <ChevronLeft className="size-4" />
          Back to inbox
        </a>

        <ErrorNotice message={error} />

        {loading ? (
          <Panel className="mt-6 p-6">
            <LoadingBlock label="Loading" />
          </Panel>
        ) : number ? (
          <>
            <h1 className="mt-3 text-xl font-bold">{number.e164}</h1>
            <Badge tone={number.status === "ACTIVE" ? "success" : "neutral"}>
              {number.status.toLowerCase()}
            </Badge>

            <Panel className="mt-4 p-5">
              <div className="flex items-center gap-2">
                <RefreshCcw className="size-4 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">Renew</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
                Extends this number. If the provider can&apos;t guarantee the same number, we tell
                you before it happens — never a silent swap.
              </p>
              {renewNote && (
                <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] p-3 text-xs text-[var(--ft-text-secondary)]">
                  {renewNote}
                </div>
              )}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {RENEW_DURATIONS.map((days) => (
                  <Button
                    disabled={busy}
                    key={days}
                    onClick={() => void handleRenew(days)}
                    variant="secondary"
                  >
                    {days}d
                  </Button>
                ))}
              </div>
            </Panel>

            <Panel className="mt-4 border-[var(--ft-red)]/30 p-5">
              <div className="flex items-center gap-2">
                <Trash2 className="size-4 text-[var(--ft-red)]" />
                <h2 className="font-semibold text-[var(--ft-red)]">Release number</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
                This immediately releases the number back to the provider. It cannot be undone and
                you&apos;ll stop receiving SMS on it right away.
              </p>

              {confirmRelease ? (
                <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3">
                  <AlertTriangle className="size-4 shrink-0 text-[var(--ft-red)]" />
                  <p className="flex-1 text-xs text-[var(--ft-text-secondary)]">
                    Are you sure? This can&apos;t be undone.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmRelease(false)}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy} onClick={() => void handleRelease()}>
                    Yes, release
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-3"
                  disabled={busy || number.status === "RELEASED"}
                  onClick={() => setConfirmRelease(true)}
                  variant="secondary"
                >
                  Release this number
                </Button>
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}
