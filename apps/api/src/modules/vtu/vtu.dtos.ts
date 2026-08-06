import type { VtuNetwork } from "@fliptrybe/providers";

export interface BuyAirtimeDto {
  network: VtuNetwork;
  msisdn: string;
  faceValueMinor: number;
}

export interface BuyDataDto {
  network: VtuNetwork;
  msisdn: string;
  providerPlanId: string;
}

export interface VtuOrderQueryDto {
  page?: number;
  limit?: number;
  network?: VtuNetwork;
  status?: string;
}

export interface AdminVtuRouteUpdateDto {
  priority?: number;
  enabled?: boolean;
}

// Phase 5 — Bills & Cable

export type MeterType = "PREPAID" | "POSTPAID";

export interface ValidateMeterDto {
  disco: string;
  meterNumber: string;
  meterType: MeterType;
}

export interface BuyElectricityDto {
  disco: string;
  meterNumber: string;
  meterType: MeterType;
  /** Amount to purchase in NGN kobo (minor units). Minimum ₦500 = 50_000 */
  amountMinor: number;
  /** Recipient phone number for provider notifications — required by ClubKonnect. */
  phoneNumber: string;
}

export interface VerifyCableDto {
  /** e.g. "dstv", "gotv", "startimes", "showmax" */
  provider: string;
  smartCardNumber: string;
}

export interface BuyCableDto {
  /** e.g. "dstv", "gotv", "startimes" */
  provider: string;
  smartCardNumber: string;
  packageCode: string;
  /** Recipient phone number for provider notifications — required by ClubKonnect. */
  phoneNumber: string;
}

export interface CablePackagesQueryDto {
  provider?: string;
}

export interface BillsOrderQueryDto {
  page?: number;
  limit?: number;
  productType?: "ELECTRICITY" | "CABLE";
  status?: string;
}
