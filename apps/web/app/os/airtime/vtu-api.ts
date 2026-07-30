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
