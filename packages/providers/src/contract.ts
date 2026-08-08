// Shared provider adapter contract.
//
// Every provider adapter in this package — regardless of domain — extends
// ProviderAdapterBase. The domain-specific interfaces (VtuProviderAdapter,
// VirtualNumberProviderAdapter, GiftCardSellProvider, ...) keep their own
// strongly-typed operations on top of it.
//
// This is deliberately NOT a single `execute(operation)` dispatcher. A
// stringly-typed operation bag would erase the compile-time safety the
// per-domain interfaces already give us. What every adapter genuinely shares
// is identity, versioning, capability declaration, health, and (where the
// provider pushes rather than polls) webhook handling — that's what lives here.

/** Matches the ProviderDomain enum in packages/database/prisma/schema.prisma. */
export type ProviderDomain =
  | "VIRTUAL_NUMBER"
  | "VTU"
  | "GIFT_CARD"
  | "AIRTIME_CASHOUT"
  | "CRYPTO"
  | "RMB"
  | "VIRTUAL_ACCOUNT"
  | "VIRTUAL_CARD"
  | "REMITTANCE"
  | "TELECOM"
  | "KYC";

/** Matches the ProviderStatus enum in packages/database/prisma/schema.prisma. */
export type ProviderStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";

/**
 * Current adapter contract version. Versions the *adapter contract*, not any
 * provider's own API version. Bump the major when a breaking change is made to
 * ProviderAdapterBase so a partially-migrated adapter fails registration loudly
 * instead of misbehaving silently in production.
 */
export const CURRENT_INTERFACE_VERSION = "1.0";

// ─── Health ───────────────────────────────────────────────────────────────────

/**
 * Shared health shape. The existing per-domain snapshots (VtuHealthSnapshot,
 * VirtualNumberHealthSnapshot) are structurally compatible and extend this.
 */
export interface ProviderHealthSnapshot {
  providerName: string;
  status: ProviderStatus;
  latencyMs: number;
  reason?: string;
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

/**
 * What an adapter declares it can do. Written into ProviderConfig at
 * registration time — this is the source of the registry's capability data,
 * so it must be honest rather than aspirational.
 */
export interface ProviderCapabilities {
  domain: ProviderDomain;
  /** ISO 3166-1 alpha-2. Empty means "no country restriction". */
  countries: string[];
  /** Domain-specific product identifiers this adapter supports. */
  productTypes: string[];
  /** Mobile networks, where the domain has them. Empty means not applicable. */
  networks?: string[];
  /**
   * Reliability characteristics, declared honestly — never defaulted to the
   * strongest values. The router and reconciliation cadence read these.
   */
  reliability: ProviderReliability;
}

export interface ProviderReliability {
  /**
   * strong  — provider honours an idempotency key end to end
   * weak    — provider dedups only within a short window
   * none    — no provider-side idempotency; caller must guard
   */
  idempotency: "strong" | "weak" | "none";
  /**
   * sequence  — events carry a monotonic sequence number
   * timestamp — events carry only a timestamp
   * none      — no ordering signal at all (weight down in routing,
   *             reconcile more frequently)
   */
  ordering: "sequence" | "timestamp" | "none";
  /** Webhook signature scheme, or "none" for polling-only providers. */
  webhookSignature: "hmac_sha256" | "hmac_sha512" | "shared_secret" | "none";
}

// ─── Canonical events ─────────────────────────────────────────────────────────

/**
 * Normalized inbound provider event. Event type naming is our own taxonomy,
 * never the provider's — adapters own that translation. This is the
 * enforcement point for "no provider-shaped data above the adapter layer" on
 * the inbound side.
 */
export interface CanonicalEvent {
  eventType: string;
  provider: string;
  domain: ProviderDomain;
  providerEventId: string;
  resourceId?: string;
  sequenceNumber?: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

// ─── Error taxonomy ───────────────────────────────────────────────────────────

/**
 * The complete set of failure modes services above the adapter layer may
 * branch on. Provider-native codes never cross this boundary.
 */
export type AdapterErrorCode =
  | "insufficient_funds"
  | "provider_unavailable"
  | "invalid_request"
  | "resource_not_found"
  | "rate_limited"
  | "compliance_hold"
  | "unknown_provider_error";

export interface AdapterErrorShape {
  code: AdapterErrorCode;
  /** Retained for debugging. Never surfaced above the adapter layer. */
  providerRawCode?: string;
  retryable: boolean;
  message: string;
}

/**
 * Thrown by adapters on failure. Carries a normalized code plus the raw
 * provider code for debugging.
 */
export class AdapterError extends Error implements AdapterErrorShape {
  readonly code: AdapterErrorCode;
  readonly providerRawCode?: string;
  readonly retryable: boolean;

  constructor(shape: AdapterErrorShape) {
    super(shape.message);
    this.name = "AdapterError";
    this.code = shape.code;
    this.retryable = shape.retryable;
    if (shape.providerRawCode !== undefined) {
      this.providerRawCode = shape.providerRawCode;
    }
  }

  toJSON(): AdapterErrorShape {
    return {
      code: this.code,
      ...(this.providerRawCode !== undefined
        ? { providerRawCode: this.providerRawCode }
        : {}),
      retryable: this.retryable,
      message: this.message
    };
  }
}

/** Codes that are worth retrying automatically. */
const RETRYABLE_CODES: ReadonlySet<AdapterErrorCode> = new Set<AdapterErrorCode>([
  "provider_unavailable",
  "rate_limited"
]);

// ─── Fallback safety ──────────────────────────────────────────────────────────

/**
 * How safe it is to re-run an operation — on the SAME provider or a DIFFERENT
 * one — after a failure. This is the enforcement point for the financial
 * safety rule: a timeout on a money-moving call is NOT a failure, it is an
 * unknown, and re-sending it through a fallback provider can double-pay a
 * real customer.
 *
 * - SAFE_TO_RETRY: the operation provably did not move money (read-only, or
 *   the provider rejected it before acceptance). Retry and fallback are both
 *   fine.
 * - PROVIDER_TRANSACTION_MAY_EXIST: the provider may have accepted and
 *   executed the instruction. Do NOT retry, do NOT fall back. Open a
 *   reconciliation exception and resolve against the provider first.
 */
export type FallbackSafety = "SAFE_TO_RETRY" | "PROVIDER_TRANSACTION_MAY_EXIST";

/**
 * Classifies an operation + failure into a fallback-safety verdict.
 *
 * `mutatesMoney` must be true for anything that can create/settle a payment,
 * payout, card funding, or conversion. Read-only operations (quotes, status
 * lookups, name enquiry, list calls) are always safe.
 *
 * The conservative default is deliberate: anything ambiguous on a
 * money-moving call is treated as "may exist".
 */
export function classifyFallbackSafety(input: {
  mutatesMoney: boolean;
  /** HTTP status, when the provider actually responded. */
  httpStatus?: number;
  /** True when the failure was a timeout / socket error / no response at all. */
  noResponse?: boolean;
  /** Set when the provider explicitly and definitively rejected the request
   *  BEFORE accepting it (e.g. validation error, insufficient funds). */
  providerRejectedBeforeAcceptance?: boolean;
}): FallbackSafety {
  if (!input.mutatesMoney) return "SAFE_TO_RETRY";

  // No response at all — the request may well have been processed.
  if (input.noResponse) return "PROVIDER_TRANSACTION_MAY_EXIST";

  if (input.providerRejectedBeforeAcceptance) return "SAFE_TO_RETRY";

  const status = input.httpStatus;
  if (status === undefined) return "PROVIDER_TRANSACTION_MAY_EXIST";

  // 4xx (except 408 timeout / 429 rate-limit) means the provider refused the
  // request outright — nothing was created.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return "SAFE_TO_RETRY";
  }

  // 5xx, 408, 429 — the provider may have partially processed it.
  return "PROVIDER_TRANSACTION_MAY_EXIST";
}

export function isRetryableCode(code: AdapterErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

export function isAdapterError(value: unknown): value is AdapterError {
  return value instanceof AdapterError;
}

/**
 * Normalize any thrown value into an AdapterError. Unmapped failures become
 * `unknown_provider_error` — deliberately explicit, never silently swallowed.
 */
export function toAdapterError(
  error: unknown,
  fallback: Partial<AdapterErrorShape> = {}
): AdapterError {
  if (isAdapterError(error)) return error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown provider error";

  const code = fallback.code ?? "unknown_provider_error";

  return new AdapterError({
    code,
    retryable: fallback.retryable ?? isRetryableCode(code),
    message: fallback.message ?? message,
    ...(fallback.providerRawCode !== undefined
      ? { providerRawCode: fallback.providerRawCode }
      : {})
  });
}

/** Convenience constructor for the common case. */
export function adapterError(
  code: AdapterErrorCode,
  message: string,
  options: { providerRawCode?: string; retryable?: boolean } = {}
): AdapterError {
  return new AdapterError({
    code,
    message,
    retryable: options.retryable ?? isRetryableCode(code),
    ...(options.providerRawCode !== undefined
      ? { providerRawCode: options.providerRawCode }
      : {})
  });
}

// ─── The base contract ────────────────────────────────────────────────────────

/**
 * Implemented by every provider adapter in this package.
 *
 * Webhook members are optional because a genuine share of our providers are
 * polling-only — declaring `webhookSignature: "none"` and omitting the handlers
 * is the honest representation, not a gap to be filled with a stub.
 */
export interface ProviderAdapterBase {
  /** Stable provider identifier. Matches ProviderConfig.name. */
  readonly name: string;
  /** Adapter contract version this adapter was built against. */
  readonly interfaceVersion: string;
  readonly domain: ProviderDomain;

  getCapabilities(): ProviderCapabilities;
  checkHealth(): Promise<ProviderHealthSnapshot>;

  /** Required when capabilities.reliability.webhookSignature !== "none". */
  verifyWebhookSignature?(
    rawPayload: unknown,
    headers: Record<string, string>
  ): boolean;

  /** Must never be reached for a payload that failed signature verification. */
  normalizeWebhook?(
    rawPayload: unknown,
    headers: Record<string, string>
  ): CanonicalEvent;
}

/**
 * True when the adapter declares webhook support. Used by the conformance
 * suite to decide whether the webhook members are required.
 */
export function declaresWebhooks(adapter: ProviderAdapterBase): boolean {
  return adapter.getCapabilities().reliability.webhookSignature !== "none";
}
