import { randomUUID, createHash, createHmac } from "node:crypto";
import { Buffer } from "node:buffer";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import {
  authenticatedContextFromHeaders,
  bearerTokenFromHeaders,
  metadataContextFromHeaders,
  type AuthenticatedRequestContext,
  type HeaderBag
} from "./request-context";

const defaultSessionTtlSeconds = 60 * 60 * 24 * 7;

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readTtlSeconds() {
  const parsed = Number(process.env.AUTH_SESSION_TTL_SECONDS);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultSessionTtlSeconds;
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSession(headers: HeaderBag) {
    const context = authenticatedContextFromHeaders(headers);
    const token = bearerTokenFromHeaders(headers);
    const scope = await this.resolveScope(context);

    if (context.sessionId) {
      await this.validateStoredSession(context.sessionId, context.userId, token);
    }

    return this.toSessionPayload(scope);
  }

  async issueSession(headers: HeaderBag) {
    const context = authenticatedContextFromHeaders(headers);
    const metadata = metadataContextFromHeaders(headers);
    const scope = await this.resolveScope(context);
    const ttlSeconds = readTtlSeconds();
    const sessionId = randomUUID();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000);
    const token = this.signToken({
      sub: scope.user.id,
      sid: sessionId,
      workspaceId: scope.workspace.id,
      organizationId: scope.organization.id,
      email: scope.user.email,
      name: scope.user.name,
      role: scope.membership.role,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds
    });

    await this.db.session.create({
      data: {
        id: sessionId,
        userId: scope.user.id,
        tokenHash: hashToken(token),
        ...(metadata.deviceId === undefined ? {} : { deviceName: metadata.deviceId }),
        ...(metadata.ipAddress === undefined ? {} : { ipAddress: metadata.ipAddress }),
        ...(metadata.userAgent === undefined ? {} : { userAgent: metadata.userAgent }),
        expiresAt
      }
    });

    return {
      ...this.toSessionPayload(scope),
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  private async resolveScope(context: AuthenticatedRequestContext) {
    const workspace = await this.db.workspace.findFirst({
      where: {
        id: context.workspaceId,
        deletedAt: null,
        organization: { deletedAt: null }
      },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: context.userId, deletedAt: null },
              select: { role: true, permissions: true },
              take: 1
            }
          }
        }
      }
    });
    const membership = workspace?.organization.members[0];

    if (!workspace || !membership) {
      throw new ForbiddenException("User is not a member of the active workspace.");
    }
    if (context.organizationId && context.organizationId !== workspace.organization.id) {
      throw new ForbiddenException("Workspace does not belong to the requested organization.");
    }

    const user = await this.db.user.findFirst({
      where: { id: context.userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, name: true, status: true }
    });

    if (!user) {
      throw new UnauthorizedException("Authenticated user is not active.");
    }

    return {
      user,
      workspace,
      organization: workspace.organization,
      membership
    };
  }

  private async validateStoredSession(
    sessionId: string,
    userId: string,
    token: string | undefined
  ) {
    const session = await this.db.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { tokenHash: true }
    });

    if (!session) {
      throw new UnauthorizedException("Session has expired or been revoked.");
    }
    if (token && session.tokenHash !== hashToken(token)) {
      throw new UnauthorizedException("Session token does not match the active session.");
    }
  }

  private toSessionPayload(scope: Awaited<ReturnType<AuthSessionService["resolveScope"]>>) {
    return {
      user: {
        id: scope.user.id,
        name: scope.user.name,
        email: scope.user.email
      },
      workspace: {
        id: scope.workspace.id,
        name: scope.workspace.name,
        defaultCurrency: scope.workspace.defaultCurrency
      },
      organization: {
        id: scope.organization.id,
        name: scope.organization.name,
        slug: scope.organization.slug
      },
      role: scope.membership.role,
      permissions: scope.membership.permissions
    };
  }

  private signToken(claims: Record<string, unknown>) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET is required to issue sessions.");
    }

    const encodedHeader = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const encodedPayload = base64UrlJson(claims);
    const signature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private get db() {
    return this.prismaService.client;
  }
}
