"use client";

import { apiRequest } from "../lib/api-client";

export type MarketplaceAgencyRecord = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  verified: boolean;
  ratingBps: number;
  reviewCount: number;
  campaignCount: number;
  teamSize: number;
  description: string;
  packages: string[];
};

export type MarketplaceCreatorRecord = {
  id: string;
  name: string;
  niche: string;
  verified: boolean;
  followerCount: number;
  engagementBps: number;
  rateMinor: number;
  currency: string;
  languages: string[];
  platforms: string[];
  pastCampaigns: number;
  bio: string;
};

export async function loadMarketplaceAgencies(specialty?: string) {
  const query = specialty ? `?specialty=${encodeURIComponent(specialty)}` : "";
  return apiRequest<MarketplaceAgencyRecord[]>(`/marketplace/agencies${query}`);
}

export async function loadMarketplaceCreators(niche?: string) {
  const query = niche ? `?niche=${encodeURIComponent(niche)}` : "";
  return apiRequest<MarketplaceCreatorRecord[]>(`/marketplace/creators${query}`);
}

export type MarketplaceApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type MarketplaceAgencyApplicationRecord = {
  id: string;
  status: MarketplaceApplicationStatus;
  name: string;
  specialty: string;
  location: string;
  description: string;
  packages: string[];
  rejectionReason: string | null;
  resultingListingId: string | null;
  createdAt: string;
  applicant?: { name: string; username: string };
};

export type MarketplaceCreatorApplicationRecord = {
  id: string;
  status: MarketplaceApplicationStatus;
  name: string;
  niche: string;
  bio: string;
  followerCount: number;
  languages: string[];
  platforms: string[];
  rateMinor: number;
  rejectionReason: string | null;
  resultingListingId: string | null;
  createdAt: string;
  applicant?: { name: string; username: string };
};

export async function applyAsAgency(input: {
  name: string;
  specialty: string;
  location: string;
  description: string;
  packages?: string[];
}) {
  return apiRequest<MarketplaceAgencyApplicationRecord>("/marketplace/applications/agency", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function applyAsCreator(input: {
  name: string;
  niche: string;
  bio: string;
  followerCount?: number;
  languages?: string[];
  platforms?: string[];
  rateMinor?: number;
}) {
  return apiRequest<MarketplaceCreatorApplicationRecord>("/marketplace/applications/creator", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadMyMarketplaceApplications() {
  return apiRequest<{
    agencyApplications: MarketplaceAgencyApplicationRecord[];
    creatorApplications: MarketplaceCreatorApplicationRecord[];
  }>("/marketplace/applications/mine");
}

// Admin

export async function adminLoadMarketplaceApplications(status?: string, type?: "agency" | "creator") {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{
    agencyApplications: MarketplaceAgencyApplicationRecord[];
    creatorApplications: MarketplaceCreatorApplicationRecord[];
  }>(`/admin/marketplace/applications${query}`);
}

export async function adminReviewAgencyApplication(id: string, decision: "APPROVED" | "REJECTED", rejectionReason?: string) {
  return apiRequest<{ ok: boolean; resultingListingId?: string }>(`/admin/marketplace/applications/agency/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, rejectionReason })
  });
}

export async function adminReviewCreatorApplication(id: string, decision: "APPROVED" | "REJECTED", rejectionReason?: string) {
  return apiRequest<{ ok: boolean; resultingListingId?: string }>(`/admin/marketplace/applications/creator/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, rejectionReason })
  });
}

export async function adminLoadAgencies() {
  return apiRequest<MarketplaceAgencyRecord[]>("/admin/marketplace/agencies");
}

export async function adminLoadCreators() {
  return apiRequest<MarketplaceCreatorRecord[]>("/admin/marketplace/creators");
}

export async function adminSetAgencyActive(id: string, isActive: boolean) {
  return apiRequest<MarketplaceAgencyRecord>(`/admin/marketplace/agencies/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

export async function adminSetCreatorActive(id: string, isActive: boolean) {
  return apiRequest<MarketplaceCreatorRecord>(`/admin/marketplace/creators/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

export function formatRating(ratingBps: number) {
  return (ratingBps / 2000).toFixed(1);
}

export function formatEngagement(engagementBps: number) {
  return `${(engagementBps / 100).toFixed(1)}%`;
}

export function formatFollowers(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
}
