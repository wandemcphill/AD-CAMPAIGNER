import { IsInt, IsOptional, IsString, Min } from "class-validator";

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

  @IsOptional()
  @IsString()
  currency?: string;

  @IsInt()
  @Min(100)
  fundingAmountMinor!: number;
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

// The client echoes back the amounts it was quoted (RemittanceQuote's response
// shape) — the provider re-validates by quoteId in sendTransfer(); this DTO's
// values are what we persist for our own record, not what's trusted for money
// movement (that's the provider's job, keyed by quoteId).
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

  @IsInt()
  @Min(1)
  sourceAmountMinor!: number;

  @IsString()
  sourceCurrency!: string;

  @IsInt()
  @Min(0)
  destinationAmountMinor!: number;

  @IsString()
  destinationCurrency!: string;

  @IsInt()
  @Min(0)
  feeMinor!: number;
}
