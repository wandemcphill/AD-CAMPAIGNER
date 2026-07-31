// Airtime cashout (airtime-to-cash) provider adapters.
// AirtimeToCash API adapter + mock for testing.

import type { AirtimeCashoutProvider } from './index.js';

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

interface AirtimeToCashQuotaData {
  message: string;
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

    async getSupportedNetworks() {
      return ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];
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
        return {
          sessionId: undefined,
          message: data.message || 'OTP request failed'
        };
      }

      return {
        sessionId: data.data?.sessionId,
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
        return {
          verified: false,
          airtimeBalance: undefined,
          balanceCurrency: undefined,
          sessionId: undefined
        };
      }

      return {
        verified: true,
        airtimeBalance: parseNgnAmount(data.data?.airtimeBalance || '0'),
        balanceCurrency: 'NGN',
        sessionId: data.data?.sessionId
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

    async getQuote(input) {
      return {
        amountMinor: input.amountMinor,
        feeMinor: Math.round(input.amountMinor * 0.04),
        payoutMinor: input.amountMinor - Math.round(input.amountMinor * 0.04),
        currency: 'NGN'
      };
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
        return {
          providerReference: input.reference,
          status: 'PROCESSING',
          failureReason: undefined
        };
      }

      return {
        providerReference: input.reference,
        status: data.code === 4000 ? ('PROCESSING' as const) : ('AMBIGUOUS' as const),
        failureReason: data.message
      };
    },

    async getTransactionStatus(reference) {
      return {
        status: 'COMPLETED',
        payout: Math.floor(Math.random() * 50000) + 5000,
        payoutCurrency: 'NGN'
      };
    },

    async checkHealth() {
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
          status: data.code === 5030 ? ('HEALTHY' as const) : ('DEGRADED' as const),
          latencyMs: Date.now() - start
        };
      } catch {
        return {
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

    async getSupportedNetworks() {
      return ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];
    },

    async requestOtp(phone, network) {
      return {
        sessionId: `SESSION-${Date.now()}`,
        message: 'OTP sent successfully'
      };
    },

    async verifyOtp(input) {
      return {
        verified: input.otp === '000000' ? false : true,
        airtimeBalance: Math.floor(Math.random() * 100000) + 5000,
        balanceCurrency: 'NGN',
        sessionId: input.sessionId
      };
    },

    async getBalance(phone, network) {
      return {
        balanceMinor: Math.floor(Math.random() * 100000) + 5000,
        currency: 'NGN'
      };
    },

    async getQuote(input) {
      return {
        amountMinor: input.amountMinor,
        feeMinor: Math.round(input.amountMinor * 0.04),
        payoutMinor: input.amountMinor - Math.round(input.amountMinor * 0.04),
        currency: 'NGN'
      };
    },

    async initiateCashout(input) {
      return {
        providerReference: `MOCK-${input.reference}`,
        status: 'PROCESSING',
        failureReason: undefined
      };
    },

    async getTransactionStatus(reference) {
      return {
        status: 'COMPLETED',
        payout: Math.floor(Math.random() * 50000) + 5000,
        payoutCurrency: 'NGN'
      };
    },

    async checkHealth() {
      return {
        status: 'HEALTHY',
        latencyMs: 30
      };
    }
  };
}
