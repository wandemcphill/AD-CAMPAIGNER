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

export interface GuestDataPlan {
  network: string;
  providerPlanId: string;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
}

export interface GuestCablePackage {
  id: string;
  cableProvider: string;
  packageCode: string;
  displayName: string;
  costMinor: number;
}

export interface GuestMeterValidation {
  valid: boolean;
  customerName?: string;
  address?: string;
  minAmountMinor?: number;
}

export function loadGuestDataPlans(network: string) {
  return apiRequest<GuestDataPlan[]>(`/guest/data-plans?network=${encodeURIComponent(network)}`);
}

export function loadGuestCablePackages(provider: string) {
  return apiRequest<GuestCablePackage[]>(`/guest/cable-packages?provider=${encodeURIComponent(provider)}`);
}

export interface GuestBettingCompany {
  code: string;
  name: string;
}

export function loadGuestBettingCompanies() {
  return apiRequest<GuestBettingCompany[]>("/guest/betting-companies");
}

export function verifyGuestBetting(input: { bettingCompany: string; customerId: string }) {
  return apiRequest<GuestMeterValidation>("/guest/verify-betting", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export interface GuestEducationPlan {
  productCode: string;
  displayName: string;
  costMinor: number;
}

export function loadGuestEducationPlans() {
  return apiRequest<GuestEducationPlan[]>("/guest/education-plans");
}

export function verifyGuestMeter(input: { disco: string; meterNumber: string; meterType: "PREPAID" | "POSTPAID" }) {
  return apiRequest<GuestMeterValidation>("/guest/verify-meter", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function verifyGuestCable(input: { provider: string; smartCardNumber: string }) {
  return apiRequest<GuestMeterValidation>("/guest/verify-cable", {
    method: "POST",
    body: JSON.stringify(input)
  });
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
