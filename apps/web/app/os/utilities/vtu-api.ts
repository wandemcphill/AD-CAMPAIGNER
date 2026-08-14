"use client";

import { apiRequest } from "../../lib/api-client";

export type MeterType = "PREPAID" | "POSTPAID";

export type BillsOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "SUBMITTED"
  | "DELIVERED"
  | "FAILED"
  | "AMBIGUOUS"
  | "REVERSED"
  | "REFUNDED";

export interface MeterValidation {
  valid: boolean;
  customerName?: string;
  address?: string;
  minAmountMinor?: number;
}

export interface BillsOrder {
  id: string;
  productType: "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION";
  msisdnMasked: string;
  amountMinor: number;
  status: BillsOrderStatus;
  providerName: string | null;
  createdAt: string;
}

export interface BettingCompany {
  code: string;
  name: string;
}

export interface EducationPlan {
  productCode: string;
  displayName: string;
  costMinor: number;
}

export interface CablePackage {
  id: string;
  cableProvider: string;
  packageCode: string;
  displayName: string;
  costMinor: number;
}

// Real ClubKonnect ElectricCompany codes (/APIElectricityTypeV2.asp) — codes, not slugs.
export const ELECTRIC_COMPANIES: { code: string; name: string }[] = [
  { code: "01", name: "Eko Electric (EKEDC)" },
  { code: "02", name: "Ikeja Electric (IKEDC)" },
  { code: "03", name: "Abuja Electric (AEDC)" },
  { code: "04", name: "Kano Electric (KEDC)" },
  { code: "05", name: "Port Harcourt Electric (PHEDC)" },
  { code: "06", name: "Jos Electric (JEDC)" },
  { code: "07", name: "Ibadan Electric (IBEDC)" },
  { code: "08", name: "Kaduna Electric (KAEDC)" },
  { code: "09", name: "Enugu Electric (EEDC)" },
  { code: "10", name: "Benin Electric (BEDC)" },
  { code: "11", name: "Yola Electric (YEDC)" },
  { code: "12", name: "Aba Electric (APLE)" }
];

export const CABLE_PROVIDERS: { id: string; name: string }[] = [
  { id: "dstv", name: "DStv" },
  { id: "gotv", name: "GOtv" },
  { id: "startimes", name: "StarTimes" },
  { id: "showmax", name: "Showmax" }
];

export async function validateMeter(input: {
  disco: string;
  meterNumber: string;
  meterType: MeterType;
}) {
  return apiRequest<MeterValidation>("/vtu/electricity/validate", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyElectricity(input: {
  disco: string;
  meterNumber: string;
  meterType: MeterType;
  amountMinor: number;
  phoneNumber: string;
}) {
  return apiRequest<BillsOrder>("/vtu/electricity", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadCablePackages(provider?: string) {
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  return apiRequest<CablePackage[]>(`/vtu/cable/packages${query}`);
}

export async function verifyCable(input: { provider: string; smartCardNumber: string }) {
  return apiRequest<MeterValidation>("/vtu/cable/verify", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyCable(input: {
  provider: string;
  smartCardNumber: string;
  packageCode: string;
  phoneNumber: string;
}) {
  return apiRequest<BillsOrder>("/vtu/cable", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadBettingCompanies() {
  return apiRequest<BettingCompany[]>("/vtu/betting/companies");
}

export async function verifyBetting(input: { bettingCompany: string; customerId: string }) {
  return apiRequest<MeterValidation>("/vtu/betting/verify", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyBetFunding(input: {
  bettingCompany: string;
  customerId: string;
  amountMinor: number;
}) {
  return apiRequest<BillsOrder>("/vtu/betting", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadEducationPlans() {
  return apiRequest<EducationPlan[]>("/vtu/education/plans");
}

export async function verifyJamb(input: { profileId: string }) {
  return apiRequest<MeterValidation>("/vtu/education/verify-jamb", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function buyEducation(input: {
  examType: string;
  phoneNumber: string;
  profileId?: string;
}) {
  return apiRequest<BillsOrder>("/vtu/education", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadBillsOrders() {
  const res = await apiRequest<{ orders: BillsOrder[]; total: number }>(
    "/vtu/bills/orders"
  );
  return res.orders;
}
