// Virtual account, virtual card, and remittance provider adapters.
//
// No real provider is contracted yet (see the convergence plan's Phase E note —
// this is genuinely blocked on business-side diligence over BridgeCard, SwervPay,
// Payceler, Nium, Swan, BVNK, not on code). These interfaces + mock adapters exist
// so the API surface, saga wiring, and Prisma models can be built and tested now,
// with a real adapter dropped in later without touching anything above this layer.

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
