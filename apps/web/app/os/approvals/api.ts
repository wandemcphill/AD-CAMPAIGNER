"use client";

import { apiRequest } from "../../lib/api-client";

// Mirrors ApprovalRequest (packages/database/prisma/schema.prisma) as returned by
// GET/POST /approvals (apps/api/src/modules/approvals/approvals.controller.ts).
// `entityType` is a free-form string set by whichever domain called
// ApprovalsService.request() — currently only Digital Access refunds/reversals go
// through this engine. Campaign launch approvals and ad-account KYC approvals still
// live in their own separate endpoints (platform.controllers.ts) and are NOT yet
// unified into this queue — see the controller's doc comment.
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "EXECUTION_FAILED";

export interface ApprovalRequestRecord {
  id: string;
  workspaceId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  executedAt: string | null;
  executionError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalQueueStatusFilter = "pending" | "flagged" | "all";
export type ApprovalQueueTypeFilter = "ads" | "kyc" | "smm" | "all";

export function loadApprovals(filters: {
  status?: ApprovalQueueStatusFilter;
  type?: ApprovalQueueTypeFilter;
} = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  const query = params.toString();

  return apiRequest<ApprovalRequestRecord[]>(`/approvals${query ? `?${query}` : ""}`);
}

export function loadApproval(id: string) {
  return apiRequest<ApprovalRequestRecord>(`/approvals/${encodeURIComponent(id)}`);
}

export function decideApproval(id: string, approve: boolean, note?: string) {
  return apiRequest<ApprovalRequestRecord>(`/approvals/${encodeURIComponent(id)}/decide`, {
    method: "POST",
    body: JSON.stringify({ approve, ...(note ? { note } : {}) })
  });
}
