import { describe, expect, it, vi } from "vitest";

import { AnthropicRecommendationClient } from "./index";

const baseRequest = {
  goal: "SALES",
  budgetMinor: 2_500_000,
  currency: "NGN",
  productDescription: "I sell fairly used phones in Lagos",
  city: "Lagos"
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}

describe("AnthropicRecommendationClient.fromEnv", () => {
  it("stays disabled unless an API key is present and AI_PROVIDER selects anthropic", () => {
    expect(AnthropicRecommendationClient.fromEnv({}).enabled).toBe(false);
    expect(
      AnthropicRecommendationClient.fromEnv({ ANTHROPIC_API_KEY: "sk-test" }).enabled
    ).toBe(false);
    expect(
      AnthropicRecommendationClient.fromEnv({ AI_PROVIDER: "anthropic" }).enabled
    ).toBe(false);
    expect(
      AnthropicRecommendationClient.fromEnv({
        ANTHROPIC_API_KEY: "sk-test",
        AI_PROVIDER: "anthropic"
      }).enabled
    ).toBe(true);
  });
});

describe("AnthropicRecommendationClient.suggestTargeting", () => {
  it("returns null without calling the network while disabled", async () => {
    const fetcher = vi.fn();
    const client = new AnthropicRecommendationClient(
      { enabled: false, apiKey: "", model: "m", baseUrl: "https://api.test", timeoutMs: 100, maxRetries: 0 },
      fetcher
    );

    const result = await client.suggestTargeting(baseRequest);

    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("parses a well-formed model response into targeting options", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              {
                label: "Broad reach",
                rationale: "Let the platform find buyers automatically.",
                ageMin: 18,
                ageMax: 45,
                gender: "ALL",
                interests: ["online shopping"],
                behaviors: ["engaged shoppers"]
              }
            ])
          }
        ]
      })
    );
    const client = new AnthropicRecommendationClient(
      { enabled: true, apiKey: "sk-test", model: "m", baseUrl: "https://api.test", timeoutMs: 1000, maxRetries: 0 },
      fetcher
    );

    const result = await client.suggestTargeting(baseRequest);

    expect(result?.provider).toBe("ANTHROPIC");
    expect(result?.options).toHaveLength(1);
    expect(result?.options[0]).toMatchObject({ label: "Broad reach", gender: "ALL", ageMin: 18, ageMax: 45 });
  });

  it("returns null when the model response is not parseable JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: "text", text: "sorry, I can't help with that" }] })
    );
    const client = new AnthropicRecommendationClient(
      { enabled: true, apiKey: "sk-test", model: "m", baseUrl: "https://api.test", timeoutMs: 1000, maxRetries: 0 },
      fetcher
    );

    expect(await client.suggestTargeting(baseRequest)).toBeNull();
  });

  it("returns null after exhausting retries on a non-ok response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const client = new AnthropicRecommendationClient(
      { enabled: true, apiKey: "sk-test", model: "m", baseUrl: "https://api.test", timeoutMs: 1000, maxRetries: 2 },
      fetcher
    );

    const result = await client.suggestTargeting(baseRequest);

    expect(result).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("returns null on a network error rather than throwing", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const client = new AnthropicRecommendationClient(
      { enabled: true, apiKey: "sk-test", model: "m", baseUrl: "https://api.test", timeoutMs: 1000, maxRetries: 0 },
      fetcher
    );

    await expect(client.suggestTargeting(baseRequest)).resolves.toBeNull();
  });

  it("clamps out-of-range ages and drops options missing a label or rationale", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { label: "", rationale: "no label" },
              { label: "Out of range", rationale: "ages get clamped", ageMin: 5, ageMax: 200 }
            ])
          }
        ]
      })
    );
    const client = new AnthropicRecommendationClient(
      { enabled: true, apiKey: "sk-test", model: "m", baseUrl: "https://api.test", timeoutMs: 1000, maxRetries: 0 },
      fetcher
    );

    const result = await client.suggestTargeting(baseRequest);

    expect(result?.options).toHaveLength(1);
    expect(result?.options[0]).toMatchObject({ ageMin: 13, ageMax: 65 });
  });
});
