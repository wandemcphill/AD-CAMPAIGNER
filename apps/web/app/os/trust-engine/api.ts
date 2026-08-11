"use client";

import { apiRequest } from "../../lib/api-client";

// Mirrors the shape returned by GET/POST routes on
// apps/api/src/modules/trust-engine/trust-engine.controller.ts.

export type SubmissionStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "REVIEW"
  | "REJECTED"
  | "DISPUTED"
  | "COMPLETED";

export type AssetClass = "GIFT_CARD" | "AIRTIME_PIN" | "RECHARGE_VOUCHER" | "DIGITAL_COUPON";

export interface ModerationSummary {
  status: string;
  decision: string | null;
  decisionReason: string | null;
  reviewerUserId: string | null;
  reviewedAt: string | null;
}

export interface SubmissionListItem {
  id: string;
  workspaceId: string;
  userId: string;
  assetClass: AssetClass;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  latestVerdict: string | null;
  latestVerdictReasons: string[];
  moderation: ModerationSummary | null;
}

export interface SubmissionStageResult {
  stageKey: string;
  status: string;
  reasonCodes: string[];
  durationMs: number;
  retryCount: number;
  failureMessage?: string;
  createdAt: string;
}

export interface SubmissionStagesResponse {
  submissionId: string;
  validationRun: {
    id: string;
    verdict: string;
    verdictReasons: string[];
    verdictExplained: string;
    fraudScore: number;
    trustScore: number;
    finalScore: number;
    createdAt: string;
  } | null;
  stages: SubmissionStageResult[];
}

export interface ModerationDecisionResult {
  submissionId: string;
  status: SubmissionStatus;
  moderation: ModerationSummary;
}

export function loadSubmissions(filters: { status?: SubmissionStatus | "all"; assetClass?: AssetClass | "all" } = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.assetClass && filters.assetClass !== "all") params.set("assetClass", filters.assetClass);
  const query = params.toString();

  return apiRequest<SubmissionListItem[]>(`/trust-engine/submissions${query ? `?${query}` : ""}`);
}

export function loadSubmissionStages(submissionId: string) {
  return apiRequest<SubmissionStagesResponse>(`/trust-engine/submissions/${encodeURIComponent(submissionId)}/stages`);
}

export function moderateSubmission(submissionId: string, decision: "APPROVE" | "REJECT", reason?: string) {
  return apiRequest<ModerationDecisionResult>(
    `/trust-engine/submissions/${encodeURIComponent(submissionId)}/moderate`,
    {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) })
    }
  );
}
