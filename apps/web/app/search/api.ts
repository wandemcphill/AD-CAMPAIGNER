"use client";

import { apiRequest } from "../lib/api-client";

export type SearchResultType = "campaign" | "team" | "growth_order" | "voucher";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  meta: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export async function search(query: string) {
  return apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
}

export const searchResultHref: Record<SearchResultType, (id: string) => string> = {
  campaign: (id) => `/os/campaigns/${id}`,
  team: () => "/os/team",
  growth_order: () => "/os/growth/orders",
  voucher: () => "/os/vouchers"
};

export const searchResultLabel: Record<SearchResultType, string> = {
  campaign: "Campaign",
  team: "Team member",
  growth_order: "Growth order",
  voucher: "Voucher"
};
