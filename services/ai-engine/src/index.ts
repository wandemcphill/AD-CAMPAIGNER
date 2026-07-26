export const aiEngineService = {
  name: "ai-engine",
  responsibilities: ["captions", "hashtags", "ad copy", "audience suggestions", "campaign suggestions"]
} as const;

// ---------------------------------------------------------------------------
// Real AI provider (Anthropic Claude), following the pattern already verified working in
// RUNNR's ai/anthropic.service.ts (see the runnr-ai-orchestrator-reference memory):
//   - bounded timeout + explicit retries, never left to SDK/fetch defaults
//   - graceful null-on-failure -- caller always falls back to the existing rule-based heuristic
//     (recommendCampaignTargeting in @fliptrybe/service-campaigns), never throws
//   - every call tagged so the caller/analytics know which path actually served the response
//
// Uses raw fetch against Anthropic's Messages API directly (same style as this repo's existing
// ai-brain.client.ts) rather than adding the @anthropic-ai/sdk dependency -- one fewer package,
// same guarantees, and this is a single JSON-in/JSON-out call, not a full agent loop.
// ---------------------------------------------------------------------------

export interface AnthropicProviderConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

/** Mirrors CampaignSpecTargeting's shape in @fliptrybe/service-campaigns without importing it,
 *  so this package stays a leaf dependency (campaigns/api depend on ai-engine, not vice versa). */
export interface AiTargetingOption {
  label: string;
  rationale: string;
  ageMin: number;
  ageMax: number;
  gender: "MALE" | "FEMALE" | "ALL";
  interests: string[];
  behaviors: string[];
}

export interface AiTargetingRequest {
  goal: string;
  budgetMinor: number;
  currency: string;
  productDescription: string;
  city?: string;
}

export interface AiTargetingResult {
  provider: "ANTHROPIC";
  options: AiTargetingOption[];
  /** Raw model text kept for audit/debugging; not shown to the customer. */
  rawModelText: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

function readTimeoutMs(value: string | undefined, fallbackSeconds: number) {
  const seconds = Number.parseFloat((value ?? "").trim());
  const clamped = Number.isFinite(seconds) ? Math.min(45, Math.max(1, seconds)) : fallbackSeconds;
  return Math.round(clamped * 1000);
}

const SYSTEM_PROMPT = `You are FlipTrybe's ad-targeting assistant. Given a Nigerian small business's product/service description, goal, and budget, propose 2-3 distinct Meta/Instagram audience-targeting options (a broad option, a focused option, and optionally a hyper-local option).

Respond with ONLY a JSON array (no prose, no markdown fences) of objects shaped exactly like:
[{"label": string, "rationale": string (one sentence, plain language, no jargon), "ageMin": number, "ageMax": number, "gender": "MALE"|"FEMALE"|"ALL", "interests": string[], "behaviors": string[]}]`;

export class AnthropicRecommendationClient {
  constructor(
    private readonly config: AnthropicProviderConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  static fromEnv(source: NodeJS.ProcessEnv = process.env) {
    const apiKey = (source.ANTHROPIC_API_KEY ?? "").trim();
    const providerFlag = (source.AI_PROVIDER ?? "").trim().toLowerCase();

    return new AnthropicRecommendationClient({
      enabled: apiKey.length > 0 && (providerFlag === "anthropic" || providerFlag === "claude"),
      apiKey,
      model: (source.ANTHROPIC_MODEL ?? "").trim() || DEFAULT_MODEL,
      baseUrl: (source.ANTHROPIC_BASE_URL ?? "").trim().replace(/\/+$/, "") || DEFAULT_BASE_URL,
      timeoutMs: readTimeoutMs(source.ANTHROPIC_TIMEOUT_SECONDS, 20),
      maxRetries: Number.isFinite(Number(source.ANTHROPIC_MAX_RETRIES))
        ? Math.min(3, Math.max(0, Number(source.ANTHROPIC_MAX_RETRIES)))
        : 2
    });
  }

  get enabled() {
    return this.config.enabled;
  }

  /** Never throws. Returns null on disabled/timeout/network/parse failure -- caller always has a
   *  working heuristic fallback (recommendCampaignTargeting), matching RUNNR's proven pattern. */
  async suggestTargeting(request: AiTargetingRequest): Promise<AiTargetingResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const userMessage = [
      `Goal: ${request.goal}`,
      `Budget: ${(request.budgetMinor / 100).toLocaleString()} ${request.currency}`,
      `Product/business: ${request.productDescription}`,
      request.city ? `Primary city: ${request.city}` : undefined
    ]
      .filter(Boolean)
      .join("\n");

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetcher(`${this.config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": ANTHROPIC_VERSION
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }]
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          continue;
        }

        const body = (await response.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text = body.content?.find((block) => block.type === "text")?.text?.trim();
        const options = text ? parseTargetingOptions(text) : null;

        if (options && options.length > 0) {
          return { provider: "ANTHROPIC", options, rawModelText: text ?? "" };
        }
      } catch {
        // network error, abort/timeout, or malformed response -- fall through and retry/return null
      } finally {
        clearTimeout(timeout);
      }
    }

    return null;
  }
}

function parseTargetingOptions(text: string): AiTargetingOption[] | null {
  const jsonSlice = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);

  try {
    const parsed = JSON.parse(jsonSlice) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    const options = parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => normalizeOption(item))
      .filter((option): option is AiTargetingOption => option !== null);

    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

function normalizeOption(item: Record<string, unknown>): AiTargetingOption | null {
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const rationale = typeof item.rationale === "string" ? item.rationale.trim() : "";

  if (!label || !rationale) {
    return null;
  }

  const ageMin = clamp(Number(item.ageMin) || 18, 13, 65);
  const ageMax = clamp(Number(item.ageMax) || 65, 13, 65);
  const genderRaw = typeof item.gender === "string" ? item.gender.toUpperCase() : "ALL";
  const gender = genderRaw === "MALE" || genderRaw === "FEMALE" ? genderRaw : "ALL";

  return {
    label,
    rationale,
    ageMin: Math.min(ageMin, ageMax),
    ageMax: Math.max(ageMin, ageMax),
    gender,
    interests: toStringArray(item.interests),
    behaviors: toStringArray(item.behaviors)
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
