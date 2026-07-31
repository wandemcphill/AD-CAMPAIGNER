import { IsString, IsInt, IsOptional, IsEnum, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Gift Card Sell DTOs ───────────────────────────────────────────────────────

export class GiftCardSellRateDto {
  @IsString()
  brand!: string;

  @IsString()
  region!: string;

  @IsInt()
  denomination!: number;
}

export class GiftCardSellRateResponseDto {
  brand!: string;
  region!: string;
  denomination!: number;
  currency!: string;
  estimatedPayoutNgn!: number;
  feeNgn!: number;
  finalPayoutNgn!: number;
  rateTimestamp!: Date;
}

export class GiftCardSubmitDto {
  @IsString()
  brand!: string;

  @IsString()
  region!: string;

  @IsInt()
  denomination!: number;

  cardInfo!: Record<string, string>;
}

// ─── Gift Card Buy DTOs ────────────────────────────────────────────────────────

export class GiftCardProductsQueryDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class GiftCardBuyQuoteDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;
}

export class GiftCardBuyQuoteResponseDto {
  quotedAt!: Date;
  expiresAt!: Date;
  productBrand!: string;
  productRegion!: string;
  denomination!: number;
  quantity!: number;
  supplierCostNgn!: number;
  fliptrybeMarginNgn!: number;
  totalPriceNgn!: number;
}

export class GiftCardPurchaseDto {
  @IsString()
  quoteId!: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;
}

// ─── Airtime Cashout DTOs ──────────────────────────────────────────────────────

export class AirtimeCashoutNetworksResponseDto {
  networks!: string[];
}

export class AirtimeCashoutRequestOtpDto {
  @IsString()
  network!: string;

  @IsString()
  phone!: string;
}

export class AirtimeCashoutRequestOtpResponseDto {
  sessionId!: string;
  message!: string;
}

export class AirtimeCashoutVerifyOtpDto {
  @IsString()
  network!: string;

  @IsString()
  phone!: string;

  @IsString()
  otp!: string;
}

export class AirtimeCashoutVerifyOtpResponseDto {
  verified!: boolean;
  airtimeBalanceNgn!: number;
  sessionId!: string;
  tariff?: string;
}

export class AirtimeCashoutQuoteDto {
  @IsString()
  network!: string;

  @IsString()
  phone!: string;

  @IsInt()
  amountMinor!: number;
}

export class AirtimeCashoutQuoteResponseDto {
  amountNgn!: number;
  feeNgn!: number;
  payoutNgn!: number;
  expiresAt!: Date;
}

export class AirtimeCashoutInitiateDto {
  @IsString()
  network!: string;

  @IsString()
  phone!: string;

  @IsInt()
  amountMinor!: number;

  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  pin?: string;
}

export class AirtimeCashoutInitiateResponseDto {
  transactionId!: string;
  status!: 'INITIATED' | 'PROCESSING';
  message!: string;
}

// ─── Transaction History ───────────────────────────────────────────────────────

export class DigitalValueTransactionDto {
  id!: string;
  type!: 'GIFT_CARD_SELL' | 'GIFT_CARD_BUY' | 'AIRTIME_CASHOUT' | 'AIRTIME_BUY';
  status!: string;
  amount!: number;
  currency!: string;
  description!: string;
  createdAt!: Date;
  completedAt?: Date;
}
