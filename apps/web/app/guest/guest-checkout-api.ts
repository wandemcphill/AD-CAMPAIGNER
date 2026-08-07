import { apiRequest } from "../lib/api-client";

export type GuestProductType = "AIRTIME" | "DATA" | "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION";

export interface GuestCheckoutInput {
  productType: GuestProductType;
  email: string;
  phone?: string;
  amountMinor?: number;
  network?: string;
  msisdn?: string;
  bundleId?: string;
  disco?: string;
  meterNumber?: string;
  meterType?: "PREPAID" | "POSTPAID";
  cableProvider?: string;
  smartCardNumber?: string;
  packageCode?: string;
  bookmaker?: string;
  customerId?: string;
  examType?: string;
}

export interface GuestTransactionSummary {
  idempotent: boolean;
  reference: string;
  email: string;
  productType: GuestProductType;
  provider: string;
  beneficiary: string;
  amountMinor: number;
  currency: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  fulfilmentStatus: "PENDING" | "PROCESSING" | "DELIVERED" | "FAILED" | "REFUNDED";
  paymentMethod: string | null;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestPaymentResult {
  reference: string;
  checkoutUrl?: string;
  paymentReference?: string;
  status: string;
}

export function startGuestCheckout(input: GuestCheckoutInput) {
  return apiRequest<GuestTransactionSummary>("/guest/checkout", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function initiateGuestPayment(reference: string, redirectUrl?: string) {
  return apiRequest<GuestPaymentResult>("/guest/payment", {
    method: "POST",
    body: JSON.stringify({ reference, ...(redirectUrl ? { redirectUrl } : {}) })
  });
}

export function getGuestStatus(reference: string) {
  return apiRequest<{
    reference: string;
    paymentStatus: GuestTransactionSummary["paymentStatus"];
    fulfilmentStatus: GuestTransactionSummary["fulfilmentStatus"];
    updatedAt: string;
  }>(`/guest/status/${encodeURIComponent(reference)}`);
}

export function getGuestReceipt(reference: string) {
  return apiRequest<GuestTransactionSummary>(`/guest/receipt/${encodeURIComponent(reference)}`);
}

export function checkReturningGuest(contact: string) {
  return apiRequest<{ returning: boolean; lastPurchaseAt: string | null }>(
    `/guest/returning?contact=${encodeURIComponent(contact)}`
  );
}

export function migrateGuestPurchases(emailOrPhone: string) {
  return apiRequest<{ migratedCount: number }>("/guest/migrate", {
    method: "POST",
    body: JSON.stringify({ emailOrPhone })
  });
}
