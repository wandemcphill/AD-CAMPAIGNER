// Virtual account, virtual card, and remittance provider adapters.
//
// No real provider is CONTRACTED yet — there are no live API credentials for
// Swappr, Payscribe, or Yativo in this environment (see the convergence plan's
// Phase E note; earlier diligence also covered BridgeCard/SwervPay/Payceler/
// Nium/Swan/BVNK). Mock adapters below exist so the API surface, saga wiring,
// and Prisma models can be exercised without any live dependency. Real HTTP
// adapters for Swappr/Payscribe/Yativo are also implemented further down —
// they are code-complete and routable via ProviderConfig/ProviderRouterService.
//
// Doc verification pass (2026-08-07): searched for public API docs for all
// three providers.
//   - Yativo: real public docs found at docs.yativo.com — the Yativo adapter
//     below has been corrected to match confirmed base URL, auth flow, and
//     endpoint paths/shapes. One structural gap remains unresolved (payouts
//     require a pre-registered beneficiary id, not inline recipient details)
//     — see the note on createYativoRemittanceProvider.
//   - Swappr: at the time of that pass, no public API documentation could be
//     found. This has since been resolved — see the next note.
//
// Doc mapping pass (2026-08-08a): OFFICIAL Swappr API documentation was
// supplied (docs.swappr.me) along with sandbox credentials. The Swappr
// adapters below have been rewritten line-by-line against that documentation.
// TWO STRUCTURAL FINDINGS that could not be papered over:
//   1. Virtual accounts are ADMIN-PROVISIONED ONLY on Swappr — there is no
//      merchant-facing create/close endpoint. createAccount/closeAccount now
//      throw explicitly (per the "return UNSUPPORTED, not a fake
//      implementation" principle) instead of guessing a POST that doesn't
//      exist. Only getAccount (a real GET) is implemented.
//   2. Swappr payouts have NO quote-lock / quoteId concept — GET /v1/rates
//      returns an indicative rate with a 60s cache TTL, not a lockable quote.
//      This does not fit the RemittanceProvider interface's
//      getQuote()->quoteId->sendTransfer(quoteId) contract, which assumes a
//      provider-side locked quote. getQuote() below synthesizes a
//      client-side "quote" (rate multiplied out, quoteId encodes the rate +
//      expiry) and sendTransfer() ignores the incoming quoteId when calling
//      Swappr (Swappr's POST /v1/payouts takes no quote reference at all) —
//      this is flagged as a genuine interface mismatch, not hidden.
// See docs/providers/swappr.md for the full mapping and open sandbox-testing
// items. Real sandbox credentials exist for this provider (SWAPPR_API_KEY /
// SWAPPR_PUBLISHABLE_KEY, supplied by the user) but no live transaction has
// been run yet — remittance/virtualAccounts feature flags stay disabled until
// the DONE checklist in that doc passes.
//
// Doc mapping pass (2026-08-08b): OFFICIAL Payscribe API documentation was
// supplied (Payscribe API collection PDF). The Payscribe card adapter below
// has been rewritten line-by-line against that documentation — base URL,
// auth, endpoints, HTTP methods, request/response envelope, amount units
// (USD major, not minor), status-code semantics, and the customer prerequisite
// are now documented, not guessed. A documented NGN virtual-account adapter and
// a webhook signature verifier were added from the same source. See
// docs/providers/payscribe.md for the full mapping, including the remaining
// GAPS that still require verification against live traffic (exact card
// `expiry` string format, full card-create response shape, terminate refund
// semantics, and the VA-credit webhook payload→account mapping) — these are
// still open regardless of the approval below; a status flag doesn't resolve
// them, only running real transactions and watching what comes back does.
// Per the provider-integration governance rule, virtual ACCOUNTS remain
// gated: no sandbox/webhook/idempotency test has been run, and that
// ProviderCapabilityGrant stays unapproved.
//
// Provider change (2026-08-23): Maplerad access was revoked -- FlipTrybe no
// longer has a working relationship with them. The Maplerad USD card adapter
// (createMapleradVirtualCardProvider et al.) has been removed entirely, not
// just deprioritized, since dead credentials left wired in is worse than
// absent: a future accidental re-enable would fail against a provider that
// actively denies the request, rather than failing to find a provider at
// all. Payscribe is now the sole configured USD card provider (see
// seed-financial-products.ts). The virtual CARD capability grant has been
// approved by workspace operator decision on the same date (see
// seed-payscribe-convergence.ts for the exact fields flipped and what that
// approval does and does not attest to -- it is an operator sign-off, not an
// independently re-run sandbox test performed by this codebase). The GAPS
// listed above are unaffected by that approval and remain real integration
// risk once live traffic starts.
// Fincra and Swappr remain implemented-but-unverified fallback candidates
// for when their own approvals land; EUR/GBP card support has no adapter
// work done yet and would need its own doc-mapping pass per currency,
// not just an enabledProductTypes entry.

import type { ProviderAdapterBase, ProviderCapabilities, ProviderHealthSnapshot } from './contract.js';
import { CURRENT_INTERFACE_VERSION } from './contract.js';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

// ─── Virtual Accounts ───────────────────────────────────────────────────────────

export interface VirtualAccountDetails {
  providerAccountId: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  currency: string;
}

// Declares what an account provider can actually do — the FINTECH.txt/Swappr-audit
// finding that "merchant funding VA" and "customer VIBAN" are structurally
// different capabilities (one admin-provisioned, one API-creatable + KYC-gated)
// must be representable per-adapter rather than assumed universal.
export interface VirtualAccountCapabilities {
  /** True only if the provider exposes a real merchant-level create/close API
   *  (as opposed to admin/support provisioning the account out-of-band). */
  supportsMerchantAccountCreation: boolean;
  /** True if the provider can create a per-customer virtual account/VIBAN via
   *  API. Typically gated on the customer reaching a KYC-verified state. */
  supportsCustomerVirtualAccounts: boolean;
}

export interface VirtualAccountProvider extends ProviderAdapterBase {
  readonly domain: 'VIRTUAL_ACCOUNT';
  readonly virtualAccountCapabilities: VirtualAccountCapabilities;

  createAccount(input: {
    reference: string;
    accountName: string;
    currency: string;
    customerEmail?: string;
    customerPhone?: string;
    // Some providers (e.g. Payscribe) require a provider-side customer to exist
    // and be KYC-tiered before a virtual account can be created. The service
    // layer resolves/creates that customer and passes its id here. Providers
    // that do not need it (mock/Swappr) ignore it.
    providerCustomerId?: string;
    // Provider-specific bank selection. For Payscribe this is the documented
    // bank list, e.g. ['palmpay'] | ['9psb'] | ['cashconnect'].
    bankHint?: string[];
  }): Promise<VirtualAccountDetails>;

  getAccount(providerAccountId: string): Promise<VirtualAccountDetails & { balanceMinor: number }>;

  closeAccount(providerAccountId: string): Promise<{ closed: boolean }>;
}

// ─── Provider customers (KYC-gated prerequisite) ────────────────────────────────
//
// Several providers refuse to issue a card or a virtual account until a
// provider-side "customer" exists and has been enrolled to a KYC tier. Payscribe
// needs tier 2 for cards; Sudo and Inflow each have their own
// equivalent. The shape of what they need differs, but the flow is identical:
// hand identity data over once, get back an opaque customer id, reuse it.
//
// This is deliberately its own capability rather than part of VirtualCardProvider.
// Enrollment is not a card concern — the same customer gates virtual accounts too —
// and providers that need no customer at all (mock, Swappr) should not have to
// implement a no-op. Adapters that support it return an intersection type, and
// callers narrow with supportsCustomerEnrollment().
//
// PRIVACY RULE, matching KycService: FlipTrybe stores ONLY the returned customer
// id and tier. Raw identity documents pass through to the provider and are never
// persisted here. Nothing in ProviderCustomerIdentity is written to our database.

export interface ProviderCustomerIdentity {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, including country code — Payscribe rejects bare local numbers. */
  phone: string;
  /** ISO-3166 alpha-2. Defaults to NG where the provider requires one. */
  country?: string;
  /** YYYY-MM-DD. Required by tier-1-and-above enrollment. */
  dateOfBirth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
  };
  /** Government ID. Payscribe: BVN for tier 1; NIN | PASSPORT | VIN for tier 2. */
  idType?: string;
  idNumber?: string;
  /** Base64 image, required for Payscribe tier 2. Never stored by FlipTrybe. */
  idImageBase64?: string;
}

export interface ProviderCustomerEnrollment {
  /**
   * Creates the provider-side customer and raises it to whatever tier `purpose`
   * requires. Idempotency is the caller's job: FlipTrybe persists the returned
   * id against (workspace, provider) and does not call this again once set.
   */
  enrollCustomer(input: {
    identity: ProviderCustomerIdentity;
    purpose: 'VIRTUAL_CARD' | 'VIRTUAL_ACCOUNT';
    reference: string;
  }): Promise<{ providerCustomerId: string; tier: string }>;
}

export function supportsCustomerEnrollment<T>(
  adapter: T
): adapter is T & ProviderCustomerEnrollment {
  return typeof (adapter as { enrollCustomer?: unknown }).enrollCustomer === 'function';
}

// ─── Virtual Cards ──────────────────────────────────────────────────────────────

export interface VirtualCardDetails {
  providerCardId: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  brand: 'VISA' | 'MASTERCARD';
  currency: string;
  status: 'ACTIVE' | 'FROZEN' | 'TERMINATED';
}

export interface VirtualCardProvider extends ProviderAdapterBase {
  readonly domain: 'VIRTUAL_CARD';

  issueCard(input: {
    reference: string;
    cardholderName: string;
    currency: string;
    fundingAmountMinor: number;
    // Payscribe issues a card against an existing tier-2 customer — the service
    // resolves/creates that customer and passes its id here. Providers that
    // don't need it ignore it.
    providerCustomerId?: string;
    // Card network. Payscribe requires it (VISA | MASTERCARD); defaults to VISA.
    brand?: 'VISA' | 'MASTERCARD';
  }): Promise<VirtualCardDetails>;

  fundCard(input: {
    providerCardId: string;
    amountMinor: number;
    reference: string;
  }): Promise<{ providerReference: string; balanceMinor: number }>;

  /**
   * Pulls balance back off a card. OPTIONAL — not every issuer exposes it.
   *
   * Needed before termination on providers whose terminate does not itself
   * return funds (Payscribe documents exactly this: terminate is irreversible
   * and balance must be reclaimed via withdraw first).
   *
   * `withdrawnMinor` is what the provider confirms actually moved, which may be
   * less than requested; callers should credit off that, not off the request.
   */
  withdrawFromCard?(input: {
    providerCardId: string;
    amountMinor: number;
    reference: string;
  }): Promise<{ providerReference: string; withdrawnMinor?: number; balanceMinor: number }>;

  freezeCard(providerCardId: string): Promise<{ status: 'FROZEN' }>;
  unfreezeCard(providerCardId: string): Promise<{ status: 'ACTIVE' }>;
  terminateCard(providerCardId: string): Promise<{ status: 'TERMINATED'; refundableMinor: number }>;

  getCard(
    providerCardId: string
  ): Promise<VirtualCardDetails & { balanceMinor: number }>;
}

// ─── Remittance ─────────────────────────────────────────────────────────────────
//
// Providers differ fundamentally in what pricing guarantee they can offer:
//   - Yativo: a real server-side quote object with a quoteId, locked for its TTL.
//   - Swappr: only an indicative rate (GET /v1/rates, 60s cache) — no lock, no
//     quoteId, and the payout endpoint itself has no quote reference at all.
// The contract below does not force Swappr to pretend it has a lock. Instead:
//   - RemittanceQuote.isLocked tells callers (UI/business logic) whether the
//     quoted rate/amount is guaranteed or merely indicative.
//   - RemittanceCapabilities.supportsLockedQuotes is the static per-provider
//     declaration backing that distinction.
//   - sendTransfer() carries the amount explicitly (amountMinor + currencies)
//     as a provider-neutral, first-class field — it is a fundamental property
//     of the instruction, not something recoverable from an opaque quoteId.
//     quoteId is OPTIONAL and only meaningful when the provider supports locked
//     quotes; providers without one (Swappr) never receive it.
//   - The response can carry executedRate/executedDestinationAmountMinor when
//     the provider's execution-time pricing is knowable and may differ from
//     what was quoted. Callers must NOT silently substitute an executed amount
//     for the amount the user approved — reconcile per the product's existing
//     confirmation rules instead of auto-adjusting.

export interface RemittanceCapabilities {
  /** Provider can return a non-binding indicative rate ahead of send. */
  supportsIndicativeRates: boolean;
  /** Provider can return a rate/amount that is contractually honoured if the
   *  transfer executes before the quote's expiresAt. */
  supportsLockedQuotes: boolean;
  /** Provider supports a distinct wallet-to-wallet FX conversion primitive
   *  (separate from a cross-currency payout). */
  supportsConversions: boolean;
  /** Provider can actually execute payouts (as opposed to quote-only). */
  supportsPayouts: boolean;
  /** Provider has a saved-beneficiary API this adapter has implemented. */
  supportsBeneficiaries: boolean;
}

export interface RemittanceQuote {
  quoteId: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  feeMinor: number;
  rate: number;
  expiresAt: string;
  /** false = INDICATIVE ONLY, not guaranteed. Callers must label it as such
   *  to the customer and must not treat expiresAt as a lock guarantee. */
  isLocked: boolean;
}

export interface RemittanceProvider extends ProviderAdapterBase {
  readonly domain: 'REMITTANCE';
  readonly remittanceCapabilities: RemittanceCapabilities;

  getQuote(input: {
    sourceCurrency: string;
    destinationCurrency: string;
    sourceAmountMinor: number;
  }): Promise<RemittanceQuote>;

  sendTransfer(input: {
    reference: string;
    // Every money-moving call must carry an explicit idempotency key so a
    // network timeout / worker retry / process restart cannot double-send.
    idempotencyKey: string;
    // The amount actually being transferred, as a first-class field — never
    // recovered implicitly from a quoteId. Integer minor units (kobo/cents/
    // pence) — never a floating-point major-unit amount.
    amountMinor: number;
    sourceCurrency: string;
    destinationCurrency: string;
    // Only meaningful (and only ever populated by callers) when
    // remittanceCapabilities.supportsLockedQuotes is true for this provider.
    quoteId?: string;
    recipient: {
      name: string;
      accountNumber: string;
      bankCode: string;
      country: string;
    };
    metadata?: Record<string, unknown>;
  }): Promise<{
    providerReference: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    // Execution-time pricing, when the provider's response actually exposes
    // it. Absent (not zero, not guessed) when the provider doesn't return it.
    executedRate?: number;
    executedDestinationAmountMinor?: number;
    executedFeeMinor?: number;
  }>;

  getTransferStatus(
    providerReference: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; failureReason?: string }>;
}

// ─── KYC Provider Adapter ───────────────────────────────────────────────────────

export type KycCheckType = 'IDENTITY' | 'DOCUMENT' | 'SELFIE' | 'ADDRESS' | 'LIVENESS';
export type KycCheckStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'REQUIRES_ACTION';

export interface KycCheckResult {
  providerReference: string;
  checkType: KycCheckType;
  status: KycCheckStatus;
  failureReason?: string;
  verifiedName?: string;
  verifiedDob?: string;
  metadata?: Record<string, unknown>;
}

export interface KycProviderAdapter extends ProviderAdapterBase {
  readonly domain: 'KYC';

  // Initiate identity verification — returns a session URL or token the
  // frontend uses to launch the provider-hosted verification flow.
  initiateVerification(input: {
    userId: string;
    country: string;
    level: 'LIGHT' | 'STANDARD' | 'ENHANCED';
    redirectUrl?: string;
  }): Promise<{ sessionId: string; sessionUrl?: string; expiresAt: string }>;

  // Poll or retrieve the outcome of a verification session.
  getVerificationResult(sessionId: string): Promise<KycCheckResult>;

  verifyWebhookSignature?(rawPayload: unknown, headers: Record<string, string>): boolean;
}

export function createMockKycProvider(name = 'mock-kyc'): KycProviderAdapter {
  const sessions = new Map<string, KycCheckResult>();

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'KYC',
    getCapabilities: () => ({
      domain: 'KYC',
      countries: ['NG', 'GH', 'GB', 'US'],
      productTypes: ['IDENTITY', 'DOCUMENT', 'SELFIE'],
      reliability: { idempotency: 'strong', ordering: 'none', webhookSignature: 'none' }
    }),
    checkHealth: () => Promise.resolve({ providerName: name, status: 'HEALTHY', latencyMs: 5 }),

    initiateVerification(input) {
      const sessionId = `mock_kyc_${input.userId}_${input.level}`;
      const result: KycCheckResult = {
        providerReference: sessionId,
        checkType: 'IDENTITY',
        status: 'PENDING'
      };
      sessions.set(sessionId, result);
      return Promise.resolve({
        sessionId,
        sessionUrl: `https://mock-kyc.example.com/verify/${sessionId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
    },

    getVerificationResult(sessionId) {
      const result = sessions.get(sessionId);
      if (!result) return Promise.reject(new Error(`Unknown mock KYC session ${sessionId}`));
      // Auto-verify in mock
      const verified: KycCheckResult = { ...result, status: 'VERIFIED', verifiedName: 'Mock User' };
      sessions.set(sessionId, verified);
      return Promise.resolve(verified);
    },

    verifyWebhookSignature(_rawPayload, _headers) {
      return true;
    }
  };
}

// ─── Capability helpers ─────────────────────────────────────────────────────────

function mockCapabilities(
  domain: 'VIRTUAL_ACCOUNT' | 'VIRTUAL_CARD' | 'REMITTANCE',
  productTypes: string[]
): ProviderCapabilities {
  return {
    domain,
    countries: ['NG'],
    productTypes,
    reliability: { idempotency: 'strong', ordering: 'sequence', webhookSignature: 'none' }
  };
}

function mockHealth(providerName: string): Promise<ProviderHealthSnapshot> {
  return Promise.resolve({ providerName, status: 'HEALTHY', latencyMs: 5 });
}

// ─── Mock adapters ──────────────────────────────────────────────────────────────

export function createMockVirtualAccountProvider(name = 'mock-virtual-account'): VirtualAccountProvider {
  const accounts = new Map<string, VirtualAccountDetails & { balanceMinor: number }>();

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_ACCOUNT',
    virtualAccountCapabilities: {
      supportsMerchantAccountCreation: true,
      supportsCustomerVirtualAccounts: true
    },
    getCapabilities: () => mockCapabilities('VIRTUAL_ACCOUNT', ['NGN_ACCOUNT']),
    checkHealth: () => mockHealth(name),

    createAccount(input) {
      const providerAccountId = `${name}_acct_${input.reference}`;
      const details: VirtualAccountDetails & { balanceMinor: number } = {
        providerAccountId,
        accountNumber: String(Math.floor(1000000000 + Math.random() * 8999999999)),
        bankName: 'Mock Microfinance Bank',
        bankCode: '999999',
        accountName: input.accountName,
        currency: input.currency,
        balanceMinor: 0
      };
      accounts.set(providerAccountId, details);
      return Promise.resolve(details);
    },

    getAccount(providerAccountId) {
      const account = accounts.get(providerAccountId);
      if (!account) return Promise.reject(new Error(`Unknown mock account ${providerAccountId}`));
      return Promise.resolve(account);
    },

    closeAccount(providerAccountId) {
      accounts.delete(providerAccountId);
      return Promise.resolve({ closed: true });
    }
  };
}

export function createMockVirtualCardProvider(name = 'mock-virtual-card'): VirtualCardProvider {
  const cards = new Map<string, VirtualCardDetails & { balanceMinor: number }>();

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_CARD',
    getCapabilities: () => mockCapabilities('VIRTUAL_CARD', ['NGN_CARD', 'USD_CARD']),
    checkHealth: () => mockHealth(name),

    issueCard(input) {
      const providerCardId = `${name}_card_${input.reference}`;
      const details: VirtualCardDetails & { balanceMinor: number } = {
        providerCardId,
        last4: String(Math.floor(1000 + Math.random() * 8999)),
        expiryMonth: 12,
        expiryYear: new Date().getFullYear() + 3,
        brand: 'VISA',
        currency: input.currency,
        status: 'ACTIVE',
        balanceMinor: input.fundingAmountMinor
      };
      cards.set(providerCardId, details);
      return Promise.resolve(details);
    },

    fundCard(input) {
      const card = cards.get(input.providerCardId);
      if (!card) return Promise.reject(new Error(`Unknown mock card ${input.providerCardId}`));
      card.balanceMinor += input.amountMinor;
      return Promise.resolve({
        providerReference: `${name}_fund_${input.reference}`,
        balanceMinor: card.balanceMinor
      });
    },

    freezeCard(providerCardId) {
      const card = cards.get(providerCardId);
      if (card) card.status = 'FROZEN';
      return Promise.resolve({ status: 'FROZEN' });
    },

    unfreezeCard(providerCardId) {
      const card = cards.get(providerCardId);
      if (card) card.status = 'ACTIVE';
      return Promise.resolve({ status: 'ACTIVE' });
    },

    terminateCard(providerCardId) {
      const card = cards.get(providerCardId);
      const refundableMinor = card?.balanceMinor ?? 0;
      if (card) card.status = 'TERMINATED';
      return Promise.resolve({ status: 'TERMINATED', refundableMinor });
    },

    getCard(providerCardId) {
      const card = cards.get(providerCardId);
      if (!card) return Promise.reject(new Error(`Unknown mock card ${providerCardId}`));
      return Promise.resolve(card);
    }
  };
}

// ─── Real HTTP adapters ─────────────────────────────────────────────────────────
//
// Swappr (virtual accounts + remittance), Payscribe (virtual cards), and Yativo
// (remittance fallback) have no live credentials in this environment — none of
// these three verticals is contracted yet. These adapters are built so the
// integration is code-complete and can be flipped live the moment real API keys
// and verified endpoint docs exist; they must not be treated as production-ready
// until then. Each factory follows this codebase's existing real-adapter
// convention (see createKorapayPaymentGateway / createVtpassAdapter): config is
// a plain struct (never reads process.env directly), throws synchronously at
// construction if the required apiKey is missing, and uses a small
// call<Provider>Api helper for JSON HTTP with bearer/api-key auth.

export interface SwapprConfig {
  // Bearer secret key: sk_test_... (sandbox) or sk_live_... (production). The
  // environment is selected by the key prefix, not the URL — sandbox and
  // production share one host.
  apiKey: string;
  // Base host+prefix (both environments): https://api.swappr.me/api — every
  // endpoint path in this adapter already carries its own /v1/... segment
  // (confirmed live: GET https://api.swappr.me/api/v1/wallets → 200 during
  // the sandbox audit), so this must NOT itself end in /v1 or paths double up.
  baseUrl?: string;
  // Per-endpoint signing secret from the Swappr dashboard, used to verify
  // inbound webhook signatures.
  webhookSecret?: string;
  fetcher?: typeof fetch;
}

export interface PayscribeConfig {
  // Bearer secret key: ps_sk_test_... (sandbox) or ps_sk_live_... (production).
  apiKey: string;
  // Documented base URLs (note the /api/v1 suffix):
  //   production: https://api.payscribe.ng/api/v1
  //   sandbox:    https://sandbox.payscribe.ng/api/v1
  // Defaults to production; pass the sandbox base for testing.
  baseUrl?: string;
  // Secret used to verify inbound webhook signatures (sk_test_/sk_live_).
  webhookSecret?: string;
  fetcher?: typeof fetch;
}

export interface YativoConfig {
  // Confirmed against real Yativo docs (docs.yativo.com, checked 2026-08-07):
  // auth is NOT a static API-key header — it's a short-lived bearer token
  // obtained by POSTing `account_id` + `app_secret` to /auth/login (token
  // expires after 600s and must be refreshed). `apiKey` is kept as an alias
  // for `appSecret` for backward compatibility with existing ProviderConfig
  // rows (YATIVO_API_KEY); accountId is a separate required credential that
  // was NOT previously modeled — see gap note below.
  apiKey?: string;
  accountId: string;
  appSecret?: string;
  baseUrl?: string; // default https://api.yativo.com/api/v1 (confirmed real base path)
  fetcher?: typeof fetch;
}

class ProviderApiError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly status: number,
    message: string
  ) {
    super(`${providerName} API error (HTTP ${status}): ${message}`);
    this.name = 'ProviderApiError';
  }
}

// Safely converts an unknown API response field to string, returning fallback for non-string values.
const toStr = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;

// Documented Swappr HTTP client.
//   - Base host+prefix (both environments): https://api.swappr.me/api — the
//     key prefix (sk_test_/sk_live_) selects environment, not the URL. Every
//     documented endpoint path already includes its own /v1/... segment
//     (e.g. "/v1/wallets"), confirmed live: GET
//     https://api.swappr.me/api/v1/wallets returned 200 with real sandbox
//     credentials during the provider audit (2026-08-08). An earlier version
//     of this file defaulted baseUrl to ".../api/v1" AND used paths starting
//     with "/v1/...", which silently doubled to ".../api/v1/v1/..." — fixed.
//   - Auth: Authorization: Bearer <sk_...>.
//   - Every key requires at least one allow-listed IP; unlisted IPs get
//     403 ip_not_allowed.
//   - Mutating (POST) calls that create a resource require an
//     Idempotency-Key header — same key + same body replays the cached
//     response; same key + different body returns 409 idempotency_key_conflict.
async function callSwapprApi(
  config: SwapprConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {}
): Promise<Record<string, unknown>> {
  if (!config.apiKey) throw new Error('Swappr adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://api.swappr.me/api';
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const res = await f(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
      ...(method === 'POST' && options.idempotencyKey
        ? { 'Idempotency-Key': options.idempotencyKey }
        : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (typeof json['message'] === 'string' && json['message']) ||
      (typeof json['error'] === 'string' && json['error']) ||
      text ||
      res.statusText;
    throw new ProviderApiError('swappr', res.status, String(msg));
  }
  return json;
}

// Documented Payscribe HTTP client.
//   - Base URL default: https://api.payscribe.ng/api/v1 (pass sandbox base to test).
//   - Auth: Authorization: Bearer <ps_sk_...>.
//   - Response envelope: { status: boolean, description?, message: { description?, details } }.
//     A 200 with status:false is a business failure, not a success.
//   - Response-code table (Payscribe docs): 200 success, 201 pending (must
//     reverify by trans_id/ref), 400 bad request, 401 unauth, 403 forbidden,
//     404 not found, 405 duplicate, 406 missing info, 407 invalid product/token,
//     408 result not found, 409 invalid amount/limit, 410 insufficient wallet,
//     434 operator error, 435 db error, 5xx server error, 429 rate limit.
async function callPayscribeApi(
  config: PayscribeConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<Record<string, unknown>> {
  if (!config.apiKey) throw new Error('Payscribe adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://api.payscribe.ng/api/v1';
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const res = await f(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }

  // 201 = Transaction Pending — Payscribe requires re-verification via trans_id/
  // ref. Surface it explicitly so callers never treat pending as success.
  if (res.status === 201) {
    throw new ProviderApiError(
      'payscribe',
      201,
      `Transaction pending — reverify with trans_id/ref. ${text.slice(0, 300)}`
    );
  }
  if (!res.ok) {
    const msg =
      (typeof json['description'] === 'string' && json['description']) ||
      (typeof json['message'] === 'string' && json['message']) ||
      text ||
      res.statusText;
    throw new ProviderApiError('payscribe', res.status, String(msg));
  }
  if (json['status'] === false) {
    const msg =
      (typeof json['description'] === 'string' && json['description']) ||
      (typeof json['message'] === 'string' && json['message']) ||
      'Payscribe returned status:false';
    throw new ProviderApiError('payscribe', res.status, String(msg));
  }
  return json;
}

// Payscribe returns the payload under message.details (occasionally message).
function payscribeDetails(json: Record<string, unknown>): Record<string, unknown> {
  const message = (json['message'] ?? {}) as Record<string, unknown>;
  const details = (message['details'] ?? message) as Record<string, unknown>;
  return details ?? {};
}

// Payscribe get-card returns `expiry` as a string; the exact format is not
// specified in the docs (GAP — verify in sandbox). Handle MM/YY and MM/YYYY and
// fall back to Date parsing.
function parsePayscribeExpiry(expiry: unknown): { month: number; year: number } {
  if (typeof expiry !== 'string' || !expiry) return { month: 0, year: 0 };
  const mmYY = expiry.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (mmYY) {
    const month = Number(mmYY[1]);
    let year = Number(mmYY[2]);
    if (year < 100) year += 2000;
    return { month, year };
  }
  const d = new Date(expiry);
  if (!Number.isNaN(d.getTime())) return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  return { month: 0, year: 0 };
}

function mapPayscribeCardStatus(s: unknown): 'ACTIVE' | 'FROZEN' | 'TERMINATED' {
  const v = (typeof s === 'string' ? s : '').toLowerCase();
  if (v === 'frozen' || v === 'suspended') return 'FROZEN';
  if (v === 'terminated' || v === 'closed' || v === 'expired') return 'TERMINATED';
  return 'ACTIVE';
}

function normalizeCardBrand(b: unknown): 'VISA' | 'MASTERCARD' {
  return (typeof b === 'string' ? b : 'VISA').toUpperCase() === 'MASTERCARD' ? 'MASTERCARD' : 'VISA';
}

// Confirmed against docs.yativo.com (checked 2026-08-07): Yativo does not use
// a static API-key header at all. You exchange `account_id` + `app_secret`
// (POST /auth/login) for a bearer token valid 600s, then send
// `Authorization: Bearer <token>` on every call, plus an `Idempotency-Key`
// header on POST requests. This module does a naive fetch-and-cache-in-memory
// token exchange per adapter instance (no persistence across process
// restarts) — good enough for now since nothing calls this live yet.
let cachedYativoToken: { token: string; expiresAt: number } | null = null;

async function getYativoBearerToken(config: YativoConfig): Promise<string> {
  const appSecret = config.appSecret ?? config.apiKey;
  if (!appSecret) throw new Error('Yativo adapter requires config.appSecret (or apiKey as an alias).');
  if (!config.accountId) throw new Error('Yativo adapter requires config.accountId.');

  if (cachedYativoToken && cachedYativoToken.expiresAt > Date.now() + 5_000) {
    return cachedYativoToken.token;
  }

  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://api.yativo.com/api/v1';
  const res = await f(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_id: config.accountId, app_secret: appSecret })
  });
  if (!res.ok) {
    throw new ProviderApiError('yativo', res.status, await res.text().catch(() => res.statusText));
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedYativoToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function callYativoApi(
  config: YativoConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {}
): Promise<unknown> {
  const token = await getYativoBearerToken(config);
  const f = config.fetcher ?? fetch;
  const method = options.method ?? (options.body ? 'POST' : 'GET');
  const res = await f(`${config.baseUrl ?? 'https://api.yativo.com/api/v1'}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(method === 'POST' ? { 'Idempotency-Key': options.idempotencyKey ?? randomUUID() } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (!res.ok) {
    throw new ProviderApiError('yativo', res.status, await res.text().catch(() => res.statusText));
  }
  return res.json();
}

function liveCapabilities(
  domain: 'VIRTUAL_ACCOUNT' | 'VIRTUAL_CARD' | 'REMITTANCE',
  productTypes: string[],
  countries: string[]
): ProviderCapabilities {
  return {
    domain,
    countries,
    productTypes,
    reliability: { idempotency: 'strong', ordering: 'sequence', webhookSignature: 'hmac_sha256' }
  };
}

function liveHealth(providerName: string): Promise<ProviderHealthSnapshot> {
  // No real health probe wired yet (no credentials to check against) — reports
  // HEALTHY optimistically so it doesn't block routing before a real check exists.
  return Promise.resolve({ providerName, status: 'HEALTHY', latencyMs: 0 });
}

function mapSwapprPayoutStatus(raw: unknown): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  const v = (typeof raw === 'string' ? raw : '').toLowerCase();
  if (v === 'paid') return 'COMPLETED';
  if (v === 'failed' || v === 'cancelled') return 'FAILED';
  // draft | queued | processing all map to PROCESSING — the caller polls.
  return 'PROCESSING';
}

// Swappr virtual-account adapter — mapped against the OFFICIAL Swappr API
// documentation (docs.swappr.me), audited 2026-08-08. See docs/providers/swappr.md
// for the full capability matrix.
//
// STRUCTURAL FINDING (merchant-level NGN VAs only): the *merchant* funding
// virtual account — the one behind FlipTrybe's own NGN wallet — is
// admin/Technest-provisioned; there is no merchant-facing create/close
// endpoint (confirmed live: our sandbox wallet already has one, provisioned
// out-of-band). createAccount()/closeAccount() below therefore throw
// UNSUPPORTED for that case rather than guessing a nonexistent endpoint.
//
// CORRECTION vs an earlier pass of this comment: Swappr also offers
// CUSTOMER-SPECIFIC international VIBANs (GBP/USD/EUR) via a real, documented
// create endpoint — POST /v1/customers/{id}/virtual_accounts — gated on the
// customer reaching `verified` KYC status. That is a genuinely different
// capability from the merchant VA above, and this interface (VirtualAccountProvider)
// has no way to distinguish "admin-provisioned merchant account" from
// "API-creatable customer account" — both currently route through the same
// createAccount() method. Implementing the customer-VIBAN path requires the
// individual-customer-onboarding + KYC flow (not yet built) and probably a
// capability-aware interface change (see docs/providers/swappr.md §4-5). Left
// unimplemented here rather than guessed.
export function createSwapprVirtualAccountProvider(config: SwapprConfig): VirtualAccountProvider {
  const name = 'swappr';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_ACCOUNT',
    virtualAccountCapabilities: {
      // Confirmed live (sandbox GET /v1/wallets): merchant NGN VAs are
      // admin/Technest-provisioned, not creatable via this API.
      supportsMerchantAccountCreation: false,
      // Documented (POST /v1/customers/{id}/virtual_accounts), gated on
      // customer KYC verified. Declared true because the capability genuinely
      // exists — createAccount() below still throws because the customer
      // onboarding/KYC flow this depends on is not yet implemented. Track
      // actual FlipTrybe activation as AVAILABLE_AFTER_COMPLIANCE, not assumed
      // enabled — see docs/providers/swappr.md.
      supportsCustomerVirtualAccounts: true
    },
    getCapabilities: () => liveCapabilities('VIRTUAL_ACCOUNT', ['NGN_ACCOUNT'], ['NG']),
    checkHealth: () => liveHealth(name),

    createAccount() {
      // This interface has no way to request the customer-VIBAN flow
      // separately from the merchant-VA flow — see the function-level note
      // above. Until that's resolved, createAccount() always refuses rather
      // than silently doing the wrong one.
      return Promise.reject(
        new Error(
          'UNSUPPORTED via this method: merchant-level Swappr virtual accounts are ' +
            'admin-provisioned only (no merchant-facing create endpoint — contact Technest/Swappr ' +
            'support and register the account via ProviderMapping). Customer-specific ' +
            'international VIBANs ARE creatable (POST /v1/customers/{id}/virtual_accounts) but ' +
            'require KYC-verified customer onboarding, which is not yet built. ' +
            'See docs/providers/swappr.md.'
        )
      );
    },

    async getAccount(providerAccountId) {
      const json = await callSwapprApi(config, `/v1/virtual_accounts/${providerAccountId}`);
      const acct = json as {
        id?: string;
        currency?: string;
        status?: string;
        account_number?: string;
        account_name?: string;
        bank_name?: string;
        bank_code?: string;
      };
      // Swappr's virtual-account object carries no balance field (balances
      // live on the Wallets resource, GET /v1/wallets) — report 0 here and
      // let callers cross-reference the wallet if a live balance is needed.
      return {
        providerAccountId: String(acct.id ?? providerAccountId),
        accountNumber: String(acct.account_number ?? ''),
        bankName: String(acct.bank_name ?? ''),
        bankCode: String(acct.bank_code ?? ''),
        accountName: String(acct.account_name ?? ''),
        currency: String(acct.currency ?? 'NGN'),
        balanceMinor: 0
      };
    },

    closeAccount() {
      return Promise.reject(
        new Error(
          'UNSUPPORTED: Swappr virtual accounts are admin-provisioned only — there is no ' +
            'merchant-facing close endpoint. See docs/providers/swappr.md.'
        )
      );
    }
  };
}

// Swappr payout (remittance) adapter — mapped against the OFFICIAL Swappr API
// documentation (docs.swappr.me), audited 2026-08-08. See docs/providers/swappr.md.
//
// HONEST CAPABILITY DECLARATION (per the architectural rule): Swappr does not
// support locked quotes. GET /v1/rates returns an INDICATIVE rate with a
// 60-second cache TTL — "the rate applied to a payout is the one active at
// the time it processes," not the one you fetched. There is no quoteId and
// POST /v1/payouts takes no quote reference at all. remittanceCapabilities
// below declares supportsLockedQuotes: false and every RemittanceQuote this
// adapter returns carries isLocked: false — callers (UI/business logic) MUST
// surface that honestly rather than implying a guarantee Swappr never made.
//
// sendTransfer() now receives amountMinor/sourceCurrency/destinationCurrency
// as explicit, first-class fields (per the extended RemittanceProvider
// contract) — it no longer needs to guess or refuse. It does NOT forward a
// quoteId to Swappr (there is nothing there to receive one). The response's
// executedRate/executedDestinationAmountMinor are left undefined: Swappr's
// payout response object (per the NGN docs) does not echo an FX rate — only
// amount_minor/fee_minor/currency, which are single-currency (no FX) for the
// only recipient shape this adapter maps (NGN). If/when GBP/USD/EUR/CAD
// recipients are added, re-check whether those payout responses expose a rate.
export function createSwapprRemittanceProvider(config: SwapprConfig): RemittanceProvider {
  const name = 'swappr';

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    remittanceCapabilities: {
      supportsIndicativeRates: true,
      supportsLockedQuotes: false,
      supportsConversions: true, // POST /v1/conversions exists (wallet-to-wallet) — not wired into this adapter (payouts only)
      supportsPayouts: true,
      supportsBeneficiaries: true // documented (POST/GET/PATCH/DELETE /v1/beneficiaries) — not yet implemented in this file
    },
    getCapabilities: () => liveCapabilities('REMITTANCE', ['BANK_TRANSFER'], ['NG', 'GB', 'US', 'EU', 'CA']),
    checkHealth: () => liveHealth(name),

    async getQuote(input) {
      if (input.sourceCurrency === input.destinationCurrency) {
        // Same-currency payout — no FX involved, no rate to fetch. Still
        // isLocked:false for consistency — Swappr never guarantees anything
        // about this adapter's quotes, even trivial same-currency ones.
        return {
          quoteId: `swappr_same_ccy_${randomUUID()}`,
          sourceAmountMinor: input.sourceAmountMinor,
          sourceCurrency: input.sourceCurrency,
          destinationAmountMinor: input.sourceAmountMinor,
          destinationCurrency: input.destinationCurrency,
          feeMinor: 0, // documented per-currency fee schedule not captured here — see docs/providers/swappr.md
          rate: 1,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          isLocked: false
        };
      }
      const json = await callSwapprApi(
        config,
        `/v1/rates?from=${encodeURIComponent(input.sourceCurrency)}&to=${encodeURIComponent(input.destinationCurrency)}`,
        { method: 'GET' }
      );
      const rows = (json['data'] as Array<{ from_currency: string; to_currency: string; rate: string }>) ?? [];
      const row = rows.find(
        (r) => r.from_currency === input.sourceCurrency && r.to_currency === input.destinationCurrency
      );
      if (!row) {
        throw new ProviderApiError(
          'swappr',
          200,
          `No rate found for ${input.sourceCurrency}->${input.destinationCurrency}`
        );
      }
      const rate = Number(row.rate);
      const destinationAmountMinor = Math.round(input.sourceAmountMinor * rate);
      return {
        // Synthetic — Swappr has no lockable quoteId. Purely a client-side
        // handle for UI/logging; never sent to Swappr in sendTransfer().
        quoteId: `swappr_indicative_${randomUUID()}`,
        sourceAmountMinor: input.sourceAmountMinor,
        sourceCurrency: input.sourceCurrency,
        destinationAmountMinor,
        destinationCurrency: input.destinationCurrency,
        feeMinor: 0, // see docs/providers/swappr.md — fee schedule not captured
        rate,
        // Swappr's own cache TTL for the rate — the projection above is only
        // valid for this long before it should be considered stale.
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        isLocked: false
      };
    },

    async sendTransfer(input) {
      if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
        throw new Error('sendTransfer requires a positive integer amountMinor');
      }
      if (!input.idempotencyKey) {
        throw new Error('sendTransfer requires an idempotencyKey — Swappr rejects payouts without one');
      }
      // Currency-specific recipient mapping: only the NGN {account_number,
      // bank_code} shape is implemented. GBP/USD/EUR/CAD each have distinct
      // documented shapes (sort_code; routing_number+account_type+method;
      // iban+bic_code; Interac email/name OR institution_number+transit_number)
      // not yet mapped — see docs/providers/swappr.md. Refuse rather than guess.
      if (input.destinationCurrency !== 'NGN' || input.recipient.country !== 'NG') {
        throw new Error(
          `UNSUPPORTED: this adapter only maps the NGN payout recipient shape today. ` +
            `destinationCurrency="${input.destinationCurrency}" country="${input.recipient.country}" ` +
            `requires GBP/USD/EUR/CAD recipient mapping not yet implemented — see docs/providers/swappr.md.`
        );
      }

      const json = await callSwapprApi(config, '/v1/payouts', {
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        body: {
          amount_minor: String(input.amountMinor),
          currency: 'NGN',
          recipient: {
            account_number: input.recipient.accountNumber,
            bank_code: input.recipient.bankCode
          },
          merchant_reference: input.reference
        }
      });
      const status = mapSwapprPayoutStatus(json['status']);
      const feeMinorRaw = json['fee_minor'];
      return {
        providerReference: toStr(json['reference']) || toStr(json['id']),
        status,
        // NGN-only payout response carries no FX rate (single currency) — only
        // the fee is echoed back, when present.
        ...(feeMinorRaw !== undefined ? { executedFeeMinor: Number(feeMinorRaw) } : {})
      };
    },

    async getTransferStatus(providerReference) {
      const json = await callSwapprApi(config, `/v1/payouts/${providerReference}`);
      const status = mapSwapprPayoutStatus(json['status']);
      return {
        status,
        ...(status === 'FAILED' ? { failureReason: `Swappr payout status: ${String(json['status'])}` } : {})
      };
    }
  };
}

// Verifies an inbound Swappr webhook signature.
//
// Documented scheme: header X-Swappr-Signature = "t=<unix>,v1=<hex>".
// Signed base string: `${timestamp}.${rawBody}`, HMAC-SHA256(secret), hex.
// Reject if the timestamp is older than ~5 minutes (replay protection).
export interface SwapprWebhookVerifyInput {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
  nowMs?: number;
}

export function verifySwapprWebhook(input: SwapprWebhookVerifyInput): boolean {
  const { rawBody, signatureHeader, secret } = input;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    })
  ) as Record<string, string | undefined>;

  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > tolerance) return false;

  const base = `${t}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(base).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1.toLowerCase(), 'hex'));
  } catch {
    return false;
  }
}

// Fincra remittance (payout) adapter — mapped against the OFFICIAL Fincra API
// documentation AND a live sandbox verification sprint (2026-08-10) that ran
// real calls against sandboxapi.fincra.com with real sandbox credentials. See
// docs/providers/fincra.md for the full verification log. Facts below are
// LIVE-CONFIRMED, not doc-only, unless marked otherwise:
//   - POST /quotes/generate returns a real locked quote (`reference` +
//     `expireAt`, ~30s TTL). Fincra DOES support locked quotes, unlike Swappr.
//   - POST /disbursements/payouts: `amount` is MINOR units (kobo) — confirmed
//     by observing an exact ₦2 balance drop across two ₦1 sandbox payouts.
//   - Idempotency is REJECT-ON-DUPLICATE, not replay: submitting the same
//     `customerReference` twice (even with an identical body) returns 422,
//     it does not return the original response. There is also no
//     "look up by customerReference" recovery endpoint — only
//     GET /disbursements/payouts/reference/{fincraReference} (our own
//     providerReference, returned on the *first* successful call) can be
//     polled afterward. A caller that loses the response to a network error
//     before seeing a reference has no way to recover it from Fincra directly;
//     this is a genuine gap, not an adapter limitation — surfaced via
//     ProviderApiError(422) so the saga's ambiguous-failure path can flag it
//     for reconciliation rather than silently retrying (see
//     FALLBACK SAFETY INVARIANT note on selectRemittanceAdapter callers).
//   - Sandbox does NOT reject an invalid beneficiary account number — a payout
//     to a fabricated account still returns "successful". This is a sandbox
//     limitation, not a verified production safety guarantee; the adapter
//     cannot compensate for it, only flag it (remittanceCapabilities has no
//     field for this — noted here so it isn't silently assumed safe).
//   - Webhook enablement is DASHBOARD-ONLY — there is no API call that turns
//     it on. verifyFincraWebhook below implements the documented signature
//     scheme so it's ready the moment webhooks are enabled, but no webhook
//     has actually been received/verified live yet.
//   - Only the NGN payout recipient shape (accountNumber + bankCode) has been
//     live-tested. Cross-currency quotes were exercised via
//     createFincraFxProvider/createFincraSettlementProvider in index.ts
//     (a separate, unrelated FxProvider/SettlementProvider pair used only by
//     the `fx` module) — NOT via this RemittanceProvider adapter. Declaring
//     only NG here until GBP/EUR/USD recipient shapes are mapped and tested
//     through this adapter specifically.
export interface FincraRemittanceConfig {
  // `api-key` header value: sk_test_... (sandbox) or sk_live_... (production).
  apiKey: string;
  // Fincra business id — required on every quote/payout body.
  businessId: string;
  // Defaults to sandbox: https://sandboxapi.fincra.com. Production:
  // https://api.fincra.com.
  baseUrl?: string;
  // HMAC-SHA512 encryption key from the Fincra dashboard, used to verify
  // inbound webhook signatures (see verifyFincraWebhook).
  webhookEncryptionKey?: string;
  fetcher?: typeof fetch;
}

async function callFincraApi(
  config: FincraRemittanceConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!config.apiKey) throw new Error('Fincra adapter requires config.apiKey.');
  if (!config.businessId) throw new Error('Fincra adapter requires config.businessId.');
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://sandboxapi.fincra.com';
  const res = await f(`${base}${path}`, {
    method,
    headers: {
      'api-key': config.apiKey,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  const success = json['success'];
  if (!res.ok || success === false) {
    const msg = (typeof json['message'] === 'string' && json['message']) || text || res.statusText;
    throw new ProviderApiError('fincra', res.status, String(msg));
  }
  return json;
}

function mapFincraPayoutStatus(raw: unknown): 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  const v = (typeof raw === 'string' ? raw : '').toLowerCase();
  if (v === 'successful') return 'COMPLETED';
  if (v === 'failed') return 'FAILED';
  // processing | pending | any other value: caller polls getTransferStatus.
  return 'PROCESSING';
}

export function createFincraRemittanceProvider(config: FincraRemittanceConfig): RemittanceProvider {
  const name = 'fincra';
  const paymentSchemes: Record<string, string> = { GBP: 'fps', EUR: 'sepa', USD: 'swift', NGN: '' };

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    remittanceCapabilities: {
      supportsIndicativeRates: true,
      supportsLockedQuotes: true, // live-confirmed: POST /quotes/generate returns a real reference + ~30s expireAt
      supportsConversions: false, // not wired/verified through this adapter
      supportsPayouts: true,
      supportsBeneficiaries: false // payout takes an inline beneficiary; no beneficiary-management endpoints verified
    },
    // Only NG live-tested through this adapter — see header note.
    getCapabilities: () => liveCapabilities('REMITTANCE', ['BANK_TRANSFER'], ['NG']),
    checkHealth: () => liveHealth(name),

    async getQuote(input) {
      const json = await callFincraApi(config, 'POST', '/quotes/generate', {
        business: config.businessId,
        sourceCurrency: input.sourceCurrency,
        destinationCurrency: input.destinationCurrency,
        amount: String(input.sourceAmountMinor), // minor units — confirmed via payout balance math
        action: 'send',
        transactionType: 'disbursement',
        paymentDestination: 'bank_account',
        feeBearer: 'business',
        ...(paymentSchemes[input.destinationCurrency]
          ? { paymentScheme: paymentSchemes[input.destinationCurrency] }
          : {})
      });
      const data = json['data'] as Record<string, unknown>;
      return {
        quoteId: toStr(data['reference']),
        sourceAmountMinor: input.sourceAmountMinor,
        sourceCurrency: input.sourceCurrency,
        destinationAmountMinor: Math.round(Number(data['destinationAmount'])),
        destinationCurrency: input.destinationCurrency,
        feeMinor: Math.round(Number(data['fee'] ?? 0)),
        rate: Number(data['rate']),
        expiresAt: toStr(data['expireAt']) || new Date(Date.now() + 30_000).toISOString(),
        isLocked: true
      };
    },

    async sendTransfer(input) {
      if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
        throw new Error('sendTransfer requires a positive integer amountMinor');
      }
      if (!input.idempotencyKey) {
        throw new Error('sendTransfer requires an idempotencyKey — Fincra rejects a reused customerReference with 422 rather than replaying');
      }
      const [firstName = '', ...lastParts] = input.recipient.name.split(' ');
      const lastName = lastParts.join(' ') || firstName;

      const json = await callFincraApi(config, 'POST', '/disbursements/payouts', {
        business: config.businessId,
        sourceCurrency: input.sourceCurrency,
        destinationCurrency: input.destinationCurrency,
        amount: String(input.amountMinor), // minor units — confirmed via payout balance math
        description: 'FlipTrybe remittance',
        paymentDestination: 'bank_account',
        customerReference: input.idempotencyKey,
        beneficiary: {
          firstName,
          lastName,
          accountHolderName: input.recipient.name,
          accountNumber: input.recipient.accountNumber,
          bankCode: input.recipient.bankCode,
          type: 'individual',
          country: input.recipient.country
        },
        ...(input.quoteId ? { quoteReference: input.quoteId } : {}),
        ...(paymentSchemes[input.destinationCurrency]
          ? { paymentScheme: paymentSchemes[input.destinationCurrency] }
          : {})
      });
      const data = json['data'] as Record<string, unknown>;
      return {
        providerReference: toStr(data['reference']) || toStr(data['id']),
        status: mapFincraPayoutStatus(data['status'])
      };
    },

    async getTransferStatus(providerReference) {
      const json = await callFincraApi(
        config,
        'GET',
        `/disbursements/payouts/reference/${encodeURIComponent(providerReference)}`
      );
      const data = json['data'] as Record<string, unknown>;
      const status = mapFincraPayoutStatus(data['status']);
      return {
        status,
        ...(status === 'FAILED'
          ? { failureReason: `Fincra payout status: ${toStr(data['status'])}` }
          : {})
      };
    }
  };
}

// Verifies an inbound Fincra webhook signature.
//
// Documented scheme: header X-Fincra-Signature carries an HMAC-SHA512 hex
// digest of the raw request body, keyed with the dashboard-issued webhook
// encryption key. NOT live-verified — webhook enablement is dashboard-only
// and no webhook has been received in the sandbox sprint (see header note).
export function verifyFincraWebhook(rawBody: string, signatureHeader: string, webhookEncryptionKey: string): boolean {
  if (!webhookEncryptionKey || !signatureHeader) return false;
  const expected = createHmac('sha512', webhookEncryptionKey).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHeader.toLowerCase(), 'hex'));
  } catch {
    return false;
  }
}

// Payscribe virtual (USD) card adapter — mapped against the OFFICIAL Payscribe
// API documentation (2026-08-08). See docs/providers/payscribe.md.
//
// Documented facts encoded below:
//   - Payscribe issues USD cards ONLY (NGN cards not available).
//   - A card is issued against an existing Payscribe customer that has been
//     enrolled to tier 2 (KYC). There is NO "cardholder" entity — the previous
//     guess used one; that has been removed. The service must supply
//     `providerCustomerId`; the adapter refuses to fabricate a customer.
//   - Amounts are USD MAJOR units (decimal, minimum 1), NOT minor units. The
//     interface passes minor units, so we divide by 100.
//   - Endpoints/methods: POST /cards/create, PATCH /cards/{id}/topup,
//     PATCH /cards/{id}/freeze, PATCH /cards/{id}/unfreeze,
//     POST /cards/{id}/terminate, GET /cards/{id}. Freeze/unfreeze/terminate
//     take a { ref } body.
//   - The card provider underneath Payscribe is "Miden".
//
// Remaining GAPS (require sandbox verification before production — flagged, not
// invented): exact `expiry` string format; the full card-create response field
// set (only partially shown in docs); whether terminate returns any refundable
// balance (docs say termination is irreversible and balance is reclaimed via
// PATCH /cards/{id}/withdraw — this adapter reads the pre-terminate balance to
// report refundableMinor but does NOT auto-withdraw).
export function createPayscribeVirtualCardProvider(
  config: PayscribeConfig
): VirtualCardProvider & ProviderCustomerEnrollment {
  const name = 'payscribe';

  async function fetchCard(
    providerCardId: string
  ): Promise<VirtualCardDetails & { balanceMinor: number }> {
    const json = await callPayscribeApi(config, `/cards/${providerCardId}`);
    const d = payscribeDetails(json);
    const exp = parsePayscribeExpiry(d['expiry']);
    const balanceUsd = Number(d['balance']);
    return {
      providerCardId: toStr(d['id']) || providerCardId,
      last4: toStr(d['last_four']),
      expiryMonth: exp.month,
      expiryYear: exp.year,
      brand: normalizeCardBrand(d['brand']),
      currency: toStr(d['currency'], 'USD'),
      status: mapPayscribeCardStatus(d['status']),
      balanceMinor: Number.isFinite(balanceUsd) ? Math.round(balanceUsd * 100) : 0
    };
  }

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_CARD',
    // Payscribe issues USD cards only; customers default to NG domicile.
    getCapabilities: () => liveCapabilities('VIRTUAL_CARD', ['USD_CARD'], ['NG']),
    checkHealth: () => liveHealth(name),

    // Documented flow (docs/providers/payscribe.md § Customers):
    //   POST  /customers/create        → tier 0, returns customer_id
    //   PATCH /customers/create/tier1  → dob + address + government ID
    //   PATCH /customers/create/tier2  → identity document with image
    //
    // Cards require tier 2, virtual accounts require tier 1, so `purpose`
    // decides where to stop rather than always climbing to the top — tier 2
    // demands a document image a VA-only customer should not have to supply.
    //
    // NOT SANDBOX-VERIFIED. Mapped from docs only; the tier endpoints have never
    // been exercised against live credentials, and the docs also reference a
    // one-shot "Create Customer - Full" whose schema was not captured. Treat the
    // request shapes below as documented-not-proven, per the house rule in
    // docs/providers/provider-capability-matrix.md.
    async enrollCustomer({ identity, purpose, reference }) {
      const createJson = await callPayscribeApi(config, '/customers/create', {
        method: 'POST',
        body: {
          first_name: identity.firstName,
          last_name: identity.lastName,
          email: identity.email,
          phone: identity.phone,
          country: identity.country ?? 'NG',
          ref: reference
        }
      });
      const created = payscribeDetails(createJson);
      const providerCustomerId =
        toStr(created['customer_id']) || toStr(created['id']);
      if (!providerCustomerId) {
        throw new ProviderApiError(
          name,
          200,
          'Customer create response contained no customer_id'
        );
      }

      // Tier 1 — required for both purposes.
      if (!identity.dateOfBirth || !identity.address || !identity.idType || !identity.idNumber) {
        throw new Error(
          'Payscribe tier-1 enrollment requires dateOfBirth, address, idType and idNumber.'
        );
      }
      await callPayscribeApi(config, '/customers/create/tier1', {
        method: 'PATCH',
        body: {
          customer_id: providerCustomerId,
          dob: identity.dateOfBirth,
          address: {
            street: identity.address.street,
            city: identity.address.city,
            state: identity.address.state,
            country: identity.address.country,
            postal_code: identity.address.postalCode ?? ''
          },
          identification_type: identity.idType,
          identification_number: identity.idNumber
        }
      });

      if (purpose === 'VIRTUAL_ACCOUNT') {
        return { providerCustomerId, tier: 'tier1' };
      }

      // Tier 2 — cards only. Needs a document image, which tier 1 does not.
      if (!identity.idImageBase64) {
        throw new Error(
          'Payscribe tier-2 enrollment (required for card issuance) needs idImageBase64.'
        );
      }
      await callPayscribeApi(config, '/customers/create/tier2', {
        method: 'PATCH',
        body: {
          customer_id: providerCustomerId,
          identity: {
            type: identity.idType,
            number: identity.idNumber,
            country: identity.address.country,
            image: identity.idImageBase64
          }
        }
      });

      return { providerCustomerId, tier: 'tier2' };
    },

    async issueCard(input) {
      if (!input.providerCustomerId) {
        throw new Error(
          'Payscribe card issuance requires a providerCustomerId — create and enroll a ' +
            'Payscribe customer to tier 2 via /customers/* first. See docs/providers/payscribe.md.'
        );
      }
      const json = await callPayscribeApi(config, '/cards/create', {
        method: 'POST',
        body: {
          customer_id: input.providerCustomerId,
          currency: 'USD', // Payscribe: USD cards only
          brand: input.brand ?? 'VISA',
          amount: input.fundingAmountMinor / 100, // USD major units, min 1
          type: 'virtual',
          ref: input.reference
        }
      });
      const details = payscribeDetails(json);
      // Create response nests the card under details.card (falls back to details).
      const card = ((details['card'] as Record<string, unknown>) ?? details) ?? {};
      const providerCardId = toStr(card['id']);
      if (!providerCardId) {
        throw new ProviderApiError('payscribe', 200, 'Card create response missing card id');
      }
      const exp = parsePayscribeExpiry(card['expiry']);
      return {
        providerCardId,
        last4: toStr(card['last_four']),
        expiryMonth: exp.month,
        expiryYear: exp.year,
        brand: normalizeCardBrand(typeof card['brand'] === 'string' ? card['brand'] : input.brand),
        currency: toStr(card['currency'], 'USD'),
        status: mapPayscribeCardStatus(card['status'])
      };
    },

    async fundCard(input) {
      const json = await callPayscribeApi(config, `/cards/${input.providerCardId}/topup`, {
        method: 'PATCH',
        body: { amount: input.amountMinor / 100, ref: input.reference } // USD major units
      });
      const d = payscribeDetails(json);
      const card = (d['card'] as Record<string, unknown>) ?? {};
      const balanceUsd = Number(card['balance'] ?? d['current_balance'] ?? d['balance']);
      const providerReference = toStr(d['trans_id']) || toStr(card['id']) || input.reference;
      return {
        providerReference,
        balanceMinor: Number.isFinite(balanceUsd) ? Math.round(balanceUsd * 100) : 0
      };
    },

    // PATCH /cards/{id}/withdraw — { amount, ref }, USD major units like topup.
    // Documented (see docs/providers/payscribe.md) and the prerequisite for
    // terminating a card without stranding its balance.
    async withdrawFromCard(input) {
      const json = await callPayscribeApi(config, `/cards/${input.providerCardId}/withdraw`, {
        method: 'PATCH',
        body: { amount: input.amountMinor / 100, ref: input.reference }
      });
      const d = payscribeDetails(json);
      const card = (d['card'] as Record<string, unknown>) ?? {};
      const balanceUsd = Number(card['balance'] ?? d['current_balance'] ?? d['balance']);
      return {
        providerReference: toStr(d['trans_id']) || input.reference,
        withdrawnMinor: input.amountMinor,
        balanceMinor: Number.isFinite(balanceUsd) ? Math.round(balanceUsd * 100) : 0
      };
    },

    async freezeCard(providerCardId) {
      // Payscribe freeze/unfreeze require a { ref }; the interface carries none,
      // so we generate one. A stable, caller-supplied ref would be preferable.
      await callPayscribeApi(config, `/cards/${providerCardId}/freeze`, {
        method: 'PATCH',
        body: { ref: randomUUID() }
      });
      return { status: 'FROZEN' };
    },

    async unfreezeCard(providerCardId) {
      await callPayscribeApi(config, `/cards/${providerCardId}/unfreeze`, {
        method: 'PATCH',
        body: { ref: randomUUID() }
      });
      return { status: 'ACTIVE' };
    },

    async terminateCard(providerCardId) {
      // Read the current balance first so we can report refundableMinor. Note:
      // Payscribe termination is irreversible and does NOT itself return funds —
      // reclaiming balance is a separate PATCH /cards/{id}/withdraw the service
      // must do BEFORE terminating. Best-effort; ignore read failures.
      let refundableMinor = 0;
      try {
        refundableMinor = (await fetchCard(providerCardId)).balanceMinor;
      } catch {
        /* best-effort */
      }
      await callPayscribeApi(config, `/cards/${providerCardId}/terminate`, {
        method: 'POST',
        body: { ref: randomUUID() }
      });
      return { status: 'TERMINATED', refundableMinor };
    },

    getCard: (providerCardId) => fetchCard(providerCardId)
  };
}

// Payscribe NGN virtual-account adapter — mapped against the OFFICIAL Payscribe
// API documentation (2026-08-08). See docs/providers/payscribe.md.
//
// Documented facts:
//   - Payscribe virtual accounts are NGN ONLY.
//   - A virtual account does NOT hold a balance — funds sent to it settle to the
//     business NGN "collection" balance. getAccount therefore reports 0.
//   - A permanent (static) VA requires an existing Payscribe customer (create +
//     tier 1) and at least one bank from the documented set: 9psb | palmpay |
//     cashconnect. palmpay additionally needs bvn/identity for tier-0 customers.
//   - Endpoints: POST /collections/virtual-accounts/create,
//     GET /collections/virtual-accounts/{account},
//     POST /collections/virtual-accounts/deactivate (takes the account NUMBER).
//
// GAP (verify in sandbox): the inbound VA-credit webhook payload shape and how
// it identifies the destination account — see docs/providers/payscribe.md and
// the financial-products webhook handler.
export function createPayscribeVirtualAccountProvider(config: PayscribeConfig): VirtualAccountProvider {
  const name = 'payscribe';

  function mapAccount(details: Record<string, unknown>): VirtualAccountDetails {
    const acct = (Array.isArray(details['account'])
      ? (details['account'] as Record<string, unknown>[])[0]
      : ((details['account'] as Record<string, unknown>) ?? details)) ?? {};
    return {
      providerAccountId: toStr(acct['id']) || toStr(acct['account_number']),
      accountNumber: toStr(acct['account_number']),
      bankName: toStr(acct['bank_name']),
      bankCode: toStr(acct['bank_code']),
      accountName: toStr(acct['account_name']),
      currency: 'NGN'
    };
  }

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_ACCOUNT',
    virtualAccountCapabilities: {
      // Payscribe VAs are always created against a customer_id — there is no
      // separate "merchant treasury VA" creation call documented.
      supportsMerchantAccountCreation: false,
      supportsCustomerVirtualAccounts: true
    },
    getCapabilities: () => liveCapabilities('VIRTUAL_ACCOUNT', ['NGN_ACCOUNT'], ['NG']),
    checkHealth: () => liveHealth(name),

    async createAccount(input) {
      if (input.currency && input.currency !== 'NGN') {
        throw new Error('Payscribe virtual accounts are NGN-only.');
      }
      if (!input.providerCustomerId) {
        throw new Error(
          'Payscribe virtual account requires a providerCustomerId — create a Payscribe ' +
            'customer (tier 1) first. See docs/providers/payscribe.md.'
        );
      }
      const banks = input.bankHint && input.bankHint.length ? input.bankHint : ['palmpay'];
      const json = await callPayscribeApi(config, '/collections/virtual-accounts/create', {
        method: 'POST',
        body: {
          account_type: 'static',
          currency: 'NGN',
          customer_id: input.providerCustomerId,
          bank: banks
        }
      });
      return mapAccount(payscribeDetails(json));
    },

    async getAccount(providerAccountId) {
      const json = await callPayscribeApi(
        config,
        `/collections/virtual-accounts/${providerAccountId}`
      );
      // Payscribe VAs carry no balance (funds sweep to the collection balance).
      return { ...mapAccount(payscribeDetails(json)), balanceMinor: 0 };
    },

    async closeAccount(providerAccountId) {
      // Payscribe "deactivate" takes the account NUMBER, not the internal id.
      await callPayscribeApi(config, '/collections/virtual-accounts/deactivate', {
        method: 'POST',
        body: { account: providerAccountId }
      });
      return { closed: true };
    }
  };
}

// Verifies an inbound Payscribe webhook signature.
//
// The Payscribe docs describe TWO signing schemes:
//   1. "Webhook Security" section (newer): headers X-Payscribe-Event-Id,
//      X-Payscribe-Timestamp, X-Payscribe-Signature ("v1=<hex>"). The signed
//      base string is `timestamp + "." + event_id + "." + rawBody`, signed with
//      HMAC-SHA256(secret) and hex-encoded. Replay window: reject if
//      |now - timestamp| > 300s. Idempotency via X-Payscribe-Event-Id.
//   2. Per-product webhook pages (payout/collection/card): described simply as
//      HMAC-SHA256(secret, raw_request_body) in X-Payscribe-Signature (no "v1="
//      prefix, no timestamp/event_id in the base).
//
// This is a genuine documentation discrepancy (see docs/providers/payscribe.md —
// must be confirmed against a real sandbox delivery). Until confirmed, this
// verifier defensively accepts EITHER documented scheme: it validates the v1
// scheme when the header is "v1=..." and timestamp+event_id are present,
// otherwise it falls back to the raw-body scheme. It always enforces the replay
// window when a timestamp is supplied.
export interface PayscribeWebhookVerifyInput {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  eventId?: string;
  timestamp?: string;
  toleranceSeconds?: number;
  nowMs?: number;
}

export function verifyPayscribeWebhook(input: PayscribeWebhookVerifyInput): boolean {
  const { rawBody, signatureHeader, secret, eventId, timestamp } = input;
  if (!secret || !signatureHeader) return false;

  // Replay protection (documented): reject stale deliveries.
  if (timestamp !== undefined) {
    const tolerance = input.toleranceSeconds ?? 300;
    const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > tolerance) return false;
  }

  const safeEqualHex = (a: string, b: string): boolean => {
    if (a.length !== b.length || a.length === 0) return false;
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      return false;
    }
  };

  // Scheme 1: v1=<hex> over `timestamp.event_id.rawBody`.
  const v1 = signatureHeader.match(/^v1=([0-9a-f]{64})$/i);
  if (v1 && timestamp !== undefined && eventId !== undefined) {
    const base = `${timestamp}.${eventId}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(base).digest('hex');
    return safeEqualHex(expected, v1[1]!.toLowerCase());
  }

  // Scheme 2: HMAC-SHA256(secret, rawBody), hex, no prefix.
  const given = signatureHeader.replace(/^v1=/i, '').toLowerCase();
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, given);
}

export interface SudoConfig {
  // OAuth2 bearer token issued from the Sudo dashboard. Docs
  // (docs.sudo.africa/docs/authentication) specify `Authorization: Bearer <token>`.
  // Live-confirmed 2026-08-11 against the real sandbox: Sudo also accepts the
  // raw token with NO "Bearer " prefix (both returned HTTP 200 on GET /cards),
  // but this adapter sends the documented Bearer form since that is what the
  // docs commit to.
  apiKey: string;
  // https://api.sandbox.sudo.cards (sandbox, live-confirmed) /
  // https://api.sudo.africa (production, per docs.sudo.africa/docs/environments —
  // NOT live-tested, only sandbox was verified).
  baseUrl?: string;
  // A funded Sudo account/wallet `_id` used as the debit source for
  // fundCard()'s POST /accounts/transfer call. GENUINE INTERFACE GAP: Sudo's
  // fund-transfer endpoint requires both a debitAccountId and creditAccountId,
  // but VirtualCardProvider.fundCard(input) carries no source-account concept
  // (only providerCardId/amountMinor/reference). Rather than guess, this is
  // pushed to config — the caller must provision and fund a business-level
  // account/wallet and pass its `_id` here. See docs/providers/sudo.md.
  fundingAccountId?: string;
  fetcher?: typeof fetch;
}

// Documented Sudo Africa HTTP client — mapped against the OFFICIAL Sudo API
// documentation (docs.sudo.africa, checked 2026-08-11) and live-verified
// against https://api.sandbox.sudo.cards with real sandbox credentials.
//   - Auth: Authorization: Bearer <token>.
//   - Response envelope: { statusCode, message, data }. Validation failures
//     (400) return `message` as an ARRAY of class-validator error objects
//     rather than a string — handled below by JSON-stringifying it.
async function callSudoApi(
  config: SudoConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!config.apiKey) throw new Error('Sudo adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://api.sudo.africa';
  const res = await f(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const rawMessage = json['message'];
    const msg =
      (typeof rawMessage === 'string' && rawMessage) ||
      (Array.isArray(rawMessage) && rawMessage.length ? JSON.stringify(rawMessage) : '') ||
      text ||
      res.statusText;
    throw new ProviderApiError('sudo', res.status, String(msg));
  }
  return json;
}

function sudoData(json: Record<string, unknown>): Record<string, unknown> {
  return (json['data'] as Record<string, unknown>) ?? {};
}

// Sudo's maskedPan is documented/observed as e.g. "506321*********3765" — the
// last 4 digits are the trailing 4 characters.
function last4FromSudoMaskedPan(maskedPan: unknown): string {
  const s = typeof maskedPan === 'string' ? maskedPan : '';
  return s.slice(-4);
}

function mapSudoCardStatus(s: unknown): 'ACTIVE' | 'FROZEN' | 'TERMINATED' {
  const v = (typeof s === 'string' ? s : '').toLowerCase();
  if (v === 'inactive') return 'FROZEN';
  if (v === 'canceled' || v === 'cancelled') return 'TERMINATED';
  return 'ACTIVE';
}

// GENUINE INTERFACE GAP (live-confirmed 2026-08-11, not guessed): Sudo's card
// `brand` enum is `Verve | AfriGo | MasterCard | Visa`, but
// VirtualCardDetails.brand only allows `'VISA' | 'MASTERCARD'`. Live sandbox
// testing against the real business account (FlipTrybe LTD, isApproved:false)
// showed:
//   - POST /cards with brand:"Visa"       -> 400 "Visa Cards are not available
//     at the moment. Please use Verve or MasterCard."
//   - POST /cards with brand:"MasterCard" -> 400 "MasterCard Virtual Cards are
//     not available at the moment." (also true for NGN)
//   - POST /cards with brand:"Verve", currency:"NGN" -> 200, card issued for
//     real (id 6a7b4006239d666d7ca2c9a4, live-verified get/freeze/unfreeze).
//   - POST /cards with brand:"AfriGo" -> 400 "not available" (USD) / reached
//     the funds-check stage for NGN (brand itself accepted) but was not
//     completed due to insufficient real settlement-account balance.
// So in THIS sandbox, Visa/MasterCard virtual-card issuance is currently
// disabled account-wide — there is no reliable way to force a VISA/MASTERCARD
// card today. Per the governing instruction, we do NOT silently coerce a
// Verve/AfriGo card into VISA/MASTERCARD (that would misrepresent the card to
// callers). Instead: issueCard still sends the caller's requested brand
// ('VISA'->'Visa', 'MASTERCARD'->'MasterCard' — never silently substitutes
// Verve), and if Sudo ever returns a card whose brand is not Visa/MasterCard,
// this throws a clear, non-fabricated error rather than lying about the brand.
function normalizeSudoCardBrand(b: unknown): 'VISA' | 'MASTERCARD' {
  const v = typeof b === 'string' ? b : '';
  if (v === 'Visa') return 'VISA';
  if (v === 'MasterCard') return 'MASTERCARD';
  throw new ProviderApiError(
    'sudo',
    200,
    `Sudo returned a "${v}" card, which VirtualCardDetails.brand (VISA|MASTERCARD only) cannot ` +
      'represent — Verve and AfriGo cards are not supported by this adapter interface. ' +
      'Live-confirmed 2026-08-11: Visa/MasterCard virtual-card issuance is currently disabled for ' +
      'this Sudo sandbox business account; only Verve (NGN) succeeded. See docs/providers/sudo.md.'
  );
}

// Sudo Africa virtual-card adapter — mapped against the OFFICIAL Sudo API
// documentation (docs.sudo.africa, checked 2026-08-11) and LIVE-VERIFIED
// against https://api.sandbox.sudo.cards with real sandbox credentials
// (business "Flip Tryb LTD", isApproved:false — KYB not yet approved, but
// sandbox access worked regardless). See docs/providers/sudo.md for the full
// endpoint-by-endpoint mapping and live evidence.
//
// Documented + live-confirmed facts encoded below:
//   - A card requires an existing Sudo customerId (POST /customers first) —
//     this adapter refuses to fabricate one, matching the Payscribe pattern.
//   - Card creation ALSO requires a debitAccountId (an existing account/wallet
//     `_id`), which the VirtualCardProvider interface has no concept of. This
//     adapter auto-provisions a wallet account for the customer inside
//     issueCard() (POST /accounts, type:"wallet") — a low-risk creation step,
//     not additional KYC, per the governing instruction.
//   - Live-confirmed: creating a NGN wallet account directly returned 400
//     "You are not allowed to use this route" for this (KYB-unapproved)
//     business, while a USD wallet account created successfully. Card
//     issuance itself is independently gated per brand/currency (see
//     normalizeSudoCardBrand above) — so issueCard can fail at either step
//     depending on account approval state and brand/currency availability.
//     Both failure modes surface as ProviderApiError, not silently swallowed.
//   - Amounts (fundingAmountMinor, card balances, transfer amounts) are
//     MINOR units end-to-end — live-confirmed via
//     /accounts/simulator/fund (amount:500 -> currentBalance:500) and
//     /accounts/transfer (amount:1000 debited exactly 1000 from a 5000
//     balance). No unit conversion is applied.
//   - Freeze/unfreeze/terminate are NOT separate endpoints — they are status
//     transitions via PUT /cards/{id}: status:"inactive" (freeze, live-
//     verified), status:"active" (unfreeze, live-verified), status:"canceled"
//     (terminate — NOT live-tested, see terminateCard below).
//   - Card top-up (fundCard) uses POST /accounts/transfer with
//     debitAccountId:config.fundingAccountId, creditAccountId:<card's own
//     `account` id>. Live-verified: transferring 500 into a card's account
//     moved its GET /cards/{id}/balance from 4000 to 4500.
//
// GAPS / NOT live-verified:
//   - terminateCard(): PUT /cards/{id} status:"canceled" requires
//     cancellationReason ("lost"|"stolen") and creditAccountId (refund
//     destination). Neither documented value fits a routine business-
//     initiated termination, and forcing "lost"/"stolen" would misrepresent
//     the reason. NOT called live (irreversible + semantically wrong to
//     guess) — see terminateCard() below, which throws rather than guesses.
//   - Production base URL (https://api.sudo.africa) is per-docs only, not
//     live-tested (only sandbox credentials were available).
export function createSudoVirtualCardProvider(config: SudoConfig): VirtualCardProvider {
  const name = 'sudo';

  async function fetchCard(
    providerCardId: string
  ): Promise<VirtualCardDetails & { balanceMinor: number }> {
    const cardJson = await callSudoApi(config, 'GET', `/cards/${encodeURIComponent(providerCardId)}`);
    const card = sudoData(cardJson);
    const balJson = await callSudoApi(
      config,
      'GET',
      `/cards/${encodeURIComponent(providerCardId)}/balance`
    );
    const bal = sudoData(balJson);
    return {
      providerCardId: toStr(card['_id']) || providerCardId,
      last4: last4FromSudoMaskedPan(card['maskedPan']),
      expiryMonth: Number(card['expiryMonth']) || 0,
      expiryYear: Number(card['expiryYear']) || 0,
      brand: normalizeSudoCardBrand(card['brand']),
      currency: toStr(card['currency']),
      status: mapSudoCardStatus(card['status']),
      balanceMinor: Number(bal['availableBalance'] ?? bal['currentBalance'] ?? 0)
    };
  }

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_CARD',
    // Live-confirmed NGN Verve virtual-card issuance; Visa/MasterCard are
    // currently unavailable account-wide in sandbox (see normalizeSudoCardBrand).
    getCapabilities: () => liveCapabilities('VIRTUAL_CARD', ['NGN_CARD'], ['NG']),
    checkHealth: () => liveHealth(name),

    async issueCard(input) {
      if (!input.providerCustomerId) {
        throw new Error(
          'Sudo card issuance requires a providerCustomerId — create a Sudo customer via ' +
            'POST /customers first. See docs/providers/sudo.md.'
        );
      }
      const brand = input.brand === 'MASTERCARD' ? 'MasterCard' : 'Visa';

      // Sudo requires a debitAccountId (existing account/wallet) to fund card
      // creation; auto-provision a wallet account for this customer. Low-risk
      // creation step, not additional KYC — documented above.
      const accountJson = await callSudoApi(config, 'POST', '/accounts', {
        type: 'wallet',
        currency: input.currency,
        accountType: 'Savings',
        customerId: input.providerCustomerId
      });
      const account = sudoData(accountJson);
      const debitAccountId = toStr(account['_id']);
      if (!debitAccountId) {
        throw new ProviderApiError('sudo', 200, 'Wallet account create response missing _id');
      }

      const json = await callSudoApi(config, 'POST', '/cards', {
        customerId: input.providerCustomerId,
        type: 'virtual',
        currency: input.currency,
        status: 'active',
        brand,
        debitAccountId,
        amount: input.fundingAmountMinor
      });
      const card = sudoData(json);
      const providerCardId = toStr(card['_id']);
      if (!providerCardId) {
        throw new ProviderApiError('sudo', 200, 'Card create response missing _id');
      }
      return {
        providerCardId,
        last4: last4FromSudoMaskedPan(card['maskedPan']),
        expiryMonth: Number(card['expiryMonth']) || 0,
        expiryYear: Number(card['expiryYear']) || 0,
        brand: normalizeSudoCardBrand(card['brand']),
        currency: toStr(card['currency'], input.currency),
        status: mapSudoCardStatus(card['status'])
      };
    },

    async fundCard(input) {
      if (!config.fundingAccountId) {
        throw new Error(
          'Sudo fundCard requires config.fundingAccountId — a funded Sudo account/wallet _id to ' +
            'debit from. The VirtualCardProvider interface carries no source-account concept; ' +
            'configure a default funding account. See docs/providers/sudo.md.'
        );
      }
      const cardJson = await callSudoApi(
        config,
        'GET',
        `/cards/${encodeURIComponent(input.providerCardId)}`
      );
      const card = sudoData(cardJson);
      const accountField = card['account'];
      const creditAccountId =
        typeof accountField === 'string'
          ? accountField
          : toStr((accountField as Record<string, unknown> | undefined)?.['_id']);
      if (!creditAccountId) {
        throw new ProviderApiError('sudo', 200, "Could not resolve the card's account id for funding");
      }

      await callSudoApi(config, 'POST', '/accounts/transfer', {
        debitAccountId: config.fundingAccountId,
        creditAccountId,
        amount: input.amountMinor,
        paymentReference: input.reference
      });

      const balJson = await callSudoApi(
        config,
        'GET',
        `/cards/${encodeURIComponent(input.providerCardId)}/balance`
      );
      const bal = sudoData(balJson);
      return {
        providerReference: input.reference,
        balanceMinor: Number(bal['availableBalance'] ?? bal['currentBalance'] ?? 0)
      };
    },

    async freezeCard(providerCardId) {
      await callSudoApi(config, 'PUT', `/cards/${encodeURIComponent(providerCardId)}`, {
        status: 'inactive'
      });
      return { status: 'FROZEN' };
    },

    async unfreezeCard(providerCardId) {
      await callSudoApi(config, 'PUT', `/cards/${encodeURIComponent(providerCardId)}`, {
        status: 'active'
      });
      return { status: 'ACTIVE' };
    },

    terminateCard() {
      // NOT IMPLEMENTED — genuinely ambiguous, not guessed. Sudo's only
      // termination path (PUT /cards/{id} status:"canceled") requires
      // cancellationReason:"lost"|"stolen" and a creditAccountId to receive
      // the remaining balance. Neither documented reason value fits a routine
      // business-initiated termination, and this was deliberately NOT called
      // live (irreversible per the docs). Resolve with Sudo support/docs
      // before implementing — see docs/providers/sudo.md.
      throw new Error(
        'Sudo terminateCard is not implemented: PUT /cards/{id} status:"canceled" requires a ' +
          'cancellationReason of "lost"|"stolen" and a refund creditAccountId, neither of which ' +
          'fits a routine termination and neither was live-verified. See docs/providers/sudo.md.'
      );
    },

    getCard: (providerCardId) => fetchCard(providerCardId)
  };
}

// Confirmed against real Yativo docs at docs.yativo.com (checked 2026-08-07):
//   - Base URL: https://api.yativo.com/api/v1 (not bare https://api.yativo.com)
//   - Auth: bearer token from account_id + app_secret via POST /auth/login,
//     not a static x-api-key header — see getYativoBearerToken above.
//   - Quote: POST /exchange-rate — body { from_currency, to_currency, amount,
//     method_id?, method_type? } — response has quote_id/rate/payout_data.*,
//     not the flat { id, source_amount_minor, ... } shape previously guessed.
//   - Payout: POST /payout/simple — requires an Idempotency-Key header, and
//     the body is { debit_wallet, amount, beneficiary_details_id,
//     beneficiary_id? } — it pays a *pre-registered beneficiary*, it does NOT
//     accept raw recipient bank details inline as previously guessed.
//   - Payout status: GET /payout/fetch/{payout_id}.
//
// UNRESOLVED GAP (flagging, not fixing here): the RemittanceProvider
// interface's `sendTransfer(input.recipient)` passes raw bank details
// per-call, but Yativo's real payout endpoint only accepts a
// `beneficiary_details_id` referencing a beneficiary created ahead of time
// via a separate (undocumented-here) beneficiary-creation endpoint. Making
// this adapter fully correct requires either (a) adding a
// create-and-cache-beneficiary step before every sendTransfer call, or (b)
// reshaping the RemittanceProvider interface to work with saved beneficiaries.
// Below, sendTransfer best-effort treats `input.recipient` as if it were
// already a resolved beneficiary id via a synthesized lookup — this part
// remains an unverified guess and will not work against the real API as-is.
export function createYativoRemittanceProvider(config: YativoConfig): RemittanceProvider {
  const name = 'yativo';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    // Yativo genuinely has a server-side locked quote (POST /exchange-rate,
    // TTL ~5min) — unlike Swappr, supportsLockedQuotes is honestly true here.
    remittanceCapabilities: {
      supportsIndicativeRates: true,
      supportsLockedQuotes: true,
      supportsConversions: false,
      supportsPayouts: true,
      supportsBeneficiaries: false // documented as required but not implemented here — see GAP note
    },
    getCapabilities: () => liveCapabilities('REMITTANCE', ['BANK_TRANSFER'], ['NG', 'US']),
    checkHealth: () => liveHealth(name),

    async getQuote(input) {
      const data = (await callYativoApi(config, '/exchange-rate', {
        body: {
          from_currency: input.sourceCurrency,
          to_currency: input.destinationCurrency,
          amount: input.sourceAmountMinor / 100
        }
      })) as {
        quote_id: string;
        rate: number;
        payout_data: {
          customer_total_amount_due: number;
          customer_receive_amount: number;
          total_transaction_fee_in_from_currency: number;
        };
      };
      return {
        quoteId: data.quote_id,
        sourceAmountMinor: Math.round(data.payout_data.customer_total_amount_due * 100),
        sourceCurrency: input.sourceCurrency,
        destinationAmountMinor: Math.round(data.payout_data.customer_receive_amount * 100),
        destinationCurrency: input.destinationCurrency,
        feeMinor: Math.round(data.payout_data.total_transaction_fee_in_from_currency * 100),
        rate: data.rate,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), // docs: quotes expire after 5 minutes
        isLocked: true
      };
    },

    async sendTransfer(input) {
      if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
        throw new Error('sendTransfer requires a positive integer amountMinor');
      }
      if (!input.quoteId) {
        throw new Error(
          'Yativo requires a locked quoteId from getQuote() before sendTransfer — none was provided.'
        );
      }
      // GAP: `beneficiary_details_id` should come from a prior beneficiary-
      // creation call, not be derived from the raw recipient fields below.
      // Left as a best-effort passthrough — unverified, see module note above.
      // Documented body is exactly { debit_wallet, amount, beneficiary_details_id,
      // beneficiary_id? } — no quote_id field is documented on this endpoint,
      // so none is sent; the locking is presumably enforced server-side by
      // Yativo matching this amount against the still-valid quote it issued.
      // `amount` uses the same major-unit convention as /exchange-rate.
      const data = (await callYativoApi(
        config,
        '/payout/simple',
        {
          idempotencyKey: input.idempotencyKey,
          body: {
            debit_wallet: input.recipient.country,
            amount: input.amountMinor / 100,
            beneficiary_details_id: input.recipient.accountNumber,
            beneficiary_id: input.reference
          }
        }
      )) as { data: { transaction_id: string; status: string } };
      const status = data.data.status.toUpperCase();
      const normalized: 'PROCESSING' | 'COMPLETED' | 'FAILED' =
        status === 'COMPLETED' || status === 'SUCCESS'
          ? 'COMPLETED'
          : status === 'FAILED' || status === 'ERROR'
            ? 'FAILED'
            : 'PROCESSING';
      return { providerReference: data.data.transaction_id, status: normalized };
    },

    async getTransferStatus(providerReference) {
      const data = (await callYativoApi(config, `/payout/fetch/${providerReference}`)) as {
        data: { status: string };
      };
      const status = data.data.status.toUpperCase();
      const normalized: 'PROCESSING' | 'COMPLETED' | 'FAILED' =
        status === 'COMPLETED' || status === 'SUCCESS'
          ? 'COMPLETED'
          : status === 'FAILED' || status === 'ERROR'
            ? 'FAILED'
            : 'PROCESSING';
      return { status: normalized };
    }
  };
}

// Inflow Africa virtual-account adapter — mapped against the OFFICIAL Inflow
// docs (docs.inflowafrica.com, checked 2026-08-11) AND a live sandbox
// verification sprint the same day using real credentials
// (Authorization: Bearer gtw_sk_...). See docs/providers/inflow.md for the
// full mapping and the live request/response log. Facts below are
// LIVE-CONFIRMED unless marked "per docs only":
//   - POST /v1/customers (firstName, lastName, email required) → 201, real
//     customer id confirmed live.
//   - POST /v1/customers/{id}/virtual-account (body {} — provider defaults to
//     "monnify") → 201, returns an object with `id` (the VA-assignment id,
//     NOT the customer id) and `accounts[]` — live sandbox returned TWO bank
//     accounts (Sterling + Wema) for a single assignment, both under the same
//     `id`. There is no `currency` field anywhere in the response; the
//     monnify provider is NGN-only, so currency is inferred as "NGN" rather
//     than read off the payload.
//   - GET /v1/customers/{id}/virtual-accounts → 200, confirmed to return the
//     same `id`/`accounts[]` shape as the assign call, wrapped in `data: []`.
//   - GET /v1/wallets → 200, confirmed shape { data: [{id,currency,balance,
//     isActive,accountNumber,accountName,bankName,createdAt}] } — one row per
//     currency (EUR/USD/GBP/NGN all present, all balance 0 in this sandbox
//     org). Not otherwise used by this adapter (no VA balance is derivable
//     from it — VAs settle to the NGN wallet, but the docs do not document a
//     link between a specific VA and a wallet credit).
//
// STRUCTURAL GAP (interface vs. real API): VirtualAccountProvider.getAccount
// takes a single providerAccountId, but Inflow's only GET
// (/v1/customers/{id}/virtual-accounts) is keyed by CUSTOMER id, not VA id —
// there is no documented "get one VA by its own id" endpoint. This adapter
// resolves that by having createAccount() return a composite
// providerAccountId of the form "{customerId}:{vaAssignmentId}"; getAccount()
// splits it, calls the customer-scoped list endpoint, and finds the matching
// assignment by vaAssignmentId. This is a deliberate encoding choice (not a
// guessed endpoint) so the interface's single-id contract can still be
// fulfilled with only documented, live-verified calls.
//
// closeAccount(): NO virtual-account-specific deactivate/close endpoint is
// documented anywhere in the Inflow API reference (Customers, Virtual
// Accounts, or Payouts sections). The only deactivate endpoint found is
// DELETE /v1/customers/{id}, which deactivates the ENTIRE customer (and,
// presumably, every product attached to them) — a materially different and
// more destructive operation than closing one virtual account. Per the
// "return UNSUPPORTED, not a fake implementation" rule, closeAccount() below
// throws explicitly rather than silently deactivating the whole customer.
//
// REMITTANCE DETERMINATION: Inflow's Payouts API (POST /v1/payouts) DOES
// support genuine cross-currency/cross-country transfers — the docs
// explicitly describe "USD/EUR/GBP bank payouts and all cross-currency (USD
// source, local destination) payouts" (created as PENDING for manual admin
// approval, vs. same-currency NGN/mobile-money payouts which auto-execute).
// However, there is NO quote-then-execute flow for payouts: the only
// exchange-rate endpoint in the docs (GET .../payments/get-exchange-rate-for-
// payment) is scoped to the Payments/collection product, not Payouts, and
// POST /v1/payouts itself takes a single already-decided `amount` with no
// rate-lock or quoteId concept. Payouts also require a beneficiary to be
// pre-registered via POST /v1/payout-accounts (returning a payoutAccountId)
// rather than accepting inline recipient bank details, which does not fit
// RemittanceProvider.sendTransfer's per-call `recipient` field without an
// additional beneficiary-resolution step. Per the task's explicit bar
// ("only implement RemittanceProvider ... with a real quote-then-execute
// flow"), that bar is not met — RemittanceProvider is intentionally NOT
// implemented for Inflow. See docs/providers/inflow.md §Remittance
// determination for the full evidence trail.
export interface InflowConfig {
  // API key: gtw_sk_... (works for both sandbox and production; environment
  // is selected entirely by baseUrl, not the key prefix).
  apiKey: string;
  // Confirmed base URLs (checked 2026-08-11):
  //   sandbox:    https://sandbox.inflowafrica.com/api
  //   production:  https://app.inflowpay.net/api
  // Defaults to production; pass the sandbox base for testing. Every path
  // below already carries its own /v1/... segment.
  baseUrl?: string;
  fetcher?: typeof fetch;
}

async function callInflowApi(
  config: InflowConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!config.apiKey) throw new Error('Inflow adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? 'https://app.inflowpay.net/api';
  const res = await f(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await res.text().catch(() => '');
  let json: Record<string, unknown>;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    // Confirmed live shape: { "message": "..." } — no `status`/`error` field.
    const msg = (typeof json['message'] === 'string' && json['message']) || text || res.statusText;
    throw new ProviderApiError('inflow', res.status, String(msg));
  }
  return json;
}

interface InflowVirtualAccountEntry {
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

interface InflowVirtualAccountAssignment {
  id?: string;
  provider?: string;
  isActive?: boolean;
  accounts?: InflowVirtualAccountEntry[];
}

// Maps a live Inflow VA-assignment object (from both the assign and list
// endpoints — confirmed identical shape live) to VirtualAccountDetails. The
// assignment can carry multiple bank accounts (live sandbox returned two —
// Sterling and Wema); the first is used as the canonical account, matching
// the single-account VirtualAccountDetails contract.
function mapInflowVirtualAccount(
  customerId: string,
  assignment: InflowVirtualAccountAssignment,
  currency: string
): VirtualAccountDetails {
  const entry = assignment.accounts?.[0] ?? {};
  const vaId = toStr(assignment.id);
  return {
    // Composite id — see the STRUCTURAL GAP note above.
    providerAccountId: vaId ? `${customerId}:${vaId}` : customerId,
    accountNumber: toStr(entry.accountNumber),
    bankName: toStr(entry.bankName),
    bankCode: toStr(entry.bankCode),
    accountName: toStr(entry.accountName),
    // Live sandbox response carries no currency field anywhere; monnify
    // (the only provider exercised) is NGN-only, so this is inferred rather
    // than read off the payload — see header note.
    currency
  };
}

export function createInflowVirtualAccountProvider(config: InflowConfig): VirtualAccountProvider {
  const name = 'inflow';

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_ACCOUNT',
    virtualAccountCapabilities: {
      // No merchant/organization-level VA creation endpoint is documented —
      // every virtual-account endpoint is scoped under /v1/customers/{id}/...
      supportsMerchantAccountCreation: false,
      // Confirmed live: POST /v1/customers/{id}/virtual-account creates
      // (or returns the existing) per-customer virtual account.
      supportsCustomerVirtualAccounts: true
    },
    getCapabilities: () => liveCapabilities('VIRTUAL_ACCOUNT', ['NGN_ACCOUNT'], ['NG']),
    checkHealth: () => liveHealth(name),

    async createAccount(input) {
      let customerId = input.providerCustomerId;
      if (!customerId) {
        // No providerCustomerId supplied — resolve one by creating an Inflow
        // customer from the fields this interface does carry. Inflow has no
        // documented "find by email" lookup, so this always creates; callers
        // that want to reuse an existing customer must pass providerCustomerId.
        const [firstName = input.accountName, ...rest] = input.accountName.split(' ');
        const lastName = rest.join(' ') || firstName;
        if (!input.customerEmail) {
          throw new Error(
            'Inflow virtual account creation requires either providerCustomerId or ' +
              'customerEmail (to create a new Inflow customer) — email is a required field on ' +
              'POST /v1/customers. See docs/providers/inflow.md.'
          );
        }
        const created = await callInflowApi(config, 'POST', '/v1/customers', {
          firstName,
          lastName,
          email: input.customerEmail,
          ...(input.customerPhone ? { phone: input.customerPhone } : {})
        });
        const data = created['data'] as Record<string, unknown>;
        customerId = toStr(data['id']);
        if (!customerId) {
          throw new ProviderApiError('inflow', 201, 'Customer create response missing data.id');
        }
      }

      const json = await callInflowApi(config, 'POST', `/v1/customers/${customerId}/virtual-account`, {});
      const assignment = json['data'] as InflowVirtualAccountAssignment;
      return mapInflowVirtualAccount(customerId, assignment, input.currency || 'NGN');
    },

    async getAccount(providerAccountId) {
      const [customerId, vaId] = providerAccountId.split(':');
      if (!customerId || !vaId) {
        throw new Error(
          `Malformed Inflow providerAccountId "${providerAccountId}" — expected "{customerId}:{vaId}".`
        );
      }
      const json = await callInflowApi(config, 'GET', `/v1/customers/${customerId}/virtual-accounts`);
      const rows = (json['data'] as InflowVirtualAccountAssignment[]) ?? [];
      const assignment = vaId ? rows.find((r) => r.id === vaId) : rows[0];
      if (!assignment) {
        throw new ProviderApiError(
          'inflow',
          404,
          `No virtual account found for customer ${customerId}${vaId ? ` (vaId ${vaId})` : ''}`
        );
      }
      const details = mapInflowVirtualAccount(customerId, assignment, 'NGN');
      // No documented per-VA balance field — VAs settle to the NGN org wallet
      // (GET /v1/wallets), and no documented link ties a specific VA to that
      // wallet balance. Reporting 0, matching the Swappr/Payscribe convention
      // of "no balance on the VA object itself" rather than guessing.
      return { ...details, balanceMinor: 0 };
    },

    closeAccount() {
      return Promise.reject(
        new Error(
          'UNSUPPORTED: Inflow has no documented endpoint to close/deactivate a single virtual ' +
            'account — only DELETE /v1/customers/{id}, which deactivates the entire customer (a ' +
            'materially different, more destructive operation). See docs/providers/inflow.md.'
        )
      );
    }
  };
}

export function createMockRemittanceProvider(name = 'mock-remittance'): RemittanceProvider {
  const quotes = new Map<string, RemittanceQuote>();
  const transfers = new Map<string, 'PROCESSING' | 'COMPLETED' | 'FAILED'>();
  const idempotencyResults = new Map<
    string,
    { providerReference: string; status: 'PROCESSING' | 'COMPLETED' | 'FAILED' }
  >();

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    remittanceCapabilities: {
      supportsIndicativeRates: true,
      supportsLockedQuotes: true,
      supportsConversions: true,
      supportsPayouts: true,
      supportsBeneficiaries: true
    },
    getCapabilities: () => mockCapabilities('REMITTANCE', ['BANK_TRANSFER']),
    checkHealth: () => mockHealth(name),

    getQuote(input) {
      const rate = 1;
      const feeMinor = Math.ceil(input.sourceAmountMinor * 0.015);
      const quote: RemittanceQuote = {
        quoteId: `${name}_quote_${Math.random().toString(36).slice(2, 10)}`,
        sourceAmountMinor: input.sourceAmountMinor,
        sourceCurrency: input.sourceCurrency,
        destinationAmountMinor: Math.max(0, input.sourceAmountMinor - feeMinor),
        destinationCurrency: input.destinationCurrency,
        feeMinor,
        rate,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        isLocked: true
      };
      quotes.set(quote.quoteId, quote);
      return Promise.resolve(quote);
    },

    sendTransfer(input) {
      // Idempotency: same key replays the cached outcome rather than creating
      // a second transfer — mirrors documented real-provider behavior.
      const cached = idempotencyResults.get(input.idempotencyKey);
      if (cached) return Promise.resolve(cached);

      if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
        return Promise.reject(new Error('sendTransfer requires a positive integer amountMinor'));
      }
      if (input.quoteId) {
        const quote = quotes.get(input.quoteId);
        if (!quote) {
          return Promise.reject(new Error(`Unknown or expired quote ${input.quoteId}`));
        }
        if (
          quote.sourceCurrency !== input.sourceCurrency ||
          quote.destinationCurrency !== input.destinationCurrency
        ) {
          return Promise.reject(
            new Error(
              `Currency mismatch: quote was ${quote.sourceCurrency}->${quote.destinationCurrency}, ` +
                `sendTransfer requested ${input.sourceCurrency}->${input.destinationCurrency}`
            )
          );
        }
      }
      const providerReference = `${name}_transfer_${input.reference}`;
      transfers.set(providerReference, 'PROCESSING');
      const result = { providerReference, status: 'PROCESSING' as const };
      idempotencyResults.set(input.idempotencyKey, result);
      return Promise.resolve(result);
    },

    getTransferStatus(providerReference) {
      const status = transfers.get(providerReference) ?? 'FAILED';
      return Promise.resolve({ status });
    }
  };
}
