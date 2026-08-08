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
    process.env.NOTIFICATION_PROVIDER = "termii";
    process.env.TERMII_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_PROVIDER;
    delete process.env.TERMII_API_KEY;
  });

  it("sends SMS successfully and marks the notification SENT", async () => {
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
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

  it("marks a delivery attempt FAILED when the provider rejects the send but does not mark the Notification FAILED before retries are exhausted", async () => {
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

  it("records PENDING_CONFIGURATION instead of a fabricated success when the provider is not configured", async () => {
    isConfiguredMock.mockReturnValue(false);
    const { processNotificationDispatchJob } = await import("./notifications-processor");
    notificationFindUnique.mockResolvedValue({
      id: "ntf_1",
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
