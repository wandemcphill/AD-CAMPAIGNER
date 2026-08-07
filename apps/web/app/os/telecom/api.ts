"use client";

import { apiRequest } from "../../lib/api-client";

export interface TelecomOperator {
  operatorId: string;
  name: string;
  countryIso: string;
  network?: string;
  currency: string;
  supportsAirtime: boolean;
  supportsData: boolean;
}

export interface DetectedNumber {
  msisdn: string;
  countryIso: string;
  nationalNumber: string;
  provider: string;
  operators: TelecomOperator[];
}

export interface TelecomAirtimeProduct {
  operatorId: string;
  minAmountMinor: number;
  maxAmountMinor: number;
  currency: string;
  discountBps?: number;
}

export interface TelecomDataBundle {
  operatorId: string;
  bundleId: string;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
  currency: string;
}

export type TelecomOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "SUBMITTED"
  | "DELIVERED"
  | "FAILED"
  | "AMBIGUOUS"
  | "REVERSED"
  | "REFUNDED";

export interface TelecomOrder {
  id: string;
  productType: "AIRTIME" | "DATA";
  countryIso: string;
  operatorId: string;
  operatorName: string | null;
  msisdnMasked: string;
  amountMinor: number;
  currency: string;
  providerName: string;
  status: TelecomOrderStatus;
  failureReason: string | null;
  createdAt: string;
}

export async function detectNumber(phoneNumber: string) {
  return apiRequest<DetectedNumber>("/telecom/detect", {
    method: "POST",
    body: JSON.stringify({ phoneNumber })
  });
}

export async function listProducts(countryIso: string, operatorId: string) {
  return apiRequest<{ airtime: TelecomAirtimeProduct[]; data: TelecomDataBundle[] }>(
    `/telecom/products?countryIso=${encodeURIComponent(countryIso)}&operatorId=${encodeURIComponent(operatorId)}`
  );
}

export async function buyTelecomAirtime(input: {
  phoneNumber: string;
  operatorId: string;
  amountMinor: number;
}) {
  return apiRequest<TelecomOrder>("/telecom/airtime", {
    method: "POST",
    body: JSON.stringify({ ...input, paymentConfirmed: true })
  });
}

export async function buyTelecomData(input: { phoneNumber: string; operatorId: string; bundleId: string }) {
  return apiRequest<TelecomOrder>("/telecom/data", {
    method: "POST",
    body: JSON.stringify({ ...input, paymentConfirmed: true })
  });
}

export async function loadTelecomOrders() {
  const res = await apiRequest<{ orders: TelecomOrder[]; total: number }>("/telecom/orders");
  return res.orders;
}
