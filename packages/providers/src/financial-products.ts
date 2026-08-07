// Virtual account, virtual card, and remittance provider adapters.
//
// No real provider is CONTRACTED yet — there are no live API credentials for
// Swappr, Payscribe, or Yativo in this environment (see the convergence plan's
// Phase E note; earlier diligence also covered BridgeCard/SwervPay/Payceler/
// Nium/Swan/BVNK). Mock adapters below exist so the API surface, saga wiring,
// and Prisma models can be exercised without any live dependency. Real HTTP
// adapters for Swappr/Payscribe/Yativo are also implemented further down —
// they are code-complete and routable via ProviderConfig/ProviderRouterService,
// but every endpoint path and response shape is a best-effort convention guess,
// not verified against real provider docs, and must not be enabled in
// production until real credentials exist and the shapes are confirmed.

import type { ProviderAdapterBase, ProviderCapabilities, ProviderHealthSnapshot } from './contract.js';
import { CURRENT_INTERFACE_VERSION } from './contract.js';

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
  apiKey: string;
  baseUrl?: string; // default https://api.yativo.com
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

async function callYativoApi(
  config: YativoConfig,
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<unknown> {
  if (!config.apiKey) throw new Error('Yativo adapter requires config.apiKey.');
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? 'https://api.yativo.com'}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      'x-api-key': config.apiKey,
      'content-type': 'application/json'
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

// NOTE: endpoint paths/response shapes are best-effort based on standard fintech
// infrastructure API conventions (Stripe/Flutterwave-style REST) — MUST be
// verified against Yativo's real API documentation before enabling in
// production. No live credentials exist in this environment to test against.
// Yativo is configured as the REMITTANCE fallback (lower priority than Swappr)
// — see the ProviderConfig seed.
export function createYativoRemittanceProvider(config: YativoConfig): RemittanceProvider {
  const name = 'yativo';
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'REMITTANCE',
    getCapabilities: () => liveCapabilities('REMITTANCE', ['BANK_TRANSFER'], ['NG', 'US']),
    checkHealth: () => liveHealth(name),

    async getQuote(input) {
      const data = (await callYativoApi(config, '/v1/quotes', {
        body: {
          source_currency: input.sourceCurrency,
          destination_currency: input.destinationCurrency,
          source_amount_minor: input.sourceAmountMinor
        }
      })) as {
        id: string;
        source_amount_minor: number;
        source_currency: string;
        destination_amount_minor: number;
        destination_currency: string;
        fee_minor: number;
        rate: number;
        expires_at: string;
      };
      return {
        quoteId: data.id,
        sourceAmountMinor: data.source_amount_minor,
        sourceCurrency: data.source_currency,
        destinationAmountMinor: data.destination_amount_minor,
        destinationCurrency: data.destination_currency,
        feeMinor: data.fee_minor,
        rate: data.rate,
        expiresAt: data.expires_at
      };
    },

    async sendTransfer(input) {
      const data = (await callYativoApi(config, '/v1/transfers', {
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
      })) as { id: string; status: 'PROCESSING' | 'COMPLETED' | 'FAILED' };
      return { providerReference: data.id, status: data.status };
    },

    async getTransferStatus(providerReference) {
      const data = (await callYativoApi(config, `/v1/transfers/${providerReference}`)) as {
        status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
        failure_reason?: string;
      };
      return {
        status: data.status,
        ...(data.failure_reason ? { failureReason: data.failure_reason } : {})
      };
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
