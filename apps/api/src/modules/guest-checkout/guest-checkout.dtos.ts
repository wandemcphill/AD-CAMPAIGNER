export type GuestProductType = "AIRTIME" | "DATA" | "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION";

export interface GuestCheckoutDto {
  productType: GuestProductType;
  email: string;
  phone?: string;
  amountMinor?: number;
  currency?: string;
  idempotencyKey?: string;

  // AIRTIME / DATA
  network?: string;
  msisdn?: string;
  bundleId?: string;

  // ELECTRICITY
  disco?: string;
  meterNumber?: string;
  meterType?: "PREPAID" | "POSTPAID";

  // CABLE
  cableProvider?: string;
  smartCardNumber?: string;
  packageCode?: string;

  // BETTING
  bookmaker?: string;
  customerId?: string;

  // EDUCATION
  examType?: string;
}

export interface GuestPaymentDto {
  reference: string;
  redirectUrl?: string;
}

export interface GuestMigrateDto {
  emailOrPhone: string;
}

export interface GuestStatusQueryDto {
  reference: string;
}

export interface AdminGuestTransactionQueryDto {
  paymentStatus?: string;
  fulfilmentStatus?: string;
  email?: string;
  phone?: string;
  reference?: string;
  providerReference?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminGuestRetryFulfilmentDto {
  reference: string;
}
