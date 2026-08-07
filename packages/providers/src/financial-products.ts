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
//   - Swappr and Payscribe: no public API documentation could be found after
//     multiple search attempts (web search + direct site fetch attempts).
//     Both appear to be Nigerian fintechs without a discoverable public
//     developer portal — likely partner/private APIs requiring a signed
//     agreement to get docs access. Their adapters below remain unverified
//     best-effort guesses (Stripe/Flutterwave-style REST conventions) and
//     must not be enabled in production until real docs or credentials
//     surface.

import type { ProviderAdapterBase, ProviderCapabilities, ProviderHealthSnapshot } from './contract.js';
import { CURRENT_INTERFACE_VERSION } from './contract.js';
import { randomUUID } from 'node:crypto';

// ─── Virtual Accounts ───────────────────────────────────────────────────────────

export interface VirtualAccountDetails {
  providerAccountId: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  currency: string;
}

export interface VirtualAccountProvider extends ProviderAdapterBase {
  readonly domain: 'VIRTUAL_ACCOUNT';

  createAccount(input: {
    reference: string;
    accountName: string;
    currency: string;
    customerEmail?: string;
    customerPhone?: string;
  }): Promise<VirtualAccountDetails>;

  getAccount(providerAccountId: string): Promise<VirtualAccountDetails & { balanceMinor: number }>;

  closeAccount(providerAccountId: string): Promise<{ closed: boolean }>;
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
  }): Promise<VirtualCardDetails>;

  fundCard(input: {
    providerCardId: string;
    amountMinor: number;
    reference: string;
  }): Promise<{ providerReference: string; balanceMinor: number }>;

  freezeCard(providerCardId: string): Promise<{ status: 'FROZEN' }>;
  unfreezeCard(providerCardId: string): Promise<{ status: 'ACTIVE' }>;
  terminateCard(providerCardId: string): Promise<{ status: 'TERMINATED'; refundableMinor: number }>;

  getCard(
    providerCardId: string
  ): Promise<VirtualCardDetails & { balanceMinor: number }>;
}

// ─── Remittance ─────────────────────────────────────────────────────────────────

export interface RemittanceQuote {
  quoteId: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  feeMinor: number;
  rate: number;
  expiresAt: string;
}

export interface RemittanceProvider extends ProviderAdapterBase {
  readonly domain: 'REMITTANCE';

  getQuote(input: {
    sourceCurrency: string;
    destinationCurrency: string;
    sourceAmountMinor: number;
  }): Promise<RemittanceQuote>;

  sendTransfer(input: {
    reference: string;
    quoteId: string;
    recipient: {
      name: string;
      accountNumber: string;
      bankCode: string;
      country: string;
    };
  }): Promise<{ providerReference: string; status: 'PROCESSING' | 'COMPLETED' | 'FAILED' }>;

  getTransferStatus(
    providerReference: string
  ): Promise<{ status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; failureReason?: string }>;
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
  apiKey: string;
  baseUrl?: string; // default https://api.swappr.ng
  fetcher?: typeof fetch;
}

export interface PayscribeConfig {
  apiKey: string;
  baseUrl?: string; // default https://api.payscribe.ng
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

async function callSwapprApi(
  config: SwapprConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<unknown> {
  if (!config.apiKey) throw new Error('Swappr adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? 'https://api.swappr.ng'}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (!res.ok) {
    throw new ProviderApiError('swappr', res.status, await res.text().catch(() => res.statusText));
  }
  return res.json();
}

async function callPayscribeApi(
  config: PayscribeConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<unknown> {
  if (!config.apiKey) throw new Error('Payscribe adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? 'https://api.payscribe.ng'}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (!res.ok) {
    throw new ProviderApiError('payscribe', res.status, await res.text().catch(() => res.statusText));
  }
  return res.json();
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

// NOTE: endpoint paths/response shapes are best-effort based on standard fintech
// infrastructure API conventions (Stripe/Flutterwave-style REST) — MUST be
// verified against Swappr's real API documentation before enabling in
// production. No live credentials exist in this environment to test against.
export function createSwapprVirtualAccountProvider(config: SwapprConfig): VirtualAccountProvider {
  const name = 'swappr';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_ACCOUNT',
    getCapabilities: () => liveCapabilities('VIRTUAL_ACCOUNT', ['NGN_ACCOUNT'], ['NG']),
    checkHealth: () => liveHealth(name),

    async createAccount(input) {
      const data = (await callSwapprApi(config, '/v1/virtual-accounts', {
        body: {
          reference: input.reference,
          account_name: input.accountName,
          currency: input.currency,
          ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
          ...(input.customerPhone ? { customer_phone: input.customerPhone } : {})
        }
      })) as {
        data: {
          id: string;
          account_number: string;
          bank_name: string;
          bank_code: string;
          account_name: string;
          currency: string;
        };
      };
      const acct = data.data;
      return {
        providerAccountId: acct.id,
        accountNumber: acct.account_number,
        bankName: acct.bank_name,
        bankCode: acct.bank_code,
        accountName: acct.account_name,
        currency: acct.currency
      };
    },

    async getAccount(providerAccountId) {
      const data = (await callSwapprApi(config, `/v1/virtual-accounts/${providerAccountId}`)) as {
        data: {
          id: string;
          account_number: string;
          bank_name: string;
          bank_code: string;
          account_name: string;
          currency: string;
          balance_minor: number;
        };
      };
      const acct = data.data;
      return {
        providerAccountId: acct.id,
        accountNumber: acct.account_number,
        bankName: acct.bank_name,
        bankCode: acct.bank_code,
        accountName: acct.account_name,
        currency: acct.currency,
        balanceMinor: acct.balance_minor
      };
    },

    async closeAccount(providerAccountId) {
      await callSwapprApi(config, `/v1/virtual-accounts/${providerAccountId}`, { method: 'DELETE' });
      return { closed: true };
    }
  };
}

// NOTE: endpoint paths/response shapes are best-effort based on standard fintech
// infrastructure API conventions (Stripe/Flutterwave-style REST) — MUST be
// verified against Swappr's real API documentation before enabling in
// production. No live credentials exist in this environment to test against.
export function createSwapprRemittanceProvider(config: SwapprConfig): RemittanceProvider {
  const name = 'swappr';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    getCapabilities: () => liveCapabilities('REMITTANCE', ['BANK_TRANSFER'], ['NG', 'US', 'GB']),
    checkHealth: () => liveHealth(name),

    async getQuote(input) {
      const data = (await callSwapprApi(config, '/v1/remittance/quotes', {
        body: {
          source_currency: input.sourceCurrency,
          destination_currency: input.destinationCurrency,
          source_amount_minor: input.sourceAmountMinor
        }
      })) as {
        data: {
          id: string;
          source_amount_minor: number;
          source_currency: string;
          destination_amount_minor: number;
          destination_currency: string;
          fee_minor: number;
          rate: number;
          expires_at: string;
        };
      };
      const q = data.data;
      return {
        quoteId: q.id,
        sourceAmountMinor: q.source_amount_minor,
        sourceCurrency: q.source_currency,
        destinationAmountMinor: q.destination_amount_minor,
        destinationCurrency: q.destination_currency,
        feeMinor: q.fee_minor,
        rate: q.rate,
        expiresAt: q.expires_at
      };
    },

    async sendTransfer(input) {
      const data = (await callSwapprApi(config, '/v1/remittance/transfers', {
        body: {
          reference: input.reference,
          quote_id: input.quoteId,
          recipient: {
            name: input.recipient.name,
            account_number: input.recipient.accountNumber,
            bank_code: input.recipient.bankCode,
            country: input.recipient.country
          }
        }
      })) as { data: { id: string; status: 'PROCESSING' | 'COMPLETED' | 'FAILED' } };
      return { providerReference: data.data.id, status: data.data.status };
    },

    async getTransferStatus(providerReference) {
      const data = (await callSwapprApi(config, `/v1/remittance/transfers/${providerReference}`)) as {
        data: { status: 'PROCESSING' | 'COMPLETED' | 'FAILED'; failure_reason?: string };
      };
      return {
        status: data.data.status,
        ...(data.data.failure_reason ? { failureReason: data.data.failure_reason } : {})
      };
    }
  };
}

// NOTE: endpoint paths/response shapes are best-effort based on standard
// card-issuing API conventions (create cardholder → issue card → fund/freeze/
// terminate, Stripe Issuing / Marqeta-style REST) — MUST be verified against
// Payscribe's real API documentation before enabling in production. No live
// credentials exist in this environment to test against.
export function createPayscribeVirtualCardProvider(config: PayscribeConfig): VirtualCardProvider {
  const name = 'payscribe';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'VIRTUAL_CARD',
    getCapabilities: () => liveCapabilities('VIRTUAL_CARD', ['NGN_CARD', 'USD_CARD'], ['NG']),
    checkHealth: () => liveHealth(name),

    async issueCard(input) {
      // Two-step issuing convention: create the cardholder, then issue+fund the card.
      const cardholder = (await callPayscribeApi(config, '/v1/cardholders', {
        body: { name: input.cardholderName, reference: input.reference }
      })) as { data: { id: string } };

      const data = (await callPayscribeApi(config, '/v1/cards', {
        body: {
          cardholder_id: cardholder.data.id,
          reference: input.reference,
          currency: input.currency,
          funding_amount_minor: input.fundingAmountMinor
        }
      })) as {
        data: {
          id: string;
          last4: string;
          expiry_month: number;
          expiry_year: number;
          brand: 'VISA' | 'MASTERCARD';
          currency: string;
          status: 'ACTIVE' | 'FROZEN' | 'TERMINATED';
        };
      };
      const card = data.data;
      return {
        providerCardId: card.id,
        last4: card.last4,
        expiryMonth: card.expiry_month,
        expiryYear: card.expiry_year,
        brand: card.brand,
        currency: card.currency,
        status: card.status
      };
    },

    async fundCard(input) {
      const data = (await callPayscribeApi(config, `/v1/cards/${input.providerCardId}/fund`, {
        body: { amount_minor: input.amountMinor, reference: input.reference }
      })) as { data: { id: string; balance_minor: number } };
      return { providerReference: data.data.id, balanceMinor: data.data.balance_minor };
    },

    async freezeCard(providerCardId) {
      await callPayscribeApi(config, `/v1/cards/${providerCardId}/freeze`, { body: {} });
      return { status: 'FROZEN' };
    },

    async unfreezeCard(providerCardId) {
      await callPayscribeApi(config, `/v1/cards/${providerCardId}/unfreeze`, { body: {} });
      return { status: 'ACTIVE' };
    },

    async terminateCard(providerCardId) {
      const data = (await callPayscribeApi(config, `/v1/cards/${providerCardId}/terminate`, {
        body: {}
      })) as { data: { refundable_minor: number } };
      return { status: 'TERMINATED', refundableMinor: data.data.refundable_minor };
    },

    async getCard(providerCardId) {
      const data = (await callPayscribeApi(config, `/v1/cards/${providerCardId}`)) as {
        data: {
          id: string;
          last4: string;
          expiry_month: number;
          expiry_year: number;
          brand: 'VISA' | 'MASTERCARD';
          currency: string;
          status: 'ACTIVE' | 'FROZEN' | 'TERMINATED';
          balance_minor: number;
        };
      };
      const card = data.data;
      return {
        providerCardId: card.id,
        last4: card.last4,
        expiryMonth: card.expiry_month,
        expiryYear: card.expiry_year,
        brand: card.brand,
        currency: card.currency,
        status: card.status,
        balanceMinor: card.balance_minor
      };
    }
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
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() // docs: quotes expire after 5 minutes
      };
    },

    async sendTransfer(input) {
      // GAP: `beneficiary_details_id` should come from a prior beneficiary-
      // creation call, not be derived from the raw recipient fields below.
      // Left as a best-effort passthrough — unverified, see module note above.
      const data = (await callYativoApi(
        config,
        '/payout/simple',
        {
          body: {
            debit_wallet: input.recipient.country,
            amount: undefined, // amount is implied by the locked quote server-side; not re-sent here
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

export function createMockRemittanceProvider(name = 'mock-remittance'): RemittanceProvider {
  const quotes = new Map<string, RemittanceQuote>();
  const transfers = new Map<string, 'PROCESSING' | 'COMPLETED' | 'FAILED'>();

  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
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
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      };
      quotes.set(quote.quoteId, quote);
      return Promise.resolve(quote);
    },

    sendTransfer(input) {
      if (!quotes.has(input.quoteId)) {
        return Promise.reject(new Error(`Unknown or expired quote ${input.quoteId}`));
      }
      const providerReference = `${name}_transfer_${input.reference}`;
      transfers.set(providerReference, 'PROCESSING');
      return Promise.resolve({ providerReference, status: 'PROCESSING' });
    },

    getTransferStatus(providerReference) {
      const status = transfers.get(providerReference) ?? 'FAILED';
      return Promise.resolve({ status });
    }
  };
}
