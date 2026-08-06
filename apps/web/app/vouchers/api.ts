"use client";

import { apiRequest, formatMoney } from "../lib/api-client";

export type VoucherProduct = {
  id: string;
  name: string;
  category: string;
  handler: string;
  targetWalletType?: string | null;
  inputSchema?: Record<string, unknown>;
};

export type VoucherClaimToken = {
  token: string;
  tokenExpiresAt: string;
  claimedAt?: string | null;
};

export type VoucherRecord = {
  id: string;
  serialNumber: string;
  status: string;
  giftNote?: string | null;
  redemptionDestination?: string | null;
  createdAt: string;
  expiresAt: string;
  activatedAt?: string | null;
  revealedAt?: string | null;
  redeemedAt?: string | null;
  pin?: string;
  sealedPinPreview?: string;
  product: VoucherProduct;
  claimTokens?: VoucherClaimToken[];
  purchaser?: { id: string; name: string; displayName?: string | null } | null;
  owner?: { id: string; name: string; displayName?: string | null } | null;
};

export async function loadVoucherProducts() {
  return apiRequest<VoucherProduct[]>("/vouchers/products");
}

export async function loadVouchers() {
  return apiRequest<VoucherRecord[]>("/vouchers");
}

export async function createVoucher(input: {
  productId: string;
  giftNote?: string;
  redemptionDestination?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiRequest<VoucherRecord>("/vouchers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function shareVoucher(voucherId: string) {
  return apiRequest<{ claimUrl: string; shareImageUrl: string; claim: VoucherClaimToken }>(
    `/vouchers/${encodeURIComponent(voucherId)}/share`,
    { method: "POST" }
  );
}

export async function revealVoucher(voucherId: string) {
  return apiRequest<VoucherRecord>(`/vouchers/${encodeURIComponent(voucherId)}/reveal`, {
    method: "POST"
  });
}

export async function redeemVoucher(voucherId: string, input: Record<string, unknown>) {
  return apiRequest<VoucherRecord>(`/vouchers/${encodeURIComponent(voucherId)}/redeem`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadClaimPreview(token: string) {
  return apiRequest<VoucherRecord>(`/claim/${encodeURIComponent(token)}`);
}

export async function claimVoucher(token: string) {
  return apiRequest<VoucherRecord>(`/claim/${encodeURIComponent(token)}`, {
    method: "POST"
  });
}

export function formatVoucherAmount(productName: string) {
  if (productName.toLowerCase().includes("campaign")) {
    return formatMoney({ amountMinor: 500000, currency: "NGN" });
  }

  return "Voucher";
}
