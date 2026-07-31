"use client";

import { apiRequest } from "../../lib/api-client";

export interface NumberCountry {
  isoCode: string;
  name: string;
  dialPrefix: string;
  flagEmoji: string;
  enabled: boolean;
  sortOrder: number;
}

export type VirtualNumberOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "PROVISIONING"
  | "FULFILLED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type VirtualNumberStatus =
  | "RESERVED"
  | "PROVISIONING"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "RELEASED"
  | "FAILED"
  | "SUSPENDED";

export interface VirtualNumberProduct {
  id: string;
  countryCode: string;
  rentalKind: "TEMPORARY" | "STANDARD" | "EXTENDED" | "LONG_TERM";
  durationDays: number;
  displayName: string;
  active: boolean;
  preferredProviders: string[];
  estimatedPriceMinorNgn: number;
}

export interface VirtualNumberOrder {
  id: string;
  productId: string;
  virtualNumberId: string | null;
  kind: "PURCHASE" | "RENEWAL";
  status: VirtualNumberOrderStatus;
  amountMinor: number;
  currency: string;
  providerName: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface VirtualNumber {
  id: string;
  productId: string;
  providerName: string;
  e164: string;
  countryCode: string;
  status: VirtualNumberStatus;
  expiresAt: string | null;
  renewalCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface VirtualNumberMessage {
  id: string;
  senderMasked: string;
  bodyRedacted: string;
  receivedAt: string;
}

export async function loadCountries() {
  return apiRequest<NumberCountry[]>("/virtual-numbers/countries");
}

export async function loadProducts(countryCode: string) {
  return apiRequest<VirtualNumberProduct[]>(
    `/virtual-numbers/products?country=${encodeURIComponent(countryCode)}`
  );
}

export async function purchaseNumber(productId: string) {
  return apiRequest<VirtualNumberOrder>("/virtual-numbers/orders", {
    method: "POST",
    body: JSON.stringify({ productId })
  });
}

export async function loadMyNumbers() {
  const res = await apiRequest<{ numbers: VirtualNumber[]; total: number }>(
    "/virtual-numbers/numbers"
  );
  return res.numbers;
}

export async function loadNumberDetail(id: string) {
  return apiRequest<VirtualNumber>(`/virtual-numbers/numbers/${encodeURIComponent(id)}`);
}

export async function loadMessages(numberId: string) {
  const res = await apiRequest<{ messages: VirtualNumberMessage[]; total: number }>(
    `/virtual-numbers/numbers/${encodeURIComponent(numberId)}/messages`
  );
  return res.messages;
}

export async function renewNumber(numberId: string, durationDays: number) {
  return apiRequest<{ order: VirtualNumberOrder; sameNumber: boolean }>(
    `/virtual-numbers/numbers/${encodeURIComponent(numberId)}/renew`,
    { method: "POST", body: JSON.stringify({ durationDays }) }
  );
}

export async function releaseNumber(numberId: string) {
  return apiRequest<VirtualNumber>(`/virtual-numbers/numbers/${encodeURIComponent(numberId)}/release`, {
    method: "POST"
  });
}

export function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
