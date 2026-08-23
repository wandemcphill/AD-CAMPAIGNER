"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Folder, RefreshCw, Users } from "lucide-react";
import { motion } from "framer-motion";

import {
  Badge,
  Button,
  EmptyState,
  cn,
  humanizeStatus
} from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { useTeamData } from "../../team/use-team-data";
import Link from "next/link";

const TABS = [
  { id: "members", label: "Members" },
  { id: "projects", label: "Projects" },
  { id: "approvals", label: "Approvals" }
];

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function TeamPage() {
  const [tab, setTab] = useState("members");
  const { approvals, error, loading, members, projects, refresh } = useTeamData();
  const departmentCount = new Set(members.map((m) => m.role)).size;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Team Collaboration</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            {loading ? "Loading..." : `${members.length} members across ${departmentCount} roles`}
          </p>
        </div>
        <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-4">
        <TabBar items={TABS} onChange={setTab} value={tab} />
      </div>

      {tab === "members" && (
        <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
          {loading ? (
            <LoadingBlock label="Loading team members" />
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="No team members yet">
              Invite teammates from your workspace settings to see them here.
            </EmptyState>
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]">
              {members.map((member) => (
                <div
                  className="flex items-center gap-4 border-b border-[var(--ft-border)] p-4 last:border-0"
                  key={member.id}
                >
                  <div className="grid size-11 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-sm font-bold text-[var(--ft-accent)]">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {member.permissions.length} permission
                      {member.permissions.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Badge tone={member.role === "OWNER" ? "info" : "neutral"}>{member.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === "projects" && (
        <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
          {loading ? (
            <LoadingBlock label="Loading projects" />
          ) : projects.length === 0 ? (
            <EmptyState icon={Folder} title="No active projects">
              Projects appear here once teammates are assigned to a campaign.
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                const total = project.members.length;
                const completed = project.members.filter((m) => m.completedAt).length;

                return (
                  <Link
                    className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:border-[var(--ft-accent)]/30"
                    href={`/os/campaigns/${project.id}`}
                    key={project.id}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="size-4 text-[var(--ft-accent)]" />
                        <h3 className="font-semibold">{project.name}</h3>
                      </div>
                      <Badge tone="neutral">{humanizeStatus(project.status)}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[var(--ft-text-muted)]">
                      <span>
                        <Users className="mr-1 inline size-3" /> {total} assigned
                      </span>
                      <span>
                        <CheckCircle2 className="mr-1 inline size-3" /> {completed}/{total} complete
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--ft-bg-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--ft-accent)]"
                        style={{ width: total ? `${(completed / total) * 100}%` : "0%" }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {tab === "approvals" && (
        <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
          {loading ? (
            <LoadingBlock label="Loading approvals" />
          ) : approvals.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing needs review right now">
              Campaigns waiting on review or a change request will appear here.
            </EmptyState>
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]">
              {approvals.map((approval) => (
                <Link
                  className="flex items-center gap-4 border-b border-[var(--ft-border)] p-4 transition last:border-0 hover:bg-[var(--ft-bg-muted)]"
                  href={`/os/campaigns/${approval.id}`}
                  key={approval.id}
                >
                  <div
                    className={cn(
                      "grid size-9 place-items-center rounded-full",
                      approval.status === "CHANGES_REQUESTED"
                        ? "bg-[var(--ft-red)]/10"
                        : "bg-[var(--ft-yellow)]/10"
                    )}
                  >
                    <Clock
                      className={cn(
                        "size-4",
                        approval.status === "CHANGES_REQUESTED"
                          ? "text-[var(--ft-red)]"
                          : "text-[var(--ft-yellow)]"
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{approval.title}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      Updated {new Date(approval.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone={approval.status === "CHANGES_REQUESTED" ? "danger" : "warning"}>
                    {approval.status === "CHANGES_REQUESTED"
                      ? "Changes requested"
                      : "Pending review"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
