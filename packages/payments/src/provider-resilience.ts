import type { CurrencyCode } from "@fliptrybe/types";

export type ProviderOperation =
  | "quote"
  | "fund"
  | "remittance"
  | "rmb"
  | "crypto_buy"
  | "crypto_sell"
  | "giftcard_buy"
  | "giftcard_sell"
  | "virtual_card"
  | "travel"
  | "growth";

export type ProviderFailureClass =
  | "retryable"
  | "unknown_delivery"
  | "rejected"
  | "configuration";

export interface ProviderRequestContext {
  operation: ProviderOperation;
  idempotencyKey: string;
  currency: CurrencyCode;
  amountMinor?: number;
  provider?: string;
}

export interface ProviderResult<TResult> {
  result: TResult;
  providerReference?: string;
  idempotencyKey: string;
}

export interface ProviderFailure {
  class: ProviderFailureClass;
  retryable: boolean;
  message: string;
  providerReference?: string;
}

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function providerReference(input: { providerReference?: string }): { providerReference: string } | Record<string, never> {
  return input.providerReference ? { providerReference: input.providerReference } : {};
}

/**
 * Build a deterministic idempotency key for a money-moving operation.
 * Callers should persist the key with the domain order/payment intent and
 * reuse it on every retry. It deliberately excludes volatile timestamps.
 */
export function buildProviderIdempotencyKey(
  operation: ProviderOperation,
  ownerId: string,
  requestId: string
): string {
  if (!ownerId || !requestId) {
    throw new Error("Provider idempotency keys require ownerId and requestId");
  }

  return `ft:${operation}:${ownerId}:${requestId}`;
}

/**
 * Classify provider failures without guessing that a timeout means failure.
 * Unknown delivery is intentionally non-retryable until reconciliation has
 * established whether the provider completed the operation.
 */
export function classifyProviderFailure(input: {
  statusCode?: number;
  timedOut?: boolean;
  message?: string;
  providerReference?: string;
}): ProviderFailure {
  if (input.timedOut) {
    return {
      class: "unknown_delivery",
      retryable: false,
      message: input.message ?? "Provider response timed out; reconcile before retrying",
      ...providerReference(input)
    };
  }

  if (typeof input.statusCode === "number" && RETRYABLE_STATUS_CODES.has(input.statusCode)) {
    return {
      class: "retryable",
      retryable: true,
      message: input.message ?? `Provider returned HTTP ${input.statusCode}`,
      ...providerReference(input)
    };
  }

  if (typeof input.statusCode === "number" && input.statusCode >= 400 && input.statusCode < 500) {
    return {
      class: "rejected",
      retryable: false,
      message: input.message ?? `Provider rejected the request with HTTP ${input.statusCode}`,
      ...providerReference(input)
    };
  }

  return {
    class: "configuration",
    retryable: false,
    message: input.message ?? "Provider operation failed and requires operator review",
    ...providerReference(input)
  };
}

/** Never permit an external provider to receive a non-positive money amount. */
export function assertProviderAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Provider amounts must be positive integer minor units");
  }
}
