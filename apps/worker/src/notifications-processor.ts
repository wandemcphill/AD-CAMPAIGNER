
function createUnavailableProductionProvider(name: string): NotificationProviderAdapter {
  return {
    name,
    isConfigured: () => false,
    async send() {
      throw new Error(`${name} notification provider is not configured for production.`);
    }
  };
}

// EMAIL_PROVIDER can override only the email transport, allowing Resend to
// coexist with Termii for SMS/WhatsApp. When omitted, email keeps following
// NOTIFICATION_PROVIDER for backwards compatibility.
function adapterForChannel(
  channel: "EMAIL" | "SMS" | "WHATSAPP",
  idempotencyKey: string
): NotificationProviderAdapter {
  const provider = (
    channel === "EMAIL"
      ? process.env.EMAIL_PROVIDER ?? process.env.NOTIFICATION_PROVIDER
      : process.env.NOTIFICATION_PROVIDER
  )?.trim().toLowerCase();

  if (channel === "EMAIL" && (provider === "resend" || provider === "live")) {
    // "live" is retained as a backwards-compatible production value, but the
    // actual email transport remains Resend when its credentials are present.
    const resendConfig = {
      ...(process.env.RESEND_API_KEY ? { apiKey: process.env.RESEND_API_KEY } : {}),
      ...(process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM
        ? { from: process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM }
        : {})
    };
    return createResendEmailAdapter(resendConfig, idempotencyKey);
  }

  const useTermii = (provider === "termii" || provider === "live") && Boolean(process.env.TERMII_API_KEY);

  if (!useTermii) {
    if ((process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
      return createUnavailableProductionProvider(provider || "notification");
    }
    return createMockNotificationProvider();
  }

  const termiiConfig = {
    apiKey: process.env.TERMII_API_KEY!,
    ...(process.env.TERMII_BASE_URL ? { baseUrl: process.env.TERMII_BASE_URL } : {}),
    ...(process.env.TERMII_SMS_SENDER_ID ? { smsSenderId: process.env.TERMII_SMS_SENDER_ID } : {}),
    ...(process.env.TERMII_EMAIL_CONFIGURATION_ID
      ? { emailConfigurationId: process.env.TERMII_EMAIL_CONFIGURATION_ID }
      : {}),
    ...(process.env.TERMII_WHATSAPP_CONFIGURATION_ID
      ? { whatsappConfigurationId: process.env.TERMII_WHATSAPP_CONFIGURATION_ID }
      : {})
  };
