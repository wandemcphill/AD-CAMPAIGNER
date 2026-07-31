"use client";

import { apiRequest } from "../lib/api-client";

export type TeamMemberRecord = {
  id: string;
  name: string;
  role: string;
  permissions: string[];
};

export type TeamProjectRecord = {
  id: string;
  name: string;
  status: string;
  members: Array<{
    id: string;
    name: string;
    role: string;
    dueAt: string | null;
    completedAt: string | null;
  }>;
};

export type TeamApprovalRecord = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

export async function loadTeamMembers() {
  return apiRequest<TeamMemberRecord[]>("/teams");
}

export async function loadTeamProjects() {
  return apiRequest<TeamProjectRecord[]>("/teams/projects");
}

export async function loadTeamApprovals() {
  return apiRequest<TeamApprovalRecord[]>("/teams/approvals");
}

export const TEAM_ROLES = ["ADMIN", "MANAGER", "MARKETER", "FINANCE", "SUPPORT", "VIEWER"] as const;

export async function inviteTeamMember(username: string, role: string) {
  return apiRequest<TeamMemberRecord>("/teams/invite", {
    method: "POST",
    body: JSON.stringify({ username, role })
  });
}

export async function updateTeamMemberRole(memberId: string, role: string) {
  return apiRequest<TeamMemberRecord>(`/teams/${encodeURIComponent(memberId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export async function removeTeamMember(memberId: string) {
  return apiRequest<{ ok: boolean }>(`/teams/${encodeURIComponent(memberId)}`, {
    method: "DELETE"
  });
}
