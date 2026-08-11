"use client";

import { apiRequest } from "../../lib/api-client";

export type VtuNetwork = "MTN" | "GLO" | "AIRTEL" | "NINE_MOBILE";

export type VtuOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "SUBMITTED"
  | "DELIVERED"
  | "FAILED"
  | "AMBIGUOUS"
  | "REVERSED"
  | "REFUNDED";

export interface VtuOrder {
  id: string;
  productType: "AIRTIME" | "DATA";
  network: VtuNetwork;
  msisdnMasked: string;
  faceValueMinor: number | null;
  amountMinor: number;
  status: VtuOrderStatus;
  providerName: string | null;
  createdAt: string;
}

export interface VtuDataPlan {
  id: string;
  providerName: string;
  providerPlanId: string;
  network: VtuNetwork;
  planType: string;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
}

export async function buyAirtime(input: {
  network: VtuNetwork;
  msisdn: string;
  faceValueMinor: number;
}) {
  return apiRequest<VtuOrder>("/vtu/airtime", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyData(input: {
  network: VtuNetwork;
  msisdn: string;
  providerPlanId: string;
}) {
  return apiRequest<VtuOrder>("/vtu/data", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadVtuOrders() {
  const res = await apiRequest<{ orders: VtuOrder[]; total: number }>("/vtu/orders");
  return res.orders;
}

export async function loadDataPlans(network?: VtuNetwork) {
  const query = network ? `?network=${encodeURIComponent(network)}` : "";
  return apiRequest<VtuDataPlan[]>(`/vtu/data-plans${query}`);
}

export type VtuQuote = {
  id: string;
  providerName: string;
  costMinor: number;
  customerPriceMinor: number;
  currency: string;
  expiresAt: string;
};

// DATA quotes need a canonicalSkuId, which VtuDataPlan doesn't expose to the
// client (only admin/vtu/skus resolves that mapping) — so only AIRTIME quotes
// are reachable from here without inventing a lookup that doesn't exist.
export async function getAirtimeQuote(network: VtuNetwork, faceValueMinor: number) {
  return apiRequest<VtuQuote>(
    `/vtu/quote?productType=AIRTIME&network=${encodeURIComponent(network)}&faceValueMinor=${faceValueMinor}`
  );
}

export type VtuEpin = { pin: string; serialNumber: string; batchNo?: string };

export async function buyAirtimeEpin(input: { network: VtuNetwork; valueMinor: number; quantity: number }) {
  return apiRequest<{ order: VtuOrder; epins: VtuEpin[] }>("/vtu/airtime/epin", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyDataEpin(input: { network: VtuNetwork; providerPlanId: string; quantity: number }) {
  return apiRequest<{ order: VtuOrder; epins: VtuEpin[] }>("/vtu/data/epin", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
