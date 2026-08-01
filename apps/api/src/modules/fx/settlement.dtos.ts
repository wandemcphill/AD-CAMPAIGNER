export interface CreateSettlementInstructionDto {
  workspaceId: string;
  partnerId: string;
  beneficiaryId?: string;
  transactionId: string;

  destinationAmountMinor: number; // Amount to send to beneficiary
  feesMinor?: number; // Optional fees to deduct

  beneficiaryName?: string;
  beneficiaryReference: string; // Bank account, Wise email, etc.

  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface SettlementInstructionResponseDto {
  id: string;
  quoteId: string;
  workspaceId: string;
  partnerId: string;

  sourceAmountMinor: number;
  sourceCurrency: string;

  destinationAmountMinor: number;
  destinationCurrency: string;

  fxRateMicros: bigint;
  spreadBps: number;
  bufferBps: number;
  feesMinor: number;
  netAmountMinor: number;

  status: "PENDING" | "READY" | "SUBMITTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REQUIRES_REVIEW";
  provider: string;
  providerReference?: string;
  providerStatus?: string;

  errorReason?: string;
  retryCount: number;

  createdAt: Date;
  submittedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

export interface SettlementListFiltersDto {
  partnerId?: string;
  status?: string;
  limit?: number;
}

export interface SettlementReconciliationResponseDto {
  id: string;
  settlementInstructionId: string;

  ftStatus: string;
  ftProviderReference?: string;
  ftAmountMinor?: bigint;

  providerStatus?: string;
  providerAmountMinor?: bigint;

  statusMatch: boolean;
  amountMatch: boolean;

  resolved: boolean;
  resolutionNote?: string;

  createdAt: Date;
  updatedAt: Date;
}
