"use client";

import { apiRequest } from "../../lib/api-client";

export interface CryptoAsset {
  symbol: string;
  name: string;
  networks: string[];
  defaultNetwork: string;
  minDepositUsd: number;
}

export interface DepositAddress {
  id: string;
  asset: string;
  network: string;
  address: string;
  maskedAddress: string;
  destinationTag?: string;
  isActive: boolean;
}

export interface CryptoTransaction {
  id: string;
  asset: string;
  amountMinor: number;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export async function loadAssets() {
  return apiRequest<CryptoAsset[]>("/crypto/assets");
}

export async function loadDepositAddress(asset: string) {
  return apiRequest<DepositAddress | null>(`/crypto/deposit-address?asset=${encodeURIComponent(asset)}`);
}

export async function createDepositAddress(input: { asset: string; idempotencyKey: string }) {
  return apiRequest<DepositAddress>("/crypto/deposit-address", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadTransactions() {
  return apiRequest<CryptoTransaction[]>("/crypto/transactions");
}

export interface CryptoRate {
  ngnAmountMinor: number;
  usdNgnRate: number;
  feeNgnMinor: number;
}

export async function loadCryptoRate(asset: string, amount: number) {
  return apiRequest<CryptoRate>(
    `/crypto/assets/${encodeURIComponent(asset)}/rate?amount=${amount}`
  );
}
