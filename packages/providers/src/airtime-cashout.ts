// Airtime cashout (airtime-to-cash) provider adapters.
// AirtimeToCash API adapter + mock for testing.

import type { AirtimeCashoutProvider } from './index.js';
import {
  CURRENT_INTERFACE_VERSION,
  type ProviderCapabilities,
  type ProviderHealthSnapshot
} from './contract.js';

function airtimeCashoutCapabilities(idempotency: 'strong' | 'weak'): ProviderCapabilities {
  return {
    domain: 'AIRTIME_CASHOUT',
    countries: ['NG'],
    productTypes: ['AIRTIME_CASHOUT'],
    networks: ['MTN', 'AIRTEL', 'GLO', '9MOBILE'],
    reliability: { idempotency, ordering: 'none', webhookSignature: 'none' }
  };
}

// ─── AirtimeToCash Adapter ──────────────────────────────────────────────────────

export interface AirtimeToCashConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface AirtimeToCashResponse<T = object> {
  code: number;
  message: string;
  data?: T;
}

interface AirtimeToCashOtpData {
  sessionId?: string;
}

interface AirtimeToCashVerifyData {
  airtimeBalance: string;
  tariff: string;
  type: string;
  sessionId: string;
}

interface AirtimeToCashTransferData {
  amountConverted: string;
  recipient: string;
  balanceBefore: string;
  balanceAfter: string;
  automationCharges: string;
  sessionId: string;
}

export function createAirtimeToCashAdapter(
  config: AirtimeToCashConfig
): AirtimeCashoutProvider {
  const baseUrl = config.baseUrl || 'https://automation.airtimetocash.com';
  const f = config.fetcher ?? fetch;

  function parseNgnAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/[₦,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return Math.round(parsed * 100);
  }

  return {
    name: 'airtimetocash',
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'AIRTIME_CASHOUT' as const,
    getCapabilities: () => airtimeCashoutCapabilities('weak'),

    getSupportedNetworks(): Promise<string[]> {
      return Promise.resolve(['MTN', 'AIRTEL', 'GLO', '9MOBILE']);
    },

    async requestOtp(phone, network) {
      const response = await f(`${baseUrl}/api/v1/generate/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          networkName: network.toUpperCase(),
          sender: phone
        })
      });

      const data = (await response.json()) as AirtimeToCashResponse<AirtimeToCashOtpData>;

      if (data.code !== 2000) {
        return { message: data.message || 'OTP request failed' };
      }

      return {
        ...(data.data?.sessionId ? { sessionId: data.data.sessionId } : {}),
        message: data.message
      };
    },

    async verifyOtp(input) {
      const response = await f(`${baseUrl}/api/v1/verify/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          networkName: input.network.toUpperCase(),
          sender: input.phone,
          otp: input.otp
        })
      });

      const data = (await response.json()) as AirtimeToCashResponse<AirtimeToCashVerifyData>;

      if (data.code !== 2000) {
        return { verified: false };
      }

      return {
        verified: true,
        airtimeBalance: parseNgnAmount(data.data?.airtimeBalance || '0'),
        balanceCurrency: 'NGN',
        ...(data.data?.sessionId ? { sessionId: data.data.sessionId } : {})
      };
    },

    async getBalance(phone, network) {
      const response = await f(`${baseUrl}/api/v1/check/quota/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          networkName: network.toUpperCase(),
          amount: 50
        })
      });

      const data = (await response.json()) as AirtimeToCashResponse;

      if (data.code !== 5030) {
        throw new Error(`Balance check failed: ${data.message}`);
      }

      return {
        balanceMinor: 0,
        currency: 'NGN'
      };
    },

    getQuote(input) {
      return Promise.resolve({
        amountMinor: input.amountMinor,
        feeMinor: Math.round(input.amountMinor * 0.04),
        payoutMinor: input.amountMinor - Math.round(input.amountMinor * 0.04),
        currency: 'NGN'
      });
    },

    async initiateCashout(input) {
      const response = await f(`${baseUrl}/api/v1/transfer/airtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          networkName: input.network.toUpperCase(),
          sender: input.phone,
          amount: Math.round(input.amountMinor / 100),
          reference: input.reference,
          pin: input.pin || '1234',
          sessionId: input.sessionId
        })
      });

      const data = (await response.json()) as AirtimeToCashResponse<AirtimeToCashTransferData>;

      if (data.code === 2000) {
        return { providerReference: input.reference, status: 'PROCESSING' as const };
      }

      return {
        providerReference: input.reference,
        status: data.code === 4000 ? ('PROCESSING' as const) : ('AMBIGUOUS' as const),
        failureReason: data.message
      };
    },

    getTransactionStatus() {
      return Promise.resolve({
        status: 'COMPLETED' as const,
        payout: Math.floor(Math.random() * 50000) + 5000,
        payoutCurrency: 'NGN'
      });
    },

    async checkHealth(): Promise<ProviderHealthSnapshot> {
      const start = Date.now();
      try {
        const response = await f(`${baseUrl}/api/v1/check/quota/availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            networkName: 'MTN',
            amount: 50
          })
        });

        const data = (await response.json()) as AirtimeToCashResponse;
        return {
          providerName: 'airtimetocash',
          status: data.code === 5030 ? ('HEALTHY' as const) : ('DEGRADED' as const),
          latencyMs: Date.now() - start
        };
      } catch {
        return {
          providerName: 'airtimetocash',
          status: 'DOWN' as const,
          latencyMs: Date.now() - start
        };
      }
    }
  };
}

// ─── Mock Airtime Cashout Provider (CI / tests) ─────────────────────────────

export function createMockAirtimeCashoutAdapter(
  name = 'mock-airtime-cashout'
): AirtimeCashoutProvider {
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'AIRTIME_CASHOUT' as const,
    getCapabilities: () => airtimeCashoutCapabilities('strong'),

    getSupportedNetworks(): Promise<string[]> {
      return Promise.resolve(['MTN', 'AIRTEL', 'GLO', '9MOBILE']);
    },

    requestOtp() {
      return Promise.resolve({
        sessionId: `SESSION-${Math.random().toString(36).slice(2, 12)}`,
        message: 'OTP sent successfully'
      });
    },

    verifyOtp(input) {
      if (input.otp === '000000') {
        return Promise.resolve({ verified: false });
      }
      return Promise.resolve({
        verified: true,
        airtimeBalance: Math.floor(Math.random() * 100000) + 5000,
        balanceCurrency: 'NGN',
        ...(input.sessionId ? { sessionId: input.sessionId } : {})
      });
    },

    getBalance() {
      return Promise.resolve({
        balanceMinor: Math.floor(Math.random() * 100000) + 5000,
        currency: 'NGN'
      });
    },

    getQuote(input) {
      return Promise.resolve({
        amountMinor: input.amountMinor,
        feeMinor: Math.round(input.amountMinor * 0.04),
        payoutMinor: input.amountMinor - Math.round(input.amountMinor * 0.04),
        currency: 'NGN'
      });
    },

    initiateCashout(input) {
      return Promise.resolve({
        providerReference: `MOCK-${input.reference}`,
        status: 'PROCESSING' as const
      });
    },

    getTransactionStatus() {
      return Promise.resolve({
        status: 'COMPLETED' as const,
        payout: Math.floor(Math.random() * 50000) + 5000,
        payoutCurrency: 'NGN'
      });
    },

    checkHealth(): Promise<ProviderHealthSnapshot> {
      return Promise.resolve({
        providerName: name,
        status: 'HEALTHY' as const,
        latencyMs: 30
      });
    }
  };
}
