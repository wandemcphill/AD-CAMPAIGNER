"use client";

import { apiRequest } from "../../lib/api-client";
import { completeUpload, createUploadIntent } from "../../library/api";

export type RmbChannel = "alipay" | "wechat" | "bank";
export type RmbAccountType = "nigerian" | "chinese";

export interface RmbRateTier {
  minRmb: number;
  maxRmb: number | null;
  ngnPerRmb: number;
}

export interface RmbChannelRates {
  channel: RmbChannel;
  name: string;
  isAvailable: boolean;
  accountTypes: Array<{ type: RmbAccountType; name: string; isAvailable: boolean; rates: RmbRateTier[] }>;
  rates: RmbRateTier[];
}

export interface RmbRatesSnapshot {
  channels: RmbChannelRates[];
  limits: { minRmb: number; maxRmb: number; currency: "CNY" };
}

export interface RmbOrder {
  id: string;
  channel: string;
  rmbAmount: string;
  ngnAmountMinor: number;
  recipientName: string;
  status: string;
  createdAt: string;
}

/** Uploads a recipient's Alipay/WeChat QR code directly to the storage provider
 * (same signed-upload flow as the Creative Library) and returns its hosted URL. */
export async function uploadQrCode(file: File): Promise<string> {
  const intent = await createUploadIntent(file.type, file.name, file.size);

  const formData = new FormData();
  if (intent.fields) {
    for (const [key, value] of Object.entries(intent.fields)) {
      formData.append(key, value);
    }
  }
  formData.append("file", file);

  const uploadResponse = await fetch(intent.uploadUrl, { method: "POST", body: formData });
  if (!uploadResponse.ok) {
    throw new Error(`QR code upload failed (${uploadResponse.status}).`);
  }

  const providerPayload = uploadResponse.headers.get("content-type")?.includes("json")
    ? ((await uploadResponse.json()) as Record<string, unknown>)
    : { assetId: intent.assetId };

  const asset = await completeUpload(intent.assetId, { assetId: intent.assetId, ...providerPayload });
  const url = asset.secureUrl ?? asset.url;
  if (!url) throw new Error("Upload succeeded but no hosted URL was returned.");
  return url;
}

export async function loadRates() {
  return apiRequest<RmbRatesSnapshot>("/rmb/rates");
}

export async function loadOrders() {
  return apiRequest<RmbOrder[]>("/rmb/orders");
}

export async function createOrder(input: {
  channel: RmbChannel;
  accountType?: RmbAccountType;
  rmbAmount: number;
  recipientName: string;
  recipientIdentifier?: string;
  recipientBankName?: string;
  recipientBankAccountNumber?: string;
  qrCodeUrl?: string;
  description: string;
  idempotencyKey: string;
}) {
  return apiRequest<RmbOrder>("/rmb/buy", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
