import type { VtuNetwork } from "@fliptrybe/providers";

export interface BuyAirtimeDto {
  network: VtuNetwork;
  msisdn: string;
  faceValueMinor: number;
  /** Optional: a price-locked quoteId obtained from GET /vtu/quote. If provided, pricing is taken from the quote instead of live rates. */
  quoteId?: string;
}

export interface BuyDataDto {
  network: VtuNetwork;
  msisdn: string;
  /** Legacy: provider-specific plan ID (ClubKonnect). Use canonicalSkuId via the quote flow for multi-provider routing. */
  providerPlanId: string;
  /** Optional: a price-locked quoteId obtained from GET /vtu/quote. If provided, pricing is taken from the quote instead of live rates. */
  quoteId?: string;
}

export interface GetVtuQuoteDto {
  productType: "AIRTIME" | "DATA";
  network: VtuNetwork;
  /** For DATA quotes: the canonical SKU to price. Required when productType is DATA. */
  canonicalSkuId?: string;
  /** For AIRTIME quotes: the face value in NGN kobo. Required when productType is AIRTIME. */
  faceValueMinor?: number;
}

export interface BuyAirtimeEpinDto {
  network: VtuNetwork;
  /** Face value in NGN kobo. ClubKonnect only allows 10_000 / 20_000 / 50_000 (₦100/200/500). */
  valueMinor: number;
  quantity: number;
}

export interface BuyDataEpinDto {
  network: VtuNetwork;
  providerPlanId: string;
  quantity: number;
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

// Admin-entered education pricing. Upserts on (providerName, productCode) and
// marks the row MANUAL so education_catalog_sync leaves its price alone.
// costMinor is minor units (kobo), like every other money field on the platform.
export interface AdminEducationPlanUpsertDto {
  providerName: string;
  productCode: string;
  displayName: string;
  costMinor: number;
  currency?: string;
  active?: boolean;
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

export interface VerifyBettingDto {
  bettingCompany: string;
  customerId: string;
}

export interface BuyBetFundingDto {
  bettingCompany: string;
  customerId: string;
  /** Amount to fund in NGN kobo (minor units). */
  amountMinor: number;
}

export interface VerifyJambDto {
  profileId: string;
}

export interface BuyEducationDto {
  /** e.g. "waecdirect", "waec-registraion", "de", "utme-mock", "utme-no-mock" */
  examType: string;
  phoneNumber: string;
  /** Required for JAMB exam types; verified via /vtu/education/verify-jamb first. */
  profileId?: string;
}

export interface BillsOrderQueryDto {
  page?: number;
  limit?: number;
  productType?: "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION";
  status?: string;
}
