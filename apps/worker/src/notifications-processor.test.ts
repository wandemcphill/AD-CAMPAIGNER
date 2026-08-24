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

vi.mock("@fliptrybe/providers", () => ({
  createTermiiEmailAdapter: () => ({ name: "termii", isConfigured: isConfiguredMock, send: sendMock }),
  createTermiiSmsAdapter: () => ({ name: "termii", isConfigured: isConfiguredMock, send: sendMock }),
  createTermiiWhatsappAdapter: () => ({ name: "termii", isConfigured: isConfiguredMock, send: sendMock }),
  createMockNotificationProvider: () => ({
    name: "mock",
    isConfigured: () => true,
    send: () => Promise.resolve({ id: "mock_1", accepted: true })
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

describe("processNotificationDispatchJob", () => {
  beforeEach(() => {
    vi.resetModules();
    notificationDeliveryAttemptCreate.mockClear();
    notificationUpdate.mockClear();
    notificationFindUnique.mockReset();
    sendMock.mockReset();
    isConfiguredMock.mockReset();
    isConfiguredMock.mockReturnValue(true);
    process.env.NODE_ENV = "test";
    process.env.NOTIFICATION_PROVIDER = "termii";
    process.env.TERMII_API_KEY = "test-key";
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_FROM;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.NOTIFICATION_PROVIDER;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.TERMII_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_FROM;
    vi.unstubAllGlobals();
  });

  it("sends SMS successfully and marks the notification SENT", async () => {
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_sms",
      title: "OTP",
      body: "123456",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: "+2348011112222" }
    });
    sendMock.mockResolvedValue({ id: "msg_1", accepted: true, providerStatus: "sent" });

    const result = await processNotificationDispatchJob(fakeJob("SMS"));

    expect(result.outcome).toBe("sent");
    expect(notificationUpdate).toHaveBeenCalledTimes(1);
    expect(lastCallData(notificationUpdate)).toMatchObject({ status: "SENT" });
  });

  it("uses Resend for email while keeping Termii available for SMS", async () => {
    process.env.NOTIFICATION_PROVIDER = "live";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "FlipTrybe <noreply@example.com>";

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: "re_msg_1" } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "payment_success#order_123",
      title: "Payment successful",
      body: "<p>Paid</p>",
      guestEmail: "guest@example.com",
      guestPhone: null,
      recipient: null
    });

    const result = await processNotificationDispatchJob(fakeJob("EMAIL"));

    expect(result.outcome).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit).toBeDefined();
    const headers = requestInit?.headers;
    expect((headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "payment_success#order_123:EMAIL"
    );
    expect(JSON.parse(String(requestInit?.body ?? ""))).toMatchObject({
      from: "FlipTrybe <noreply@example.com>",
      to: ["guest@example.com"],
      subject: "Payment successful",
      html: "<p>Paid</p>"
    });
    expect(lastCallData(notificationUpdate)).toMatchObject({
      status: "SENT",
      provider: "resend",
      providerMessageId: "re_msg_1"
    });
  });

  it("fails closed instead of using a mock provider in production when live credentials are missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.NOTIFICATION_PROVIDER = "live";
    delete process.env.TERMII_API_KEY;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_prod_missing_provider",
      title: "Update",
      body: "text",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: "+2348011112222" }
    });

    const result = await processNotificationDispatchJob(fakeJob("SMS"));

    expect(result.outcome).toBe("pending:provider_not_configured");
    expect(notificationDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
    expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({
      status: "PENDING_CONFIGURATION"
    });
    expect(lastCallData(notificationDeliveryAttemptCreate).provider).toBe("live");
  });

  it("marks a delivery attempt FAILED when the provider rejects the send but does not mark the Notification FAILED before retries are exhausted", async () => {
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_email",
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
      idempotencyKey: "evt_email_final",
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

  it("records PENDING_CONFIGURATION instead of a fabricated success when the provider is not configured", async () => {
    isConfiguredMock.mockReturnValue(false);
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_wa_pending",
      title: "Update",
      body: "text",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: "+2348011112222" }
    });

    const result = await processNotificationDispatchJob(fakeJob("WHATSAPP"));

    expect(result.outcome).toBe("pending:provider_not_configured");
    expect(sendMock).not.toHaveBeenCalled();
    expect(notificationDeliveryAttemptCreate).toHaveBeenCalledTimes(1);
    expect(lastCallData(notificationDeliveryAttemptCreate)).toMatchObject({ status: "PENDING_CONFIGURATION" });
    expect(notificationUpdate).not.toHaveBeenCalled();
  });

  it("marks the notification FAILED with no_destination when the recipient has no email/phone on file", async () => {
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_no_destination",
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

  it("propagates a provider timeout as a rejection so BullMQ retries the job", async () => {
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
      idempotencyKey: "evt_sms_timeout",
      title: "OTP",
      body: "123456",
      guestPhone: null,
      guestEmail: null,
      recipient: { email: null, phone: "+2348011112222" }
    });
    sendMock.mockRejectedValue(new Error("network timeout"));

    await expect(processNotificationDispatchJob(fakeJob("SMS", 0, 6))).rejects.toThrow("network timeout");
  });
});
