export const AI_MODEL_PROVIDERS = ["OpenAI", "Gemini"] as const;
export type AiModelProvider = (typeof AI_MODEL_PROVIDERS)[number];

export interface AiConfigDto {
  modelProvider: AiModelProvider;
  apiEndpoint: string;
  systemPromptOverride: string;
  updatedAt: string | null;
}

export interface UpdateAiConfigDto {
  modelProvider: string;
  apiEndpoint: string;
  systemPromptOverride?: string;
}
