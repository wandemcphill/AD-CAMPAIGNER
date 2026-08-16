import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

// ─── Virtual Accounts ───────────────────────────────────────────────────────────

export class CreateVirtualAccountDto {
  @IsString()
  accountName!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

// ─── Virtual Cards ──────────────────────────────────────────────────────────────

export class IssueVirtualCardDto {
  @IsString()
  cardholderName!: string;

  // Decides which issuer is routed to: providers are currency-specific (Sudo is
  // NGN-only, Payscribe and Maplerad are USD-only), so this becomes the router's
  // productType scope, not just a label on the row.
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(["VISA", "MASTERCARD"])
  brand?: "VISA" | "MASTERCARD";

  @IsInt()
  @Min(100)
  fundingAmountMinor!: number;
}

// Identity for provider-side customer enrollment.
//
// NONE OF THIS IS STORED. It is forwarded to the provider, which returns an
// opaque customer id; only that id and the tier reached are persisted (see
// ProviderCustomer). Same rule KycService follows — FlipTrybe does not hold raw
// identity documents.
export class ProviderCustomerAddressDto {
  @IsString()
  street!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class EnrollProviderCustomerDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  // E.164 including country code — Payscribe rejects bare local numbers.
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  country?: string;

  // Which issuer to enroll with is decided by currency, since enrollment is
  // provider-specific and providers are currency-specific.
  @IsOptional()
  @IsString()
  currency?: string;

  // YYYY-MM-DD. Required by Payscribe tier 1.
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderCustomerAddressDto)
  address?: ProviderCustomerAddressDto;

  @IsOptional()
  @IsString()
  idType?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  // Base64 document image, required for Payscribe tier 2 (card issuance).
  @IsOptional()
  @IsString()
  idImageBase64?: string;
}

export class FundVirtualCardDto {
  @IsInt()
  @Min(100)
  amountMinor!: number;
}

// ─── Remittance ─────────────────────────────────────────────────────────────────

export class RemittanceQuoteDto {
  @IsString()
  sourceCurrency!: string;

  @IsString()
  destinationCurrency!: string;

  @IsInt()
  @Min(100)
  sourceAmountMinor!: number;
}

// Carries no amounts, by design.
//
// This DTO used to accept sourceAmountMinor, destinationAmountMinor, feeMinor
// and rate from the client and persist them unchecked — a client could post any
// destination amount, fee or rate it liked and have it recorded as fact. Those
// values now come off the RemittanceQuote row that quoteId identifies (see
// FinancialProductsService.consumeRemittanceQuote), which is also where expiry,
// ownership and single-use are enforced.
//
// quoteId is OUR RemittanceQuote.id, not the provider's quote id.
export class SendRemittanceDto {
  @IsString()
  quoteId!: string;

  @IsString()
  recipientName!: string;

  @IsString()
  recipientAccountNumber!: string;

  @IsString()
  recipientBankCode!: string;

  @IsString()
  recipientCountry!: string;
}

// ─── Wallet Withdrawal ────────────────────────────────────────────────────────────
//
// Bank-only, same-currency (NGN) payout of the workspace's own wallet balance
// to its own bank account. Either a saved beneficiaryId is supplied, or all
// three inline recipient fields are — the service enforces exactly one of
// those two shapes (see FinancialProductsService.requestWithdrawal).

export class RequestWalletWithdrawalDto {
  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientAccountNumber?: string;

  @IsOptional()
  @IsString()
  recipientBankCode?: string;

  @IsInt()
  @Min(100)
  amountMinor!: number;
}
