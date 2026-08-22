import type { Job } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notificationDeliveryAttemptCreate = vi.fn<
  (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(() => Promise.resolve({}));
const notificationUpdate = vi.fn<
  (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(() => Promise.resolve({}));
const notificationFindUnique = vi.fn();

vi.mock("@fliptrybe/database", () => ({
  createPrismaClient: () => ({
    notification: {
      findUnique: notificationFindUnique,
      update: notificationUpdate
    },
    notificationDeliveryAttempt: {
      create: notificationDeliveryAttemptCreate
    }
  })
}));

const sendMock = vi.fn();
const isConfiguredMock = vi.fn(() => true);
const mockProviderSendMock = vi.fn(() => Promise.resolve({ id: "mock_1", accepted: true }));

vi.mock("@fliptrybe/providers", () => ({
  createTermiiEmailAdapter: () => ({ name: "termii-email", isConfigured: isConfiguredMock, send: sendMock }),
  createTermiiSmsAdapter: () => ({ name: "termii-sms", isConfigured: isConfiguredMock, send: sendMock }),
  createTermiiWhatsappAdapter: () => ({
    name: "termii-whatsapp",
    isConfigured: isConfiguredMock,
    send: sendMock
  }),
  createMockNotificationProvider: () => ({
    name: "mock",
    isConfigured: () => true,
    send: mockProviderSendMock
  })
}));

function fakeJob(channel: "EMAIL" | "SMS" | "WHATSAPP", attemptsMade = 0, attempts = 6): Job<never> {
  return {
    data: { notificationId: "ntf_1", channel },
    attemptsMade,
    opts: { attempts }
  } as unknown as Job<never>;
}

function lastCallData(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const calls = mock.mock.calls;
  const [args] = calls[calls.length - 1] as [{ data: Record<string, unknown> }];
  return args.data;
}

const ENV_KEYS = [
  "NOTIFICATION_PROVIDER",
  "TERMII_API_KEY",
  "NODE_ENV",
  "ALLOW_MOCK_PROVIDERS"
] as const;

function clearNotificationEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("processNotificationDispatchJob", () => {
  beforeEach(() => {
    vi.resetModules();
    notificationDeliveryAttemptCreate.mockClear();
    notificationUpdate.mockClear();
    notificationFindUnique.mockReset();
    sendMock.mockReset();
    mockProviderSendMock.mockClear();
    isConfiguredMock.mockReset();
    isConfiguredMock.mockReturnValue(true);
    clearNotificationEnv();
  });

  afterEach(() => {
    clearNotificationEnv();
  });

  function mockRecipient() {
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      title: "OTP",
      body: "123456",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: "+2348011112222" }
    });
  }

  function mockEmailRecipient() {
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      title: "Password reset",
      body: "<p>Reset your password</p>",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: "user@example.com", phone: null }
    });
  }

  describe("provider selection — NOTIFICATION_PROVIDER=live is the deployed contract", () => {
    // render.yaml sets NOTIFICATION_PROVIDER=live on both API and worker —
    // "termii" was never the value production actually uses. These tests
    // assert against the value that is really deployed, not a convenient
    // fixture value (that drift is exactly what let the fabricated-success
    // defect ship unnoticed).

    it("1. NOTIFICATION_PROVIDER=live with credentials selects the real Termii adapter", async () => {
      process.env.NOTIFICATION_PROVIDER = "live";
      process.env.TERMII_API_KEY = "test-key";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockResolvedValue({ id: "msg_1", accepted: true, providerStatus: "sent" });

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("sent");
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(mockProviderSendMock).not.toHaveBeenCalled();
      expect(lastCallData(notificationUpdate)).toMatchObject({ status: "SENT", provider: "termii-sms" });
    });

    it('2. NOTIFICATION_PROVIDER="termii" is not a valid live sentinel — falls back to mock, never selects Termii', async () => {
      // "termii" was this file's own unvalidated, out-of-band check before
      // this fix — never a value packages/config/src/index.ts's schema
      // accepted, and never a value any deployed environment set (render.yaml
      // has always used "live"). It must not select the live provider now.
      process.env.NOTIFICATION_PROVIDER = "termii";
      process.env.TERMII_API_KEY = "test-key";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("sent");
      expect(sendMock).not.toHaveBeenCalled();
      expect(mockProviderSendMock).toHaveBeenCalledTimes(1);
      expect(lastCallData(notificationUpdate)).toMatchObject({ status: "SENT", provider: "mock" });
    });

    it('production with NOTIFICATION_PROVIDER="termii" and mocks disabled produces PENDING_CONFIGURATION, not a live Termii send', async () => {
      process.env.NODE_ENV = "production";
      process.env.NOTIFICATION_PROVIDER = "termii";
      process.env.TERMII_API_KEY = "test-key";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockEmailRecipient();

      const result = await processNotificationDispatchJob(fakeJob("EMAIL"));

      expect(result.outcome).toBe("pending:provider_not_configured");
      expect(sendMock).not.toHaveBeenCalled();
      expect(mockProviderSendMock).not.toHaveBeenCalled();
      expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({
        provider: "none",
        status: "PENDING_CONFIGURATION"
      });
    });

    it("missing credentials in a non-production environment fall back to the mock, not a fabricated Termii success", async () => {
      process.env.NOTIFICATION_PROVIDER = "live";
      // No TERMII_API_KEY set — this is the local/dev/test default.
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("sent");
      expect(sendMock).not.toHaveBeenCalled();
      expect(mockProviderSendMock).toHaveBeenCalledTimes(1);
      expect(lastCallData(notificationUpdate)).toMatchObject({ status: "SENT", provider: "mock" });
    });
  });

  describe("3. production safety — the mock can never silently stand in", () => {
    it("production with no live provider configured and ALLOW_MOCK_PROVIDERS unset never selects the mock, and never fabricates SENT", async () => {
      process.env.NODE_ENV = "production";
      // NOTIFICATION_PROVIDER unset, no TERMII_API_KEY, ALLOW_MOCK_PROVIDERS unset —
      // exactly render.yaml's actual state before Termii credentials are provisioned.
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockEmailRecipient();

      const result = await processNotificationDispatchJob(fakeJob("EMAIL"));

      expect(result.outcome).toBe("pending:provider_not_configured");
      expect(sendMock).not.toHaveBeenCalled();
      expect(mockProviderSendMock).not.toHaveBeenCalled();
      expect(notificationUpdate).not.toHaveBeenCalled();
      const attempt = lastCallData(notificationDeliveryAttemptCreate);
      expect(attempt).toMatchObject({ provider: "none", status: "PENDING_CONFIGURATION" });
      expect(attempt.status).not.toBe("SENT");
    });

    it("production with NOTIFICATION_PROVIDER=live but no TERMII_API_KEY never selects the mock", async () => {
      process.env.NODE_ENV = "production";
      process.env.NOTIFICATION_PROVIDER = "live";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockEmailRecipient();

      const result = await processNotificationDispatchJob(fakeJob("EMAIL"));

      expect(result.outcome).toBe("pending:provider_not_configured");
      expect(mockProviderSendMock).not.toHaveBeenCalled();
      expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({
        provider: "none",
        status: "PENDING_CONFIGURATION"
      });
    });

    it("production with ALLOW_MOCK_PROVIDERS=true explicitly permits the mock (the documented escape hatch)", async () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_MOCK_PROVIDERS = "true";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockEmailRecipient();

      const result = await processNotificationDispatchJob(fakeJob("EMAIL"));

      expect(result.outcome).toBe("sent");
      expect(mockProviderSendMock).toHaveBeenCalledTimes(1);
      expect(lastCallData(notificationUpdate)).toMatchObject({ status: "SENT", provider: "mock" });
    });

    it("production with live Termii credentials configured uses Termii, not the mock", async () => {
      process.env.NODE_ENV = "production";
      process.env.NOTIFICATION_PROVIDER = "live";
      process.env.TERMII_API_KEY = "real-key";
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockResolvedValue({ id: "msg_prod_1", accepted: true, providerStatus: "sent" });

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("sent");
      expect(mockProviderSendMock).not.toHaveBeenCalled();
      expect(lastCallData(notificationUpdate)).toMatchObject({
        status: "SENT",
        provider: "termii-sms",
        providerMessageId: "msg_prod_1"
      });
    });
  });

  describe("4/5. delivery outcome tracks provider acceptance, never HTTP status alone", () => {
    beforeEach(() => {
      process.env.NOTIFICATION_PROVIDER = "live";
      process.env.TERMII_API_KEY = "test-key";
    });

    it("5. provider acceptance with a real provider id produces SENT with that id recorded", async () => {
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockResolvedValue({ id: "msg_real_1", accepted: true, providerStatus: "sent" });

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("sent");
      expect(lastCallData(notificationUpdate)).toMatchObject({
        status: "SENT",
        providerMessageId: "msg_real_1"
      });
    });

    it("4. a provider response reporting accepted:false produces FAILED, never SENT, and never sets deliveredAt", async () => {
      // Models packages/providers' Termii email adapter on an HTTP-200
      // response with no message_id — accepted:false, not a thrown error.
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockResolvedValue({ id: "termii_email_xyz", accepted: false, providerStatus: "no_message_id_returned" });

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("failed:not_accepted");
      const updateData = lastCallData(notificationUpdate);
      expect(updateData.status).toBe("FAILED");
      expect(updateData.deliveredAt).toBeUndefined();
      const attempt = lastCallData(notificationDeliveryAttemptCreate);
      expect(attempt.status).toBe("FAILED");
    });

    it("6/7. a malformed/empty provider response (no id, accepted:false) is recorded FAILED with no fabricated provider message id treated as proof of delivery", async () => {
      // Models the Termii email adapter's own handling of a fully empty
      // HTTP-200 body (see packages/providers/src/notifications.ts): no
      // message_id, so accepted is false and only a synthetic correlation id
      // is returned — the worker must not treat that id's mere presence as
      // acceptance.
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockResolvedValue({
        id: "termii_email_synthetic_abc123",
        accepted: false,
        providerStatus: "no_message_id_returned"
      });

      const result = await processNotificationDispatchJob(fakeJob("SMS"));

      expect(result.outcome).toBe("failed:not_accepted");
      const notificationUpdateData = lastCallData(notificationUpdate);
      expect(notificationUpdateData.status).toBe("FAILED");
      expect(notificationUpdateData.providerMessageId).toBeUndefined();
      expect(notificationUpdateData.deliveredAt).toBeUndefined();
    });

    it("marks a delivery attempt FAILED when the provider rejects the send, and does not mark the Notification FAILED before retries are exhausted", async () => {
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      notificationFindUnique.mockResolvedValue({
        id: "ntf_1",
        title: "Receipt",
        body: "Your order",
        guestEmail: "guest@example.com",
        guestPhone: null,
        recipient: null
      });
      sendMock.mockRejectedValue(new Error("Termii Email send failed: 500"));

      await expect(processNotificationDispatchJob(fakeJob("EMAIL", 0, 6))).rejects.toThrow(
        "Termii Email send failed"
      );

      expect(notificationDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
      expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({ status: "FAILED" });
      expect(notificationUpdate).not.toHaveBeenCalled();
    });

    it("marks the Notification FAILED once the final retry attempt is exhausted", async () => {
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      notificationFindUnique.mockResolvedValue({
        id: "ntf_1",
        title: "Receipt",
        body: "Your order",
        guestEmail: "guest@example.com",
        guestPhone: null,
        recipient: null
      });
      sendMock.mockRejectedValue(new Error("network timeout"));

      await expect(processNotificationDispatchJob(fakeJob("EMAIL", 5, 6))).rejects.toThrow("network timeout");

      expect(notificationUpdate).toHaveBeenCalledTimes(1);
      expect(lastCallData(notificationUpdate)).toMatchObject({ status: "FAILED", errorCode: "provider_error" });
    });

    it("propagates a provider timeout as a rejection so BullMQ retries the job", async () => {
      const { processNotificationDispatchJob } = await import("./notifications-processor");
      mockRecipient();
      sendMock.mockRejectedValue(new Error("network timeout"));

      await expect(processNotificationDispatchJob(fakeJob("SMS", 0, 6))).rejects.toThrow("network timeout");
    });
  });

  it("records PENDING_CONFIGURATION instead of a fabricated success when the adapter itself reports not configured", async () => {
    process.env.NOTIFICATION_PROVIDER = "live";
    process.env.TERMII_API_KEY = "test-key";
    isConfiguredMock.mockReturnValue(false);
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    mockRecipient();

    const result = await processNotificationDispatchJob(fakeJob("WHATSAPP"));

    expect(result.outcome).toBe("pending:provider_not_configured");
    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
    expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({ status: "PENDING_CONFIGURATION" });
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("marks the notification FAILED with no_destination when the recipient has no email/phone on file", async () => {
    process.env.NOTIFICATION_PROVIDER = "live";
    process.env.TERMII_API_KEY = "test-key";
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      title: "OTP",
      body: "123456",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: null }
    });

    const result = await processNotificationDispatchJob(fakeJob("SMS"));

    expect(result.outcome).toBe("failed:no_destination");
    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationUpdate).toHaveBeenCalledTimes(1);
    expect(lastCallData(notificationUpdate)).toMatchObject({ status: "FAILED", errorCode: "no_destination" });
  });
});
