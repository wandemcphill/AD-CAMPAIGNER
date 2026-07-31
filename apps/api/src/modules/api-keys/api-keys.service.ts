/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

const VALID_SCOPES = [
  "campaigns",
  "products",
  "orders",
  "rewards",
  "wallet",
  "analytics",
  "webhooks"
];

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const keys = await this.db.apiKey.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return keys.map((key: any) => ({
      id: key.id,
      name: key.name,
      environment: key.environment,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt
    }));
  }

  async create(
    input: { name: string; environment: "TEST" | "PRODUCTION"; scopes: string[] },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);

    if (!input.name?.trim()) {
      throw new BadRequestException("A key name is required.");
    }
    if (!["TEST", "PRODUCTION"].includes(input.environment)) {
      throw new BadRequestException("A valid environment is required.");
    }
    const scopes = (input.scopes ?? []).filter((s) => VALID_SCOPES.includes(s));

    const secret = randomBytes(24).toString("base64url");
    const keyPrefix = input.environment === "PRODUCTION" ? "ftk_live_" : "ftk_test_";
    const fullKey = `${keyPrefix}${secret}`;

    const record = await this.db.apiKey.create({
      data: {
        workspaceId: scope.workspaceId,
        createdByUserId: scope.userId,
        name: input.name.trim(),
        environment: input.environment,
        keyPrefix: `${keyPrefix}${secret.slice(0, 6)}…`,
        keyHash: hashKey(fullKey),
        scopes
      }
    });

    return {
      id: record.id,
      name: record.name,
      environment: record.environment,
      scopes: record.scopes,
      createdAt: record.createdAt,
      // Only ever returned once, at creation time.
      key: fullKey
    };
  }

  async revoke(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const key = await this.db.apiKey.findFirst({
      where: { id, workspaceId: scope.workspaceId, revokedAt: null }
    });
    if (!key) {
      throw new NotFoundException("API key was not found.");
    }

    await this.db.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });

    return { ok: true };
  }
}
