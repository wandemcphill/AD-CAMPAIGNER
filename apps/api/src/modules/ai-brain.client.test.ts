import { describe, expect, it, vi } from "vitest";

import { createEvent } from "@fliptrybe/events";
import type { Campaign } from "@fliptrybe/types";

import { AiBrainClient, toCanonicalEvent } from "./ai-brain.client";

const campaign: Campaign = {
  id: "cmp_test",
  workspaceId: "workspace_test",
  creatorUserId: "user_test",
  name: "AI Brain test campaign",
  objective: "TRAFFIC",
  status: "QUEUED",
  budget: { amountMinor: 120000, currency: "NGN" },
  destination: { kind: "WEBSITE", url: "https://fliptrybe.com" },
  schedule: { startsAt: "2026-05-22T12:00:00.000Z", timezone: "Africa/Lagos" },
  provider: "MOCK",
  providerReference: "mock_ads_test",
  createdAt: "2026-05-22T12:00:00.000Z",
  updatedAt: "2026-05-22T12:00:00.000Z"
};

const campaignEvent = createEvent({
  name: "CampaignCreated",
  tenantId: "workspace_test",
  payload: { campaign }
});

describe("AiBrainClient", () => {
  it("stays disabled unless env, URL, and API key are all configured", () => {
    expect(
      AiBrainClient.fromEnv({
        AI_BRAIN_ENABLED: "true",
        AI_BRAIN_BASE_URL: "https://brain.fliptrybe.test"
      }).enabled
    ).toBe(false);
    expect(
      AiBrainClient.fromEnv({
        AI_BRAIN_ENABLED: "true",
        AI_BRAIN_BASE_URL: "https://brain.fliptrybe.test",
        AI_BRAIN_API_KEY: "test-key"
      }).enabled
    ).toBe(true);
  });

  it("normalizes platform events into canonical AI Brain events", () => {
    const canonical = toCanonicalEvent(campaignEvent);

    expect(canonical?.app).toBe("ads_campaigner");
    expect(canonical?.actor_id).toBe("user_test");
    expect(canonical?.event).toBe("campaign_created");
    expect(canonical?.entity_id).toBe("cmp_test");
    expect(canonical?.idempotency_key).toBe(`ads_campaigner:event:${campaignEvent.id}`);
  });

  it("does not call AI Brain while disabled", async () => {
    const { calls, fetcher } = createRecordingFetcher(new Response(null, { status: 204 }));
    const client = new AiBrainClient(
      { enabled: false, baseUrl: "", apiKey: "", timeoutMs: 100 },
      fetcher
    );

    await expect(client.trackPlatformEvent(campaignEvent)).resolves.toBe(false);
    await expect(client.getAdsInsights({ account_id: "workspace_test" })).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("sends events and insights with API key headers when enabled", async () => {
    const { calls, fetcher } = createRecordingFetcher(
      new Response(
        JSON.stringify({
          summary: { mode: "ai_brain" },
          items: [],
          trace_id: "trace_test"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = new AiBrainClient(
      {
        enabled: true,
        baseUrl: "https://brain.fliptrybe.test",
        apiKey: "test-key",
        timeoutMs: 500
      },
      fetcher
    );

    await expect(client.trackPlatformEvent(campaignEvent, "trace_event")).resolves.toBe(true);
    await expect(
      client.getAdsInsights({ account_id: "workspace_test" }, "trace_insights")
    ).resolves.toEqual({
      summary: { mode: "ai_brain" },
      items: [],
      trace_id: "trace_test"
    });

    expect(calls[0]?.input).toBe("https://brain.fliptrybe.test/events");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({
      "x-api-key": "test-key",
      "x-trace-id": "trace_event"
    });
    expect(calls[1]?.input).toBe("https://brain.fliptrybe.test/ai/ads_campaigner/ads/insights");
    expect(calls[1]?.init.method).toBe("POST");
    expect(calls[1]?.init.headers).toMatchObject({
      "x-api-key": "test-key",
      "x-trace-id": "trace_insights"
    });
  });

  it("fails closed when AI Brain is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    const client = new AiBrainClient(
      {
        enabled: true,
        baseUrl: "https://brain.fliptrybe.test",
        apiKey: "test-key",
        timeoutMs: 100
      },
      fetcher
    );

    await expect(client.trackPlatformEvent(campaignEvent)).resolves.toBe(false);
    await expect(client.getAdsInsights({ account_id: "workspace_test" })).resolves.toBeNull();
  });
});

function createRecordingFetcher(response: Response) {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = (input, init) => {
    calls.push({
      input: inputToString(input),
      init: init ?? {}
    });

    return Promise.resolve(response.clone());
  };

  return { calls, fetcher };
}

function inputToString(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
