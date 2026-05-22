import type { CurrencyCode, OtpProviderTier } from "@fliptrybe/types";

export interface QuoteOtpOrderDto {
  serviceCode?: string;
  countryCode?: string;
  providerTier?: OtpProviderTier;
  attestationAccepted?: boolean;
}

export interface CreateOtpOrderDto extends QuoteOtpOrderDto {
  idempotencyKey?: string;
  customerReference?: string;
}

export interface OtpProviderControlDto {
  enabled?: boolean;
  priority?: number;
  countries?: string[];
  services?: string[];
}

export interface OtpPricingRuleDto {
  tier?: OtpProviderTier;
  markupBps?: number;
  minimumMarginMinor?: number;
  platformFeeMinor?: number;
  customerCurrency?: CurrencyCode;
  usdToNgnRate?: number;
}
