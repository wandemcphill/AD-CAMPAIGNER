"use client";

import { useState } from "react";
import { Plus, Shield, Users } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Drawer, Input } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { useTeamData } from "../../../team/use-team-data";

const ROLE_TONE: Record<string, "success" | "info" | "neutral" | "warning"> = {
  OWNER: "success",
  ADMIN: "info",
  MANAGER: "info",
  MARKETER: "neutral",
  FINANCE: "neutral",
  SUPPORT: "neutral",
  VIEWER: "neutral"
};

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function TeamSettingsPage() {
  const { error, loading, members } = useTeamData();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-[var(--ft-accent)]" />
            <h2 className="font-semibold">Team Members</h2>
            <Badge tone="neutral">{loading ? "..." : members.length}</Badge>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="size-4" /> Invite
          </Button>
        </div>

        <ErrorNotice message={error} />

        {loading ? (
          <div className="mt-6">
            <LoadingBlock label="Loading team members" />
          </div>
        ) : members.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              copy="Invite teammates to your workspace to see them listed here."
              icon={Users}
              title="No team members yet"
            />
          </div>
        ) : (
          <div className="mt-6 divide-y divide-[var(--ft-border)]">
            {members.map((member) => (
              <div className="flex items-center gap-4 py-4" key={member.id}>
                <div className="grid size-10 place-items-center rounded-full bg-[var(--ft-bg-muted)] text-sm font-semibold text-[var(--ft-text-secondary)]">
                  {initials(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    {member.role === "OWNER" && <Shield className="size-3.5 text-[var(--ft-accent)]" />}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    {member.permissions.length} permission{member.permissions.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Badge tone={ROLE_TONE[member.role] ?? "neutral"}>{member.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Drawer onClose={() => setShowInvite(false)} open={showInvite} title="Invite Team Member">
        <div className="grid gap-5">
          <Input
            id="invite-user"
            label="Username"
            onChange={(e) => setInviteUsername(e.currentTarget.value)}
            placeholder="Enter username"
            type="text"
            value={inviteUsername}
          />
          <div className="rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            Invitations aren&apos;t wired to the backend yet — there&apos;s no invite endpoint on the
            API. This form is a placeholder until that&apos;s built.
          </div>
          <Button className="w-full justify-center" disabled>
            Send Invitation
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
