export interface SetFxRateDto {
  rate: number; // decimal NGN per USD, e.g. 1450.25
  bufferBps?: number;
  /** Customer spread in bps. Omit to carry the current rate's spread forward. */
  spreadBps?: number;
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
  /**
   * Where the underlying rate came from. `bootstrap` is a hardcoded USD/NGN
   * constant used when no cached or manual rate exists — it is not a real
   * market rate and must never be presented to a customer as one.
   */
  rateProvenance: "live" | "manual" | "bootstrap";
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
