import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { AiConfigService } from "./ai-config.service";

function serviceWith(aiConfig: Record<string, unknown>) {
  return new AiConfigService({ client: { aiConfig } } as unknown as PrismaService);
}

describe("AiConfigService", () => {
  it("requires an authenticated workspace context to read config", async () => {
    const service = serviceWith({ findUnique: vi.fn() });

    await expect(service.get(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns sensible defaults when no config row exists yet", async () => {
    const findUnique = vi.fn(() => Promise.resolve(null));
    const service = serviceWith({ findUnique });

    const result = await service.get({ userId: "user_1", workspaceId: "workspace_1" });

    expect(result).toEqual({
      modelProvider: "OpenAI",
      apiEndpoint: "https://api.openai.com/v1",
      systemPromptOverride:
        "You are an expert ad copywriter. Generate engaging, high-converting ad copy for ...",
      updatedAt: null
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { workspaceId: "workspace_1" } });
  });

  it("returns the persisted config row when one exists", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    const findUnique = vi.fn(() =>
      Promise.resolve({
        modelProvider: "Gemini",
        apiEndpoint: "https://example.com/v1",
        systemPromptOverride: "Custom prompt",
        updatedAt
      })
    );
    const service = serviceWith({ findUnique });

    const result = await service.get({ userId: "user_1", workspaceId: "workspace_1" });

    expect(result).toEqual({
      modelProvider: "Gemini",
      apiEndpoint: "https://example.com/v1",
      systemPromptOverride: "Custom prompt",
      updatedAt: updatedAt.toISOString()
    });
  });

  it("rejects an unknown model provider", async () => {
    const service = serviceWith({ upsert: vi.fn() });

    await expect(
      service.update(
        { modelProvider: "NotAProvider", apiEndpoint: "https://example.com" },
        { userId: "user_1", workspaceId: "workspace_1" }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an invalid API endpoint URL", async () => {
    const service = serviceWith({ upsert: vi.fn() });

    await expect(
      service.update(
        { modelProvider: "OpenAI", apiEndpoint: "not-a-url" },
        { userId: "user_1", workspaceId: "workspace_1" }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("upserts a valid config and returns it", async () => {
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");
    const upsert = vi.fn(() =>
      Promise.resolve({
        modelProvider: "OpenAI",
        apiEndpoint: "https://api.openai.com/v1",
        systemPromptOverride: "Be concise.",
        updatedAt
      })
    );
    const service = serviceWith({ upsert });

    const result = await service.update(
      {
        modelProvider: "OpenAI",
        apiEndpoint: "https://api.openai.com/v1",
        systemPromptOverride: "Be concise."
      },
      { userId: "user_1", workspaceId: "workspace_1" }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { workspaceId: "workspace_1" },
      update: {
        modelProvider: "OpenAI",
        apiEndpoint: "https://api.openai.com/v1",
        systemPromptOverride: "Be concise.",
        updatedByUserId: "user_1"
      },
      create: {
        workspaceId: "workspace_1",
        modelProvider: "OpenAI",
        apiEndpoint: "https://api.openai.com/v1",
        systemPromptOverride: "Be concise.",
        updatedByUserId: "user_1"
      }
    });
    expect(result.apiEndpoint).toBe("https://api.openai.com/v1");
  });
});
