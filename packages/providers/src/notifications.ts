// Termii notification provider adapters (SMS, Email, WhatsApp).
//
// Termii's SMS and WhatsApp channels both route through the same
// POST /api/sms/send endpoint, distinguished only by the "channel" field
// ("generic" for SMS, "whatsapp" for WhatsApp) — this is Termii's documented
// API shape, not something invented per-account. Email goes through the
// separate POST /api/email/send endpoint, which expects a pre-configured
// email_configuration_id (set up on the Termii dashboard) plus the rendered
// content; templating (variable substitution) happens on our side before the
// request is made — see packages/notifications/src/templates.ts — because we
// cannot verify from code alone whether server-side template substitution is
// configured on this account's Termii dashboard.
//
// None of these adapters read env vars directly — callers inject credentials
// via TermiiConfig, matching every other adapter in this package.

import type { NotificationProviderAdapter } from './index.js';

export interface TermiiConfig {
  apiKey: string;
  baseUrl?: string;
  /** Approved transactional sender ID, e.g. "FLIPTRYBE" or "N-Alert". */
  smsSenderId?: string;
  /** Configuration ID for the approved WhatsApp sender, set up on the Termii dashboard. */
  whatsappConfigurationId?: string;
  /** Configuration ID for the verified email sender, set up on the Termii dashboard. */
  emailConfigurationId?: string;
  fetcher?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.ng.termii.com';

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

interface TermiiSmsResponse {
  message_id?: string;
  message_id_str?: string;
  message?: string;
  code?: string;
  balance?: number;
  user?: string;
}

async function termiiPost(
  config: TermiiConfig,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? DEFAULT_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, api_key: config.apiKey })
  });
  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    // Termii returns non-JSON on some transport-level failures; leave json empty.
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Transactional SMS via Termii's generic channel. Covers both plain
 * transactional messages and OTP-as-text (the code is composed into `body`
 * by the caller — this does NOT use Termii's separate stateful OTP
 * send/verify pair, which is a distinct feature requiring its own pin
 * lifecycle and isn't implemented here).
 */
export function createTermiiSmsAdapter(config: TermiiConfig): NotificationProviderAdapter {
  return {
    name: 'termii-sms',
    isConfigured() {
      return Boolean(config.apiKey && config.smsSenderId);
    },
    async send(input) {
      const result = await termiiPost(config, '/api/sms/send', {
        to: input.to,
        from: config.smsSenderId,
        sms: input.body,
        type: 'plain',
        channel: 'generic'
      });

      const payload = result.json as TermiiSmsResponse;
      if (!result.ok) {
        throw new Error(
          `Termii SMS send failed (HTTP ${result.status}): ${payload.message ?? JSON.stringify(payload)}`
        );
      }

      const messageId = payload.message_id ?? payload.message_id_str;
      return {
        id: messageId ?? uid('termii_sms'),
        accepted: Boolean(messageId),
        providerStatus: payload.message ?? 'sent',
        raw: payload
      };
    }
  };
}

/**
 * WhatsApp via Termii — same send endpoint as SMS with channel="whatsapp",
 * gated on whatsappConfigurationId being set. isConfigured() returns false
 * (rather than attempting a send that will be rejected by Termii) when the
 * WhatsApp sender hasn't been provisioned on the dashboard yet — callers
 * must check this and mark the channel PENDING, not attempt delivery.
 */
export function createTermiiWhatsappAdapter(config: TermiiConfig): NotificationProviderAdapter {
  return {
    name: 'termii-whatsapp',
    isConfigured() {
      return Boolean(config.apiKey && config.whatsappConfigurationId);
    },
    async send(input) {
      if (!config.whatsappConfigurationId) {
        throw new Error('Termii WhatsApp is not configured (missing whatsappConfigurationId).');
      }

      const result = await termiiPost(config, '/api/sms/send', {
        to: input.to,
        from: config.whatsappConfigurationId,
        sms: input.body,
        type: 'plain',
        channel: 'whatsapp'
      });

      const payload = result.json as TermiiSmsResponse;
      if (!result.ok) {
        throw new Error(
          `Termii WhatsApp send failed (HTTP ${result.status}): ${payload.message ?? JSON.stringify(payload)}`
        );
      }

      const messageId = payload.message_id ?? payload.message_id_str;
      return {
        id: messageId ?? uid('termii_wa'),
        accepted: Boolean(messageId),
        providerStatus: payload.message ?? 'sent',
        raw: payload
      };
    }
  };
}

interface TermiiEmailResponse {
  message_id?: string;
  message?: string;
}

/**
 * Transactional email via Termii, using a pre-configured email_configuration_id
 * (set up on the Termii dashboard — sender identity, DKIM/SPF, etc). `title`
 * is sent as the subject; `body` is the fully-rendered HTML produced by
 * packages/notifications/src/templates.ts before this adapter is called.
 */
export function createTermiiEmailAdapter(config: TermiiConfig): NotificationProviderAdapter {
  return {
    name: 'termii-email',
    isConfigured() {
      return Boolean(config.apiKey && config.emailConfigurationId);
    },
    async send(input) {
      if (!config.emailConfigurationId) {
        throw new Error('Termii Email is not configured (missing emailConfigurationId).');
      }

      const result = await termiiPost(config, '/api/email/send', {
        email_address: input.to,
        email_configuration_id: config.emailConfigurationId,
        subject: input.title,
        code: input.body
      });

      const payload = result.json as TermiiEmailResponse;
      if (!result.ok) {
        throw new Error(
          `Termii Email send failed (HTTP ${result.status}): ${payload.message ?? JSON.stringify(payload)}`
        );
      }

      // Termii can return HTTP 200 with an error body (insufficient balance, an
      // unverified email_configuration_id, etc) and no message_id — treating
      // that as accepted would record an undelivered email as SENT. Acceptance
      // is keyed off the message ID exactly as the SMS and WhatsApp adapters
      // above do, so a 200-with-no-id response is reported as not accepted
      // rather than fabricated as a success.
      const messageId = payload.message_id;
      return {
        id: messageId ?? uid('termii_email'),
        accepted: Boolean(messageId),
        providerStatus: payload.message ?? (messageId ? 'sent' : 'no_message_id_returned'),
        raw: payload
      };
    }
  };
}
