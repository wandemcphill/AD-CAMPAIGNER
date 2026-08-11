import { apiRequest } from "../lib/api-client";

export interface RewardProduct {
  id: string;
  name: string;
  category: string;
  handler: string;
}

export interface RewardTask {
  id: string;
  campaignId: string;
  taskType: string;
  label: string;
  description?: string;
  verificationConfig: Record<string, unknown>;
  sortOrder: number;
  required: boolean;
}

export interface RewardCampaign {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  totalSlots: number;
  claimedSlots: number;
  rewardValueMinor: number;
  currency: string;
  startsAt: string;
  endsAt?: string;
  rewardProduct: RewardProduct;
  tasks: RewardTask[];
  _count?: { participants: number; entitlements: number };
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  participantId: string;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  task: RewardTask;
}

export interface RewardProgress {
  campaign: RewardCampaign;
  joinedAt: string;
  completedAt?: string;
  tasksCompleted: number;
  totalTasks: number;
  entitlement?: {
    id: string;
    status: string;
    rewardValueMinor: number;
    currency: string;
    fulfilledAt?: string;
  };
}

export interface LeaderboardEntry {
  id: string;
  campaignId: string;
  userId: string;
  displayName: string;
  tasksCompleted: number;
  rank: number;
}

export async function listRewardCampaigns(status?: string): Promise<{ campaigns: RewardCampaign[]; total: number }> {
  return apiRequest(`/rewards/campaigns${status ? `?status=${status}` : ""}`);
}

export async function getRewardCampaign(id: string): Promise<RewardCampaign> {
  return apiRequest(`/rewards/campaigns/${id}`);
}

export async function getMyProgress(): Promise<RewardProgress[]> {
  return apiRequest("/rewards/my/progress");
}

export async function getLeaderboard(
  campaignId: string,
  page = 1
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  return apiRequest(`/rewards/campaigns/${campaignId}/leaderboard?page=${page}`);
}

export async function submitTaskCompletion(
  taskId: string,
  proofPayload?: Record<string, unknown>
): Promise<TaskCompletion> {
  return apiRequest(`/rewards/tasks/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify({ proofPayload: proofPayload ?? {} })
  });
}

export async function scanQrCode(token: string): Promise<TaskCompletion> {
  return apiRequest("/rewards/qr/scan", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export type RewardTaskType =
  | "QR_SCAN"
  | "REFERRAL"
  | "FLIPTRYBE_LINK_VISIT"
  | "TIKTOK_IDENTITY_BIND"
  | "TIKTOK_VIDEO_PUBLISH"
  | "CONTENT_MILESTONE"
  | "MANUAL_PROOF";

export interface CreateRewardCampaignInput {
  name: string;
  description?: string;
  totalSlots: number;
  rewardProductId: string;
  rewardValueMinor: number;
  currency?: string;
  startsAt: string;
  endsAt?: string;
}

export async function createRewardCampaign(input: CreateRewardCampaignInput): Promise<RewardCampaign> {
  return apiRequest("/rewards/campaigns", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export interface AddRewardTaskInput {
  taskType: RewardTaskType;
  label: string;
  description?: string;
  sortOrder?: number;
  required?: boolean;
}

export async function addRewardTask(campaignId: string, input: AddRewardTaskInput): Promise<RewardTask> {
  return apiRequest(`/rewards/campaigns/${campaignId}/tasks`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
