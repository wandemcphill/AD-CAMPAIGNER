"use client";

import { useEffect, useState } from "react";
import { Briefcase, FileText, Globe, RefreshCw } from "lucide-react";

import { Badge, Button, EmptyState, humanizeStatus } from "@fliptrybe/ui";

import { ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  loadMyMarketplaceApplications,
  type MarketplaceAgencyApplicationRecord,
  type MarketplaceApplicationStatus,
  type MarketplaceCreatorApplicationRecord
} from "../../../marketplace/api";
import Link from "next/link";

const STATUS_TONE: Record<MarketplaceApplicationStatus, "success" | "warning" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger"
};

export default function MyMarketplaceApplicationsPage() {
  const [agencyApplications, setAgencyApplications] = useState<
    MarketplaceAgencyApplicationRecord[]
  >([]);
  const [creatorApplications, setCreatorApplications] = useState<
    MarketplaceCreatorApplicationRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      const result = await loadMyMarketplaceApplications();
      setAgencyApplications(result.agencyApplications);
      setCreatorApplications(result.creatorApplications);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Applications failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, []);

  const isEmpty = agencyApplications.length === 0 && creatorApplications.length === 0;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">My Applications</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Track the status of your Agency and Creator Marketplace applications.
          </p>
        </div>
        <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      <ErrorNotice message={error} />

      {loading ? (
        <div className="mt-6">
          <LoadingBlock label="Loading your applications" />
        </div>
      ) : isEmpty ? (
        <div className="mt-6">
          <EmptyState
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/os/marketplace/agencies/apply">
                  <Button variant="secondary">Apply as Agency</Button>
                </Link>
                <Link href="/os/marketplace/creators/apply">
                  <Button variant="secondary">Apply as Creator</Button>
                </Link>
              </div>
            }
            icon={FileText}
            title="No applications yet"
          >
            You haven't applied to be listed in the Marketplace yet. Submit an agency or creator
            application to get started.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section>
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-[var(--ft-text-muted)]" />
              <h2 className="font-semibold">Agency applications</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {agencyApplications.length === 0 ? (
                <p className="text-xs text-[var(--ft-text-muted)]">
                  No agency applications submitted.
                </p>
              ) : (
                agencyApplications.map((application) => (
                  <div
                    className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4"
                    key={application.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{application.name}</div>
                      <Badge tone={STATUS_TONE[application.status]}>
                        {humanizeStatus(application.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                      {application.specialty} · {application.location}
                    </div>
                    <p className="mt-2 text-xs text-[var(--ft-text-secondary)]">
                      {application.description}
                    </p>
                    {application.status === "REJECTED" && application.rejectionReason ? (
                      <div className="mt-3 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-2 text-xs text-[var(--ft-red)]">
                        {application.rejectionReason}
                      </div>
                    ) : null}
                    {application.status === "APPROVED" ? (
                      <div className="mt-3 rounded-md border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-2 text-xs text-[var(--ft-green)]">
                        You're now listed in the Agency Marketplace.
                      </div>
                    ) : null}
                    <div className="text-micro mt-2 text-[var(--ft-text-muted)]">
                      Submitted {new Date(application.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[var(--ft-text-muted)]" />
              <h2 className="font-semibold">Creator applications</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {creatorApplications.length === 0 ? (
                <p className="text-xs text-[var(--ft-text-muted)]">
                  No creator applications submitted.
                </p>
              ) : (
                creatorApplications.map((application) => (
                  <div
                    className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4"
                    key={application.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{application.name}</div>
                      <Badge tone={STATUS_TONE[application.status]}>
                        {humanizeStatus(application.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                      {application.niche}
                    </div>
                    <p className="mt-2 text-xs text-[var(--ft-text-secondary)]">
                      {application.bio}
                    </p>
                    {application.status === "REJECTED" && application.rejectionReason ? (
                      <div className="mt-3 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-2 text-xs text-[var(--ft-red)]">
                        {application.rejectionReason}
                      </div>
                    ) : null}
                    {application.status === "APPROVED" ? (
                      <div className="mt-3 rounded-md border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-2 text-xs text-[var(--ft-green)]">
                        You're now listed in the Creator Marketplace.
                      </div>
                    ) : null}
                    <div className="text-micro mt-2 text-[var(--ft-text-muted)]">
                      Submitted {new Date(application.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
