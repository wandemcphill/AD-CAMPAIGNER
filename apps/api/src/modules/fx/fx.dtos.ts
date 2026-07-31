export interface SetFxRateDto {
  rate: number; // decimal NGN per USD, e.g. 1450.25
  bufferBps?: number;
  note?: string;
  confirmLargeChange?: boolean;
}

export interface RefreshRatesDto {
  baseCurrency?: string;
  quoteCurrencies?: string[]; // e.g., ["NGN", "GBP", "EUR"]
  forceRefresh?: boolean;
}

export interface FxQuoteRequestDto {
  baseCurrency: string; // e.g., "USD"
  quoteCurrency: string; // e.g., "NGN"
  sourceAmountMinor: number; // in minor units (cents/kobo)
  quoteExpirySeconds?: number; // default: 60
}

export interface FxQuoteResponseDto {
  quoteId: string;
  baseCurrency: string;
  quoteCurrency: string;
  sourceAmountMinor: number;
  providerRateMicros: bigint;
  customerRateMicros: bigint;
  spreadBps: number;
  resultAmountMinor: number;
  expiresAt: Date;
  status: "ACTIVE" | "EXPIRED" | "USED" | "CANCELLED";
}

export interface FxRateCacheStatusDto {
  baseCurrency: string;
  quoteCurrency: string;
  providerName: string;
  providerRateMicros: bigint;
  customerRateMicros: bigint; // with buffer/spread applied
  ageSeconds: number;
  validationStatus: string;
  lastUpdatedAt: Date;
  isFresh: boolean;
}

export interface FxHealthDto {
  provider: string;
  healthy: boolean;
  message: string | undefined;
  cacheStatus: {
    pairs: FxRateCacheStatusDto[];
    lastRefreshAt: Date;
  };
  fallbackStatus: {
    usingFallback: boolean;
    reason?: string;
    manualRateAge: number; // minutes
  };
}
