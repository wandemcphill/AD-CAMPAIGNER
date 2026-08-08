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
  [key: string]: string | undefined;
}

const DEFAULT_SUPPORT_URL = "https://fliptrybe.com/support";

export function renderTemplate(template: string, vars: NotificationTemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
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
    Need help? Visit <a href="{{support_url}}">{{support_url}}</a>.
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
    subject: renderTemplate(template.subject, merged),
    emailBody: renderTemplate(template.emailBody, merged),
    smsBody: renderTemplate(template.smsBody, merged)
  };
}
