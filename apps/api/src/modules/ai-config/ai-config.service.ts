import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { AI_MODEL_PROVIDERS, type AiConfigDto, type UpdateAiConfigDto } from "./ai-config.dtos";

const DEFAULT_ENDPOINTS: Record<string, string> = {
  OpenAI: "https://api.openai.com/v1",
  Gemini: "https://generativelanguage.googleapis.com/v1beta"
};

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

function defaults(): AiConfigDto {
  return {
    modelProvider: "OpenAI",
    apiEndpoint: DEFAULT_ENDPOINTS.OpenAI,
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
      modelProvider: record.modelProvider,
      apiEndpoint: record.apiEndpoint,
      systemPromptOverride: record.systemPromptOverride,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  async update(input: UpdateAiConfigDto, context?: AuthenticatedRequestContext): Promise<AiConfigDto> {
    const scope = requireScope(context);

    const provider = input.modelProvider?.trim();
    if (!provider || !AI_MODEL_PROVIDERS.includes(provider as (typeof AI_MODEL_PROVIDERS)[number])) {
      throw new BadRequestException("A valid model provider is required.");
    }

    const endpoint = input.apiEndpoint?.trim();
    if (!endpoint) {
      throw new BadRequestException("An API endpoint is required.");
    }
    try {
      // eslint-disable-next-line no-new
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
      modelProvider: record.modelProvider,
      apiEndpoint: record.apiEndpoint,
      systemPromptOverride: record.systemPromptOverride,
      updatedAt: record.updatedAt.toISOString()
    };
  }
}
