"use client";

import { apiRequest } from "../lib/api-client";

export type ApiKeyEnvironment = "TEST" | "PRODUCTION";

export type ApiKeyRecord = {
  id: string;
  name: string;
  environment: ApiKeyEnvironment;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedApiKey = {
  id: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  createdAt: string;
  key: string;
};

export const API_KEY_SCOPES = [
  "campaigns",
  "products",
  "orders",
  "rewards",
  "wallet",
  "analytics",
  "webhooks"
];

export async function loadApiKeys() {
  return apiRequest<ApiKeyRecord[]>("/developer/api-keys");
}

export async function createApiKey(input: { name: string; environment: ApiKeyEnvironment; scopes: string[] }) {
  return apiRequest<CreatedApiKey>("/developer/api-keys", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function revokeApiKey(id: string) {
  return apiRequest<{ ok: boolean }>(`/developer/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

// AI configuration

export type AiModelProvider = "OpenAI" | "Gemini";

export type AiConfig = {
  modelProvider: AiModelProvider;
  apiEndpoint: string;
  systemPromptOverride: string;
  updatedAt: string | null;
};

export async function loadAiConfig() {
  return apiRequest<AiConfig>("/ai-config");
}

export async function updateAiConfig(input: {
  modelProvider: AiModelProvider;
  apiEndpoint: string;
  systemPromptOverride: string;
}) {
  return apiRequest<AiConfig>("/ai-config", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

// Outgoing webhooks

export type OutgoingWebhookSubscription = {
  id: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  signingSecretPreview: string;
};

export type CreatedWebhookSubscription = {
  id: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  signingSecret: string;
};

export type WebhookDelivery = {
  id: string;
  eventName: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  lastAttemptAt: string | null;
  createdAt: string;
};

export async function loadSupportedWebhookEvents() {
  const result = await apiRequest<{ events: string[] }>("/developer/webhooks/events");
  return result.events;
}

export async function loadWebhookSubscriptions() {
  return apiRequest<OutgoingWebhookSubscription[]>("/developer/webhooks");
}

export async function createWebhookSubscription(input: { targetUrl: string; events: string[] }) {
  return apiRequest<CreatedWebhookSubscription>("/developer/webhooks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function revokeWebhookSubscription(id: string) {
  return apiRequest<{ ok: boolean }>(`/developer/webhooks/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function loadWebhookDeliveries(id: string) {
  return apiRequest<WebhookDelivery[]>(`/developer/webhooks/${encodeURIComponent(id)}/deliveries`);
}

// Providers (admin)

export type ProviderConfigurationState = "configured" | "not_configured" | "bootstrap_fallback";

export type ProviderRow = {
  name: string;
  status: string;
  latencyMs: number | null;
  successRateBps: number | null;
  lastCheckedAt: string | null;
  reason: string | null;
  services: string[];
  configurationState: ProviderConfigurationState;
};

export type ProviderCategory = {
  key: string;
  label: string;
  providers: ProviderRow[];
  configurationState?: ProviderConfigurationState;
  note?: string;
};

export async function loadProvidersOverview() {
  return apiRequest<{ categories: ProviderCategory[] }>("/admin/providers");
}
