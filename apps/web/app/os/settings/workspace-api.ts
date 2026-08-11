"use client";

import { apiRequest } from "../../lib/api-client";

export type WorkspaceSettings = {
  id: string;
  name: string;
  defaultCurrency: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export async function loadWorkspace() {
  return apiRequest<WorkspaceSettings>("/workspace");
}

export async function updateWorkspace(input: { name: string }) {
  return apiRequest<WorkspaceSettings>("/workspace", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

// The "advertiser identity" a campaign launches under — its name shows up in
// the Meta launch spec (see admin/campaign-ops's launch-spec panel) instead of
// the raw campaign name when one is set. One workspace can have several rows
// (upsertCompanyProfile matches by slug), but in practice most workspaces have
// exactly one; this treats it as a single profile.
export type CompanyProfile = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  websiteUrl: string | null;
  industry: string | null;
  countryCode: string | null;
  city: string | null;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: "INCOMPLETE" | "ACTIVE" | "SUSPENDED";
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

export async function loadCompanyProfiles() {
  return apiRequest<CompanyProfile[]>("/company-profiles");
}

export type CompanyProfileInput = {
  name: string;
  legalName?: string;
  websiteUrl?: string;
  industry?: string;
  countryCode?: string;
  city?: string;
  timezone?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export async function createCompanyProfile(input: CompanyProfileInput) {
  return apiRequest<CompanyProfile>("/company-profiles", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCompanyProfile(id: string, input: CompanyProfileInput) {
  return apiRequest<CompanyProfile>(`/company-profiles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}
