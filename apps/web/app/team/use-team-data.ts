"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToSessionChanges } from "../lib/api-client";
import {
  loadTeamApprovals,
  loadTeamMembers,
  loadTeamProjects,
  type TeamApprovalRecord,
  type TeamMemberRecord,
  type TeamProjectRecord
} from "./api";

export function useTeamData() {
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [projects, setProjects] = useState<TeamProjectRecord[]>([]);
  const [approvals, setApprovals] = useState<TeamApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [membersResult, projectsResult, approvalsResult] = await Promise.all([
        loadTeamMembers(),
        loadTeamProjects(),
        loadTeamApprovals()
      ]);
      setMembers(membersResult);
      setProjects(projectsResult);
      setApprovals(approvalsResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Team data failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { members, projects, approvals, loading, error, refresh };
}
