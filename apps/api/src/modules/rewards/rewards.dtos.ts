import type { RewardCampaignStatus, RewardTaskType } from "@fliptrybe/database";

export interface CreateRewardCampaignDto {
  name: string;
  description?: string;
  totalSlots: number;
  rewardProductId: string;
  rewardValueMinor: number;
  currency?: string;
  eligibilityRules?: Record<string, unknown>;
  startsAt: string;
  endsAt?: string;
}

export interface UpdateRewardCampaignDto {
  name?: string;
  description?: string;
  totalSlots?: number;
  status?: RewardCampaignStatus;
  eligibilityRules?: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
}

export interface AddRewardTaskDto {
  taskType: RewardTaskType;
  label: string;
  description?: string;
  verificationConfig?: Record<string, unknown>;
  sortOrder?: number;
  required?: boolean;
}

export interface SubmitTaskCompletionDto {
  proofPayload?: Record<string, unknown>;
}

export interface AdminResolveCompletionDto {
  resolution: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}

export interface AdminResolveEntitlementDto {
  resolution: "FULFILLED" | "REVERSED";
  reason?: string;
}

export interface RewardCampaignQueryDto {
  page?: number;
  limit?: number;
  status?: RewardCampaignStatus;
}

export interface GenerateQrCodesDto {
  taskId: string;
  count: number;
  maxScansPerCode?: number;
  expiresAt: string;
}

export interface ScanQrCodeDto {
  token: string;
}
