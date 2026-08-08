import { describe, expect, it, vi } from "vitest";

import {
  createTermiiEmailAdapter,
  createTermiiSmsAdapter,
  createTermiiWhatsappAdapter
} from "./notifications.js";
import { createMockNotificationProvider } from "./index.js";

function fetcherReturning(response: unknown, status = 200) {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(response), { status })
    )
  ) as unknown as typeof fetch;
}

function parseRequestBody(fetcher: typeof fetch): Record<string, unknown> {
  const [, options] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
  return JSON.parse(options.body as string) as Record<string, unknown>;
}

describe("createTermiiSmsAdapter", () => {
  it("isConfigured is false without an apiKey/senderId", () => {
    const adapter = createTermiiSmsAdapter({ apiKey: "", smsSenderId: "" });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("isConfigured is true with both apiKey and senderId", () => {
    const adapter = createTermiiSmsAdapter({ apiKey: "key", smsSenderId: "FLIPTRYBE" });
    expect(adapter.isConfigured()).toBe(true);
  });

  it("sends a plain-channel SMS and returns the provider message id", async () => {
    const fetcher = fetcherReturning({ message_id: "msg_123", message: "Successfully Sent" });
    const adapter = createTermiiSmsAdapter({
      apiKey: "key",
      smsSenderId: "FLIPTRYBE",
      fetcher
    });

    const result = await adapter.send({
      channel: "SMS",
      to: "+2348011112222",
      title: "OTP",
      body: "123456 is your code"
    });

    expect(result.accepted).toBe(true);
    expect(result.id).toBe("msg_123");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.ng.termii.com/api/sms/send",
      expect.objectContaining({ method: "POST" })
    );
    const body = parseRequestBody(fetcher);
    expect(body).toMatchObject({
      to: "+2348011112222",
      from: "FLIPTRYBE",
      sms: "123456 is your code",
      type: "plain",
      channel: "generic",
      api_key: "key"
    });
  });

  it("throws on a non-ok HTTP response instead of reporting a fabricated success", async () => {
    const fetcher = fetcherReturning({ message: "Invalid API key" }, 401);
    const adapter = createTermiiSmsAdapter({ apiKey: "bad-key", smsSenderId: "FLIPTRYBE", fetcher });

    await expect(
      adapter.send({ channel: "SMS", to: "+2348011112222", title: "OTP", body: "code" })
    ).rejects.toThrow(/Termii SMS send failed/);
  });

  it("propagates a network-level failure (e.g. timeout) as a rejected promise", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("network timeout"))) as unknown as typeof fetch;
    const adapter = createTermiiSmsAdapter({ apiKey: "key", smsSenderId: "FLIPTRYBE", fetcher });

    await expect(
      adapter.send({ channel: "SMS", to: "+2348011112222", title: "OTP", body: "code" })
    ).rejects.toThrow("network timeout");
  });
});

describe("createTermiiEmailAdapter", () => {
  it("isConfigured is false without an emailConfigurationId", () => {
    const adapter = createTermiiEmailAdapter({ apiKey: "key" });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("sends the rendered content as `code` alongside the configured email_configuration_id", async () => {
    const fetcher = fetcherReturning({ message_id: "email_123", message: "Successful" });
    const adapter = createTermiiEmailAdapter({
      apiKey: "key",
      emailConfigurationId: "cfg_abc",
      fetcher
    });

    const result = await adapter.send({
      channel: "EMAIL",
      to: "guest@example.com",
      title: "Receipt",
      body: "<p>Your order is complete</p>"
    });

    expect(result.accepted).toBe(true);
    expect(result.id).toBe("email_123");
    const body = parseRequestBody(fetcher);
    expect(body).toMatchObject({
      email_address: "guest@example.com",
      email_configuration_id: "cfg_abc",
      subject: "Receipt",
      code: "<p>Your order is complete</p>"
    });
  });

  it("fails clearly rather than sending when emailConfigurationId is missing", async () => {
    const adapter = createTermiiEmailAdapter({ apiKey: "key" });

    await expect(
      adapter.send({ channel: "EMAIL", to: "guest@example.com", title: "Receipt", body: "body" })
    ).rejects.toThrow(/not configured/);
  });

  it("throws on a non-ok HTTP response", async () => {
    const fetcher = fetcherReturning({ message: "Configuration not found" }, 404);
    const adapter = createTermiiEmailAdapter({ apiKey: "key", emailConfigurationId: "cfg_abc", fetcher });

    await expect(
      adapter.send({ channel: "EMAIL", to: "guest@example.com", title: "Receipt", body: "body" })
    ).rejects.toThrow(/Termii Email send failed/);
  });
});

describe("createTermiiWhatsappAdapter", () => {
  it("isConfigured is false without a whatsappConfigurationId", () => {
    const adapter = createTermiiWhatsappAdapter({ apiKey: "key" });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("sends through the same endpoint with channel=whatsapp", async () => {
    const fetcher = fetcherReturning({ message_id: "wa_123", message: "Sent" });
    const adapter = createTermiiWhatsappAdapter({
      apiKey: "key",
      whatsappConfigurationId: "wa_cfg_1",
      fetcher
    });

    await adapter.send({ channel: "WHATSAPP", to: "+2348011112222", title: "Update", body: "text" });

    const body = parseRequestBody(fetcher);
    expect(body.channel).toBe("whatsapp");
  });
});

describe("createMockNotificationProvider", () => {
  it("is always configured and always accepts", async () => {
    const adapter = createMockNotificationProvider();
    expect(adapter.isConfigured()).toBe(true);
    const result = await adapter.send({ channel: "EMAIL", to: "x@example.com", title: "t", body: "b" });
    expect(result.accepted).toBe(true);
  });
});
