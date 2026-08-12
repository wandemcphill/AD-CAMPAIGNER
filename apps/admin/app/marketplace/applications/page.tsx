"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, CheckCircle2, Globe, RefreshCcw, XCircle } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { AdminShell } from "../../admin-shell";
import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AgencyApplication {
  id: string;
  status: ApplicationStatus;
  name: string;
  specialty: string;
  location: string;
  description: string;
  packages: string[];
  rejectionReason: string | null;
  resultingListingId: string | null;
  createdAt: string;
  applicant?: { name: string; username: string };
}

interface CreatorApplication {
  id: string;
  status: ApplicationStatus;
  name: string;
  niche: string;
  bio: string;
  followerCount: number;
  languages: string[];
  platforms: string[];
  rateMinor: number;
  rejectionReason: string | null;
  resultingListingId: string | null;
  createdAt: string;
  applicant?: { name: string; username: string };
}

type QueueRow =
  | { kind: "agency"; application: AgencyApplication }
  | { kind: "creator"; application: CreatorApplication };

const STATUS_TABS = [
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" }
];

const STATUS_TONE: Record<ApplicationStatus, "success" | "warning" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger"
};

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminMarketplaceApplicationsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [status, setStatus] = useState<ApplicationStatus>("PENDING");
  const [agencyApplications, setAgencyApplications] = useState<AgencyApplication[]>([]);
  const [creatorApplications, setCreatorApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [rejectingId, setRejectingId] = useState<string>();
  const [rejectionReason, setRejectionReason] = useState("");

  const refresh = useCallback(async (forStatus: ApplicationStatus) => {
    setError(undefined);
    try {
      const result = await apiRequest<{ agencyApplications: AgencyApplication[]; creatorApplications: CreatorApplication[] }>(
        `/admin/marketplace/applications?status=${forStatus}`
      );
      setAgencyApplications(result.agencyApplications);
      setCreatorApplications(result.creatorApplications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load marketplace applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) {
      setLoading(true);
      void refresh(status);
    }
  }, [sessionLoading, session, status, refresh]);

  async function review(kind: "agency" | "creator", id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/marketplace/applications/${kind}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, ...(reason ? { rejectionReason: reason } : {}) })
      });
      setRejectingId(undefined);
      setRejectionReason("");
      await refresh(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit this review decision.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Marketplace auth" />;
  }

  const rows: QueueRow[] = [
    ...agencyApplications.map((application) => ({ kind: "agency" as const, application })),
    ...creatorApplications.map((application) => ({ kind: "creator" as const, application }))
  ].sort((a, b) => new Date(b.application.createdAt).getTime() - new Date(a.application.createdAt).getTime());

  return (
    <AdminShell active="/marketplace/applications/">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Marketplace Applications</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh(status)} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <TabBar items={STATUS_TABS} onChange={(value) => setStatus(value as ApplicationStatus)} value={status} />
        </div>

        <div className="mt-4 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading applications...</Panel>
          ) : rows.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No {status.toLowerCase()} applications.</Panel>
          ) : (
            rows.map((row) => {
              const { application, kind } = row;
              const isBusy = busyId === application.id;
              const isRejecting = rejectingId === application.id;

              return (
                <Panel className="p-4" key={`${kind}-${application.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {kind === "agency" ? (
                          <Briefcase className="size-3.5 text-[var(--ft-text-muted)]" />
                        ) : (
                          <Globe className="size-3.5 text-[var(--ft-text-muted)]" />
                        )}
                        <span className="font-semibold">{application.name}</span>
                        <Badge tone="neutral">{kind === "agency" ? "Agency" : "Creator"}</Badge>
                        <Badge tone={STATUS_TONE[application.status]}>{application.status.toLowerCase()}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                        {kind === "agency" ? `${application.specialty} · ${application.location}` : application.niche}
                        {application.applicant ? ` · Submitted by ${application.applicant.name} (@${application.applicant.username})` : ""}
                      </div>
                      <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                        {kind === "agency" ? application.description : application.bio}
                      </p>
                      {kind === "agency" && application.packages.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {application.packages.map((p) => (
                            <Badge key={p} tone="neutral">{p}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {kind === "creator" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ft-text-muted)]">
                          <span>{application.followerCount.toLocaleString()} followers</span>
                          {application.rateMinor > 0 ? <span>· {formatNaira(application.rateMinor)}/post</span> : null}
                          {application.platforms.map((p) => (
                            <Badge key={p} tone="neutral">{p}</Badge>
                          ))}
                          {application.languages.map((l) => (
                            <Badge key={l} tone="info">{l}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {application.status === "REJECTED" && application.rejectionReason ? (
                        <div className="mt-2 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-2 text-xs text-[var(--ft-red)]">
                          Reason: {application.rejectionReason}
                        </div>
                      ) : null}
                      <div className="mt-2 text-[10px] text-[var(--ft-text-muted)]">
                        Submitted {new Date(application.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {application.status === "PENDING" && (
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button disabled={isBusy} onClick={() => void review(kind, application.id, "APPROVED")}>
                          <CheckCircle2 className="size-4" />
                          Approve
                        </Button>
                        <Button
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(isRejecting ? undefined : application.id);
                            setRejectionReason("");
                          }}
                          variant="secondary"
                        >
                          <XCircle className="size-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {isRejecting && (
                    <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3">
                      <input
                        className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Reason for rejection (shown to the applicant)"
                        value={rejectionReason}
                      />
                      <Button disabled={busyId === application.id} onClick={() => setRejectingId(undefined)} variant="secondary">
                        Cancel
                      </Button>
                      <Button
                        disabled={busyId === application.id || !rejectionReason.trim()}
                        onClick={() => void review(kind, application.id, "REJECTED", rejectionReason.trim())}
                      >
                        Confirm reject
                      </Button>
                    </div>
                  )}
                </Panel>
              );
            })
          )}
        </div>
      </div>
    </AdminShell>
  );
}
