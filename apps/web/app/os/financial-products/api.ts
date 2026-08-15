"use client";

import { apiRequest } from "../../lib/api-client";

// ─── Envelope (backend's shared response shape for mutating endpoints) ────────

export interface ResponseEnvelope<T> {
  resourceId: string;
  status: "active" | "pending" | "failed";
  data: T | null;
}

// ─── Virtual Accounts ───────────────────────────────────────────────────────

export type VirtualAccountStatus = "ACTIVE" | "CLOSED";

export interface VirtualAccount {
  id: string;
  providerName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  currency: string;
  status: VirtualAccountStatus;
  createdAt: string;
}

export function loadAccounts() {
  return apiRequest<VirtualAccount[]>("/financial-products/accounts");
}

export function createAccount(accountName: string, currency = "NGN") {
  return apiRequest<VirtualAccount>("/financial-products/accounts", {
    method: "POST",
    body: JSON.stringify({ accountName, currency })
  });
}

export function closeAccount(id: string) {
  return apiRequest<VirtualAccount>(`/financial-products/accounts/${encodeURIComponent(id)}/close`, {
    method: "POST"
  });
}

// ─── Virtual Cards ──────────────────────────────────────────────────────────

export type VirtualCardStatus = "ACTIVE" | "FROZEN" | "TERMINATED";

export interface VirtualCard {
  id: string;
  providerName: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  brand: string;
  currency: string;
  status: VirtualCardStatus;
  createdAt: string;
}

export function loadCards() {
  return apiRequest<VirtualCard[]>("/financial-products/cards");
}

export function issueCard(cardholderName: string, fundingAmountMinor: number, currency = "NGN") {
  return apiRequest<ResponseEnvelope<VirtualCard>>("/financial-products/cards", {
    method: "POST",
    body: JSON.stringify({ cardholderName, fundingAmountMinor, currency })
  });
}

export function fundCard(id: string, amountMinor: number) {
  return apiRequest<{ providerReference: string; balanceMinor: number }>(
    `/financial-products/cards/${encodeURIComponent(id)}/fund`,
    { method: "POST", body: JSON.stringify({ amountMinor }) }
  );
}

export function freezeCard(id: string) {
  return apiRequest<VirtualCard>(`/financial-products/cards/${encodeURIComponent(id)}/freeze`, {
    method: "POST"
  });
}

export function unfreezeCard(id: string) {
  return apiRequest<VirtualCard>(`/financial-products/cards/${encodeURIComponent(id)}/unfreeze`, {
    method: "POST"
  });
}

export function terminateCard(id: string) {
  return apiRequest<VirtualCard>(`/financial-products/cards/${encodeURIComponent(id)}/terminate`, {
    method: "POST"
  });
}

// ─── Remittance ─────────────────────────────────────────────────────────────

export type RemittanceStatus = "QUOTED" | "CHARGED" | "PROCESSING" | "COMPLETED" | "FAILED" | "DISPUTED";

export interface RemittanceQuote {
  /** Opaque server-side quote id. Pass it back to sendRemittance verbatim. */
  quoteId: string;
  /** The full wallet debit, inclusive of FlipTrybe's markup. */
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  feeMinor: number;
  rate: number;
  expiresAt: string;
  /** false = indicative only. Do not present these numbers as guaranteed. */
  isLocked: boolean;
}

export interface RemittanceTransfer {
  id: string;
  providerName: string;
  recipientName: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  status: RemittanceStatus;
  createdAt: string;
}

export function getRemittanceQuote(input: {
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmountMinor: number;
}) {
  return apiRequest<RemittanceQuote>("/financial-products/remittance/quote", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// No amounts are sent. The server reads them off the quote row that quoteId
// identifies — echoing them back from the client would only be a claim, and
// used to be persisted as though it were fact.
export function sendRemittance(input: {
  quoteId: string;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankCode: string;
  recipientCountry: string;
}) {
  return apiRequest<ResponseEnvelope<RemittanceTransfer>>("/financial-products/remittance/send", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function loadRemittanceTransfers() {
  return apiRequest<RemittanceTransfer[]>("/financial-products/remittance");
}

export function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
