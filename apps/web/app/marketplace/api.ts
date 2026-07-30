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
