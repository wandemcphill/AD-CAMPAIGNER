// Reusable transactional templates for email/SMS delivery. Variable
// substitution happens entirely on our side (see renderTemplate) — we hand
// Termii the fully-rendered content rather than relying on server-side
// templating on their end, since that isn't something we can verify without
// the live Termii dashboard configuration.

export interface NotificationTemplateVars {
  first_name?: string;
  amount?: string;
  currency?: string;
  transaction_id?: string;
  reference?: string;
  status?: string;
  service?: string;
  date?: string;
  support_url?: string;
  business_name?: string;
  pay_url?: string;
  view_url?: string;
  payer_name?: string;
  [key: string]: string | undefined;
}

const APP_ORIGIN =
  process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://fliptrybe.xyz";
const DEFAULT_SUPPORT_URL = `${APP_ORIGIN}/support`;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string);
}

const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

/**
 * Sanitises a value that is about to land inside an href.
 *
 * Only http(s) survives, so `javascript:`, `data:`, and `vbscript:` payloads
 * cannot become a live link. Relative values resolve against the app origin.
 * Anything unsafe or unparseable collapses to "#" rather than rendering a
 * working link to somewhere unexpected.
 */
function sanitizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "#";
  }

  // Control characters are how a scheme gets smuggled past a naive check
  // ("java\tscript:..."), and browsers strip them before dispatching —
  // matching them is the point here, not an accident.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return "#";
  }

  try {
    const parsed = new URL(trimmed, APP_ORIGIN);

    return SAFE_URL_SCHEMES.has(parsed.protocol) ? parsed.toString() : "#";
  } catch {
    return "#";
  }
}

/**
 * `{{name}}` interpolates a value; `{{url:name}}` marks the one context where
 * the value is an href, which needs scheme validation on top of escaping.
 *
 * The marker is per-placeholder rather than per-variable because the same
 * variable changes context between templates — `reference` is a reset URL in
 * password_reset and a plain payment reference everywhere else.
 */
const PLACEHOLDER_PATTERN = /\{\{\s*(url:)?(\w+)\s*\}\}/g;

export function renderTemplate(
  template: string,
  vars: NotificationTemplateVars,
  context: "html" | "text" = "text"
): string {
  return template.replace(
    PLACEHOLDER_PATTERN,
    (_match, urlMarker: string | undefined, key: string) => {
      const raw = vars[key] ?? "";

      if (context !== "html") {
        // Subjects and SMS bodies are plain text: escaping them would surface
        // literal &amp; to the reader, and neither can execute markup.
        return raw;
      }

      return urlMarker ? escapeHtml(sanitizeUrl(raw)) : escapeHtml(raw);
    }
  );
}

export interface NotificationTemplate {
  subject: string;
  emailBody: string;
  smsBody: string;
}

const EMAIL_WRAPPER = (bodyHtml: string) => `
<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
  <p>Hi {{first_name}},</p>
  ${bodyHtml}
  <p style="margin-top: 24px; font-size: 13px; color: #666;">
    Need help? Visit <a href="{{url:support_url}}">{{support_url}}</a>.
  </p>
</div>
`.trim();

export const notificationTemplates = {
  transaction_receipt: {
    subject: "Receipt: {{service}} — {{reference}}",
    emailBody: EMAIL_WRAPPER(`
      <p>Your {{service}} order is <strong>{{status}}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #666;">Amount</td><td style="text-align: right;">{{currency}} {{amount}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Reference</td><td style="text-align: right;">{{reference}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Transaction ID</td><td style="text-align: right;">{{transaction_id}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Date</td><td style="text-align: right;">{{date}}</td></tr>
      </table>
    `),
    smsBody:
      "{{service}} {{status}}: {{currency}} {{amount}} (ref {{reference}}). " +
      "TXN: {{transaction_id}}. Support: {{support_url}}"
  },
  payment_success: {
    subject: "Payment received — {{currency}} {{amount}}",
    emailBody: EMAIL_WRAPPER(`
      <p>We've received your payment of <strong>{{currency}} {{amount}}</strong>.</p>
      <p>Reference: {{reference}}<br/>Transaction ID: {{transaction_id}}<br/>Date: {{date}}</p>
    `),
    smsBody:
      "Payment received: {{currency}} {{amount}} (ref {{reference}}). Thank you! Support: {{support_url}}"
  },
  payment_failed: {
    subject: "Payment could not be completed",
    emailBody: EMAIL_WRAPPER(`
      <p>Your payment of <strong>{{currency}} {{amount}}</strong> could not be completed.</p>
      <p>Reference: {{reference}}<br/>Reason: {{status}}</p>
      <p>No funds have been deducted for this attempt.</p>
    `),
    smsBody: "Payment of {{currency}} {{amount}} failed (ref {{reference}}). No funds deducted. {{support_url}}"
  },
  wallet_funded: {
    subject: "Wallet credited: {{currency}} {{amount}}",
    emailBody: EMAIL_WRAPPER(`
      <p>Your wallet has been credited <strong>{{currency}} {{amount}}</strong>.</p>
      <p>Reference: {{reference}}<br/>Date: {{date}}</p>
    `),
    smsBody: "Wallet credited: {{currency}} {{amount}} (ref {{reference}}). {{support_url}}"
  },
  wallet_debited: {
    subject: "Wallet debited: {{currency}} {{amount}}",
    emailBody: EMAIL_WRAPPER(`
      <p>Your wallet has been debited <strong>{{currency}} {{amount}}</strong> for {{service}}.</p>
      <p>Reference: {{reference}}<br/>Date: {{date}}</p>
    `),
    smsBody: "Wallet debited: {{currency}} {{amount}} for {{service}} (ref {{reference}}). {{support_url}}"
  },
  otp: {
    subject: "Your verification code",
    emailBody: EMAIL_WRAPPER(`
      <p>Your verification code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">{{reference}}</p>
      <p>This code expires shortly. Do not share it with anyone.</p>
    `),
    smsBody: "{{reference}} is your FlipTrybe verification code. Do not share this with anyone."
  },
  security_alert: {
    subject: "Security alert on your account",
    emailBody: EMAIL_WRAPPER(`
      <p><strong>{{status}}</strong></p>
      <p>If this wasn't you, secure your account immediately.</p>
      <p>Date: {{date}}</p>
    `),
    smsBody: "Security alert: {{status}}. If this wasn't you, secure your account now. {{support_url}}"
  },
  password_reset: {
    subject: "Reset your FlipTrybe password",
    emailBody: EMAIL_WRAPPER(`
      <p>We received a request to reset your password.</p>
      <p style="margin: 24px 0;">
        <a href="{{url:reference}}" style="background: #d97706; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">Reset password</a>
      </p>
      <p style="font-size: 13px; color: #666;">
        Or paste this link into your browser:<br />
        <span style="word-break: break-all;">{{reference}}</span>
      </p>
      <p>This link expires in {{status}} and can only be used once.</p>
      <p>If you didn't request this, you can ignore this email — your password will not change.</p>
    `),
    // Deliberately no link in the SMS variant: reset links must not travel over
    // a channel this flow never verifies ownership of.
    smsBody:
      "A FlipTrybe password reset was requested. Check your email for the link. " +
      "If this wasn't you, contact {{support_url}}"
  },
  invoice_sent: {
    subject: "New invoice from {{business_name}}: {{reference}}",
    emailBody: EMAIL_WRAPPER(`
      <p><strong>{{business_name}}</strong> has sent you an invoice.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #666;">Invoice</td><td style="text-align: right;">{{reference}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Amount due</td><td style="text-align: right;">{{currency}} {{amount}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Due</td><td style="text-align: right;">{{date}}</td></tr>
      </table>
      <p style="margin: 24px 0;">
        <a href="{{url:pay_url}}" style="background: #d97706; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">View &amp; pay invoice</a>
      </p>
      <p style="font-size: 13px; color: #666;">
        Or paste this link into your browser:<br />
        <span style="word-break: break-all;">{{pay_url}}</span>
      </p>
    `),
    smsBody:
      "{{business_name}} sent you invoice {{reference}} for {{currency}} {{amount}}, due {{date}}. " +
      "Pay: {{pay_url}}"
  },
  payment_link_paid: {
    subject: "You were paid {{currency}} {{amount}} — {{reference}}",
    emailBody: EMAIL_WRAPPER(`
      <p><strong>{{payer_name}}</strong> just paid your "{{service}}" payment link.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 0; color: #666;">Amount</td><td style="text-align: right;">{{currency}} {{amount}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Reference</td><td style="text-align: right;">{{reference}}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Date</td><td style="text-align: right;">{{date}}</td></tr>
      </table>
      <p style="margin: 24px 0;">
        <a href="{{url:view_url}}" style="background: #d97706; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">View payment links</a>
      </p>
    `),
    smsBody:
      '{{payer_name}} paid {{currency}} {{amount}} for your payment link "{{service}}" (ref {{reference}}). ' +
      "{{support_url}}"
  }
} as const satisfies Record<string, NotificationTemplate>;

export type NotificationTemplateName = keyof typeof notificationTemplates;

export function renderNotificationTemplate(
  name: NotificationTemplateName,
  vars: NotificationTemplateVars
): { subject: string; emailBody: string; smsBody: string } {
  const template = notificationTemplates[name];
  const merged: NotificationTemplateVars = { support_url: DEFAULT_SUPPORT_URL, ...vars };

  return {
    // Only emailBody is HTML — subject is a plain mail header and smsBody is
    // plain text, neither can render markup, so escaping either would just
    // show the reader literal "&amp;" instead of "&".
    subject: renderTemplate(template.subject, merged),
    emailBody: renderTemplate(template.emailBody, merged, "html"),
    smsBody: renderTemplate(template.smsBody, merged)
  };
}
