"use client";

import { apiRequest } from "../../lib/api-client";

// Mirrors AssetSubmission / ValidationRun / StageResult (packages/database/prisma/schema.prisma)
// as returned by GET /trust-engine/submissions and GET /trust-engine/submissions/:id/stages
// (apps/api/src/modules/trust-engine/trust-engine.controller.ts). This is the review side of
// the Trust Engine's 7-stage asset validation pipeline (intake -> duplicate -> quality ->
// classification -> ocr -> brand_validation -> fraud_scoring). It is READ-ONLY: there is no
// moderation-decision endpoint yet — ModerationQueue exists in the schema but nothing writes
// to it, so unlike /os/approvals there are no Approve/Reject actions here, only visibility.
// Gated behind the `trustEngine` feature flag server-side (@RequireFeature on the controller);
// a disabled flag surfaces as a 403 from the API, which this page renders via ErrorNotice.

export type AssetClass = "GIFT_CARD" | "AIRTIME_PIN" | "RECHARGE_VOUCHER" | "DIGITAL_COUPON";

export type SubmissionStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "REVIEW"
  | "REJECTED"
  | "DISPUTED"
  | "COMPLETED";

export interface SubmissionListItem {
  id: string;
  workspaceId: string;
  userId: string;
  assetClass: AssetClass;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  latestVerdict: "ACCEPT" | "REVIEW" | "REJECT" | null;
  latestVerdictReasons: string[];
}

// The 7 stages as actually declared in apps/api/src/modules/trust-engine/stages.ts,
// in pipeline order. `ecode_format` is a StageKey the shared types package defines
// but no stage class implements it (see services/trust-engine/src/stages) — omitted
// here since it never appears in a real StageResult row.
export const TRUST_ENGINE_STAGE_ORDER = [
  "intake",
  "quality",
  "classification",
  "ocr",
  "brand_validation",
  "duplicate",
  "fraud_scoring"
] as const;

export type StageKey = (typeof TRUST_ENGINE_STAGE_ORDER)[number];

export interface StageResultItem {
  stageKey: string;
  status: "PASS" | "FAIL" | "INCONCLUSIVE";
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
    verdict: "ACCEPT" | "REVIEW" | "REJECT";
    verdictReasons: string[];
    verdictExplained: string;
    fraudScore: number;
    trustScore: number;
    finalScore: number;
    createdAt: string;
  } | null;
  stages: StageResultItem[];
}

export type SubmissionStatusFilter = SubmissionStatus | "all";
export type SubmissionAssetClassFilter = AssetClass | "all";

export function loadSubmissions(filters: {
  status?: SubmissionStatusFilter;
  assetClass?: SubmissionAssetClassFilter;
} = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.assetClass && filters.assetClass !== "all") params.set("assetClass", filters.assetClass);
  const query = params.toString();

  return apiRequest<SubmissionListItem[]>(`/trust-engine/submissions${query ? `?${query}` : ""}`);
}

export function loadSubmissionStages(submissionId: string) {
  return apiRequest<SubmissionStagesResponse>(
    `/trust-engine/submissions/${encodeURIComponent(submissionId)}/stages`
  );
}
