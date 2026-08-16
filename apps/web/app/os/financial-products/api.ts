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

// Which currencies a customer can hold a card in. USD is issued by a provider
// that requires a verified customer first (see CardEnrollment); NGN is not.
export type CardCurrency = "NGN" | "USD";

export interface CardEnrollment {
  providerName: string;
  currency: string;
  /** false = this currency's issuer needs no customer, so issuing can proceed. */
  required: boolean;
  /** true = issuing can proceed, either because it's not required or it's done. */
  enrolled: boolean;
  tier: string | null;
  status: string | null;
  enrolledAt: string | null;
}

export interface EnrollCardCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 with country code — bare local numbers are rejected upstream. */
  phone: string;
  currency?: CardCurrency;
  country?: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  };
  idType?: string;
  idNumber?: string;
  idImageBase64?: string;
}

export interface CardCostPreview {
  cardCurrency: string;
  cardAmountMinor: number;
  walletCurrency: string;
  walletCostMinor: number;
  rate: number;
  spreadBps: number;
  /** Always true — the rate can move before issuance. Never show as locked. */
  indicative: boolean;
}

// null for a same-currency card, where there is nothing to convert.
export function loadCardCostPreview(currency: CardCurrency, amountMinor: number) {
  return apiRequest<CardCostPreview | null>(
    `/financial-products/cards/cost-preview?currency=${encodeURIComponent(currency)}` +
      `&amountMinor=${amountMinor}`
  );
}

export function loadCards() {
  return apiRequest<VirtualCard[]>("/financial-products/cards");
}

export function loadCardEnrollment(currency: CardCurrency) {
  return apiRequest<CardEnrollment>(
    `/financial-products/cards/enrollment?currency=${encodeURIComponent(currency)}`
  );
}

// Identity fields go to the card issuer and are not stored by FlipTrybe — only
// the returned customer id and tier are kept.
export function enrollCardCustomer(input: EnrollCardCustomerInput) {
  return apiRequest<{
    providerName: string;
    tier: string | null;
    status: string;
    enrolledAt: string;
  }>("/financial-products/cards/enroll", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function issueCard(cardholderName: string, fundingAmountMinor: number, currency = "NGN") {
  return apiRequest<ResponseEnvelope<VirtualCard>>("/financial-products/cards", {
    method: "POST",
    body: JSON.stringify({ cardholderName, fundingAmountMinor, currency })
  });
}

// amountMinor is in the CARD's currency; the wallet is credited the converted
// equivalent. Withdraw before terminating — termination does not itself return
// funds on every issuer.
export function withdrawFromCard(id: string, amountMinor: number) {
  return apiRequest<{
    cardId: string;
    withdrawnMinor: number;
    currency: string;
    creditedMinor: number;
    creditedCurrency: string;
    balanceMinor: number;
  }>(`/financial-products/cards/${encodeURIComponent(id)}/withdraw`, {
    method: "POST",
    body: JSON.stringify({ amountMinor })
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
