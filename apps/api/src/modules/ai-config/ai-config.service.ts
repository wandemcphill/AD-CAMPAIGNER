import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import {
  AI_MODEL_PROVIDERS,
  type AiConfigDto,
  type AiModelProvider,
  type UpdateAiConfigDto
} from "./ai-config.dtos";

const DEFAULT_ENDPOINTS: Record<string, string> = {
  OpenAI: "https://api.openai.com/v1",
  Gemini: "https://generativelanguage.googleapis.com/v1beta"
};

function isAiModelProvider(value: string): value is AiModelProvider {
  return (AI_MODEL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * `AiConfig.modelProvider` is a plain string column, so a row can hold a value
 * this build no longer recognises (a provider removed from AI_MODEL_PROVIDERS,
 * or a row written by an older deploy). Narrow at the read boundary and fall
 * back to the default rather than asserting the column into the union.
 */
function toAiModelProvider(value: string): AiModelProvider {
  return isAiModelProvider(value) ? value : "OpenAI";
}

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

function defaults(): AiConfigDto {
  return {
    modelProvider: "OpenAI",
    apiEndpoint: DEFAULT_ENDPOINTS["OpenAI"] ?? "https://api.openai.com/v1",
    systemPromptOverride:
      "You are an expert ad copywriter. Generate engaging, high-converting ad copy for ...",
    updatedAt: null
  };
}

@Injectable()
export class AiConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async get(context?: AuthenticatedRequestContext): Promise<AiConfigDto> {
    const scope = requireScope(context);

    const record = await this.db.aiConfig.findUnique({
      where: { workspaceId: scope.workspaceId }
    });

    if (!record) {
      return defaults();
    }

    return {
      modelProvider: toAiModelProvider(record.modelProvider),
      apiEndpoint: record.apiEndpoint,
      systemPromptOverride: record.systemPromptOverride,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  async update(input: UpdateAiConfigDto, context?: AuthenticatedRequestContext): Promise<AiConfigDto> {
    const scope = requireScope(context);

    const provider = input.modelProvider?.trim();
    if (!provider || !isAiModelProvider(provider)) {
      throw new BadRequestException("A valid model provider is required.");
    }

    const endpoint = input.apiEndpoint?.trim();
    if (!endpoint) {
      throw new BadRequestException("An API endpoint is required.");
    }
    try {
      // Constructed purely for its validation side effect.
      new URL(endpoint);
    } catch {
      throw new BadRequestException("The API endpoint must be a valid URL.");
    }

    const systemPromptOverride = input.systemPromptOverride?.trim() ?? "";

    const record = await this.db.aiConfig.upsert({
      where: { workspaceId: scope.workspaceId },
      update: {
        modelProvider: provider,
        apiEndpoint: endpoint,
        systemPromptOverride,
        updatedByUserId: scope.userId
      },
      create: {
        workspaceId: scope.workspaceId,
        modelProvider: provider,
        apiEndpoint: endpoint,
        systemPromptOverride,
        updatedByUserId: scope.userId
      }
    });

    return {
      modelProvider: toAiModelProvider(record.modelProvider),
      apiEndpoint: record.apiEndpoint,
      systemPromptOverride: record.systemPromptOverride,
      updatedAt: record.updatedAt.toISOString()
    };
  }
}
