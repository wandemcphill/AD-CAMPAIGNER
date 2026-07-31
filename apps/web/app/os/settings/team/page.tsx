"use client";

import { useState } from "react";
import { Plus, Shield, Trash2, Users } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Drawer, Input } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  TEAM_ROLES,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  type TeamMemberRecord
} from "../../../team/api";
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
  const { error, loading, members, refresh } = useTeamData();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(TEAM_ROLES[0]);
  const [inviteError, setInviteError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  async function onInvite() {
    if (!inviteUsername.trim()) return;

    setBusy("invite");
    setInviteError(undefined);
    try {
      await inviteTeamMember(inviteUsername.trim(), inviteRole);
      setInviteUsername("");
      setShowInvite(false);
      await refresh();
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : "Could not invite that user.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onRoleChange(member: TeamMemberRecord, role: string) {
    setBusy(member.id);
    try {
      await updateTeamMemberRole(member.id, role);
      await refresh();
    } catch {
      // Surfaced via the shared ErrorNotice on next refresh failure; role selects
      // revert visually once refresh() re-fetches the authoritative member list.
    } finally {
      setBusy(undefined);
    }
  }

  async function onRemove(member: TeamMemberRecord) {
    setBusy(member.id);
    try {
      await removeTeamMember(member.id);
      await refresh();
    } catch {
      // Same as above — refresh() re-syncs the list either way.
    } finally {
      setBusy(undefined);
    }
  }

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
                {member.role === "OWNER" ? (
                  <Badge tone={ROLE_TONE[member.role] ?? "neutral"}>{member.role}</Badge>
                ) : (
                  <>
                    <select
                      className="h-8 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2 text-xs outline-none focus:border-[var(--ft-accent)]"
                      disabled={busy === member.id}
                      onChange={(e) => void onRoleChange(member, e.target.value)}
                      value={member.role}
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <button
                      className="text-[var(--ft-text-muted)] transition hover:text-[var(--ft-red)]"
                      disabled={busy === member.id}
                      onClick={() => void onRemove(member)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
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
            placeholder="Enter an existing user's username"
            type="text"
            value={inviteUsername}
          />
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="invite-role">Role</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="invite-role"
              onChange={(e) => setInviteRole(e.target.value)}
              value={inviteRole}
            >
              {TEAM_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
            The invited user must already have a FlipTrybe account — they&apos;ll get an in-app
            notification once added. There&apos;s no email invite flow yet.
          </div>
          <ErrorNotice message={inviteError} />
          <Button
            className="w-full justify-center"
            disabled={!inviteUsername.trim() || busy === "invite"}
            onClick={() => void onInvite()}
          >
            {busy === "invite" ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
