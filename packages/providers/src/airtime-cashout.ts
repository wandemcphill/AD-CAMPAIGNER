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

// ─── IACafe A2C Adapter ─────────────────────────────────────────────────────
//
// Real, verified API surface (docs at https://iacafe.com.ng/docs/a2c):
//   GET  /a2c/config         - no auth; pricing/limits/networks, always read live
//   POST /a2c/check-session  - optional pre-check for a cached session
//   POST /a2c/request-otp    - step 1 (may short-circuit straight to step 3)
//   POST /a2c/verify-otp     - step 2
//   POST /a2c/transfer       - step 3; requires the SIM's Share & Sell PIN
//   GET  /a2c/recent         - recent transactions; no single-lookup endpoint exists
//
// Uses the same IACAFE_API_KEY/IACAFE_BASE_URL env vars as the VTU-side IACafe
// adapter (packages/providers/src/vtu.ts createIACafeAdapter) since it's the same
// account, but this file intentionally does NOT share code with that adapter —
// different endpoint family (/a2c/* vs /airtime, /data, ...), different response
// shapes, different domain (cash-out vs purchase). Keeping them separate avoids
// entangling two unrelated products for a marginal amount of shared fetch boilerplate.

export interface IACafeA2CConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface IACafeA2CSuccess<T> {
  success: true;
  step?: number;
  has_session?: boolean;
  message?: string;
  data: T;
}

interface IACafeA2CError {
  success: false;
  error: { code: string; message: string };
  request_id?: string;
}

type IACafeA2CResponse<T> = IACafeA2CSuccess<T> | IACafeA2CError;

interface IACafeA2CConfigData {
  charge_percent: number;
  flat_fee: number;
  flat_fee_threshold: number;
  min_amount: number;
  max_amount: number;
  session_hours: number;
  note?: string;
  networks: Array<{ key: string; id: string; name: string }>;
}

interface IACafeA2CSessionData {
  session_id: number;
  client_id: string;
  phone: string;
  network: string;
  network_name: string;
  network_id?: string;
  otp_verified: boolean;
  current_step?: number;
  expires_at: string;
  cached?: boolean;
}

interface IACafeA2CTransferData {
  request_id: string;
  phone: string;
  network: string;
  network_name: string;
  airtime_amount: number;
  charge_percent: number;
  flat_fee: number;
  total_charge: number;
  payout: number;
  balance_before: string;
  balance_after: string;
  status: string;
  provider: string;
}

interface IACafeA2CRecentEntry {
  id: number;
  request_id: string;
  phone_number: string;
  network_name: string;
  amount: string;
  charge_percent: number;
  flat_fee: string;
  total_charge: string;
  payout_amount: string;
  balance_before: string;
  balance_after: string;
  status: string;
  message: string;
  created_at: string;
  completed_at?: string;
}

// Client errors: the caller's request was wrong (bad phone/network/amount/pin
// format, unverified OTP, expired session, duplicate request_id). These are
// deterministic — surfaced as thrown errors so DigitalValueService's catch
// block marks the transaction FAILED rather than leaving it ambiguous.
const IACAFE_A2C_CLIENT_ERROR_CODES = new Set([
  'missing_fields',
  'invalid_phone',
  'invalid_network',
  'invalid_amount',
  'invalid_pin',
  'otp_not_verified',
  'amount_too_small',
  'session_expired',
  'duplicate_request',
  'unauthorized'
]);

export function createIACafeAirtimeCashoutAdapter(
  config: IACafeA2CConfig
): AirtimeCashoutProvider {
  const baseUrl = config.baseUrl || 'https://iacafe.com.ng/devapi/v1';
  const f = config.fetcher ?? fetch;

  async function post<T>(path: string, body: unknown): Promise<IACafeA2CResponse<T>> {
    const response = await f(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });
    return (await response.json()) as IACafeA2CResponse<T>;
  }

  async function getConfig(): Promise<IACafeA2CConfigData | null> {
    try {
      const response = await f(`${baseUrl}/a2c/config`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      const data = (await response.json()) as IACafeA2CResponse<IACafeA2CConfigData>;
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }

  function normalizeNetwork(network: string): string {
    const key = network.trim().toLowerCase();
    const aliases: Record<string, string> = {
      'mtn-ng': 'mtn',
      '1': 'mtn',
      'airtel-ng': 'airtel',
      '2': 'airtel',
      'glo-ng': 'glo',
      '3': 'glo',
      etisalat: '9mobile',
      '9mobile-ng': '9mobile',
      '4': '9mobile'
    };
    return aliases[key] || key;
  }

  return {
    name: 'iacafe-a2c',
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: 'AIRTIME_CASHOUT' as const,
    getCapabilities: () => airtimeCashoutCapabilities('strong'),

    async getSupportedNetworks(): Promise<string[]> {
      const cfg = await getConfig();
      if (cfg) return cfg.networks.map((n) => n.name.toUpperCase());
      return ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];
    },

    async requestOtp(phone, network) {
      const data = await post<IACafeA2CSessionData>('/a2c/request-otp', {
        phone,
        network: normalizeNetwork(network)
      });

      if (!data.success) {
        return { message: data.error.message };
      }

      // data.message already documents the fast path, e.g. "Active session.
      // Skip to step 3 (transfer)." when data.step === 3 (cached session, no
      // new OTP sent) vs "OTP sent. Verify with step 2." — pass it through
      // verbatim so callers can branch on it without us re-inventing a field
      // the fixed AirtimeCashoutProvider interface doesn't have room for.
      return {
        sessionId: String(data.data.session_id),
        message: data.message ?? (data.step === 3 ? 'Active session — skip to transfer.' : 'OTP sent.')
      };
    },

    async verifyOtp(input) {
      if (!input.sessionId) {
        return { verified: false };
      }

      const data = await post<IACafeA2CSessionData>('/a2c/verify-otp', {
        session_id: Number(input.sessionId),
        otp: input.otp
      });

      if (!data.success) {
        return { verified: false };
      }

      return {
        verified: data.data.otp_verified,
        sessionId: String(data.data.session_id)
      };
    },

    async getBalance(_phone, _network) {
      // IACafe's A2C API has no standalone "check airtime balance" endpoint —
      // balance/eligibility is only surfaced indirectly through the OTP
      // request/verify flow and the final transfer response's
      // balance_before/balance_after (that's the caller's IACafe wallet
      // balance, not the SIM's airtime balance). There is nothing to query
      // here, so this intentionally returns a zeroed placeholder rather than
      // guessing — same limitation the legacy airtimetocash adapter has.
      return { balanceMinor: 0, currency: 'NGN' };
    },

    async getQuote(input) {
      const cfg = await getConfig();
      const amountNgn = Math.round(input.amountMinor / 100);

      if (!cfg) {
        // Fallback only if /a2c/config is unreachable; docs say never
        // hardcode rates, so this is a last-resort estimate, not the source
        // of truth.
        const feeMinor = Math.round(input.amountMinor * 0.08);
        return {
          amountMinor: input.amountMinor,
          feeMinor,
          payoutMinor: input.amountMinor - feeMinor,
          currency: 'NGN'
        };
      }

      const flatFeeNgn = amountNgn < cfg.flat_fee_threshold ? cfg.flat_fee : 0;
      const feeNgn = Math.round((amountNgn * cfg.charge_percent) / 100) + flatFeeNgn;
      const payoutNgn = Math.max(0, amountNgn - feeNgn);

      return {
        amountMinor: input.amountMinor,
        feeMinor: feeNgn * 100,
        payoutMinor: payoutNgn * 100,
        currency: 'NGN'
      };
    },

    async initiateCashout(input) {
      if (!input.sessionId) {
        throw new Error('sessionId is required to initiate an IACafe A2C transfer.');
      }
      if (!input.pin) {
        // Do NOT default this to a placeholder PIN — it is the SIM's real
        // Share & Sell PIN (set by the SIM owner via USSD on their network),
        // not an IA-Café account credential. Silently defaulting it (as the
        // legacy airtimetocash adapter does with `input.pin || '1234'`) would
        // send a guaranteed-wrong PIN to a live provider on a real transfer.
        throw new Error('pin (SIM Share & Sell PIN) is required to initiate an IACafe A2C transfer.');
      }

      const requestId = `a2c_${input.reference}`;
      const data = await post<IACafeA2CTransferData>('/a2c/transfer', {
        session_id: Number(input.sessionId),
        amount: Math.round(input.amountMinor / 100),
        pin: input.pin,
        request_id: requestId
      });

      if (data.success) {
        return { providerReference: data.data.request_id, status: 'PROCESSING' as const };
      }

      const code = data.error.code;
      if (IACAFE_A2C_CLIENT_ERROR_CODES.has(code)) {
        // Deterministically our/the caller's fault — throw so the caller's
        // catch block marks the transaction FAILED instead of leaving it
        // ambiguous.
        throw new Error(data.error.message);
      }

      // Provider/network-side errors (otp_invalid, otp_request_failed,
      // transfer_failed — wrong PIN / insufficient airtime / Share & Sell not
      // activated / daily limit, all folded into one code per IACafe's docs —
      // plus provider_error/provider_unavailable/rate_limited/server_error):
      // genuinely uncertain whether money moved, so surface as AMBIGUOUS for
      // manual reconciliation rather than guessing.
      return {
        providerReference: requestId,
        status: 'AMBIGUOUS' as const,
        failureReason: data.error.message
      };
    },

    async getTransactionStatus(reference) {
      // IACafe's A2C API has no single-transaction requery endpoint — only
      // /a2c/recent (max 50 records). We scan recent transactions for a
      // matching request_id. If the transaction has aged out of the recent
      // list (e.g. very slow processing plus high transaction volume), this
      // will report PROCESSING even though the true state is unknown; that's
      // an accepted limitation of the underlying API, not a bug here.
      const response = await f(`${baseUrl}/a2c/recent?limit=50`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${config.apiKey}` }
      });
      const data = (await response.json()) as
        | { success: true; count: number; data: IACafeA2CRecentEntry[] }
        | IACafeA2CError;

      if (!data.success) {
        return { status: 'PROCESSING' as const };
      }

      // reference passed to initiateCashout is used to derive request_id as
      // `a2c_${reference}`; match against either form defensively.
      const match = data.data.find(
        (entry) => entry.request_id === reference || entry.request_id === `a2c_${reference}`
      );

      if (!match) {
        return { status: 'PROCESSING' as const };
      }

      if (match.status === 'success') {
        return {
          status: 'COMPLETED' as const,
          payout: Math.round(parseFloat(match.payout_amount) * 100),
          payoutCurrency: 'NGN'
        };
      }

      if (match.status === 'failed' || match.status === 'error') {
        return { status: 'FAILED' as const };
      }

      return { status: 'PROCESSING' as const };
    },

    async checkHealth(): Promise<ProviderHealthSnapshot> {
      const start = Date.now();
      try {
        const cfg = await getConfig();
        return {
          providerName: 'iacafe-a2c',
          status: cfg ? ('HEALTHY' as const) : ('DEGRADED' as const),
          latencyMs: Date.now() - start
        };
      } catch {
        return {
          providerName: 'iacafe-a2c',
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
