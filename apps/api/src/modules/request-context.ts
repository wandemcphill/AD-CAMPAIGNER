import { UnauthorizedException } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Permission, Role } from "@fliptrybe/types";

export type HeaderBag = Record<string, string | string[] | undefined>;

export interface AuthenticatedRequestContext {
  userId: string;
  workspaceId: string;
  organizationId?: string;
  sessionId?: string;
  userEmail?: string;
  userName?: string;
  role?: Role;
  permissions?: Permission[];
}

export interface WorkspaceContextEntity {
  id: string;
  name: string;
}

export interface WorkspaceContextUser {
  id: string;
  email?: string;
  name?: string;
}

export interface RequestMetadataContext {
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface WorkspaceContextRequest {
  headers: HeaderBag;
  workspaceContext?: AuthenticatedRequestContext;
  workspaceContextError?: unknown;
  workspaceContextValidated?: boolean;
  requestMetadata?: RequestMetadataContext;
  user?: WorkspaceContextUser;
  workspace?: WorkspaceContextEntity;
  organization?: WorkspaceContextEntity & { slug?: string };
  context?: AuthenticatedRequestContext;
}

type JwtClaims = Record<string, unknown>;

function isEnabled(value: string | undefined) {
  return value?.toLowerCase() === "true" || value === "1";
}

function header(headers: HeaderBag, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0]?.trim();
  }

  return value?.trim();
}

function claim(claims: JwtClaims, names: string[]) {
  for (const name of names) {
    const value = claims[name];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function requireScopedIdentity(context: Partial<AuthenticatedRequestContext>) {
  if (!context.userId) {
    throw new UnauthorizedException(
      "Digital Access requires an authenticated user and workspace context."
    );
  }

  return {
    userId: context.userId,
    ...(context.workspaceId === undefined ? {} : { workspaceId: context.workspaceId }),
    ...(context.organizationId === undefined ? {} : { organizationId: context.organizationId }),
    ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
    ...(context.userEmail === undefined ? {} : { userEmail: context.userEmail }),
    ...(context.userName === undefined ? {} : { userName: context.userName }),
    ...(context.role === undefined ? {} : { role: context.role }),
    ...(context.permissions === undefined ? {} : { permissions: context.permissions })
  };
}

function bearerToken(headers: HeaderBag) {
  const authorization = header(headers, "authorization");

  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new UnauthorizedException("Authorization header must be a Bearer token.");
  }

  return token;
}

export function bearerTokenFromHeaders(headers: HeaderBag) {
  return bearerToken(headers);
}

export function hasAuthenticationContextHeaders(headers: HeaderBag) {
  return Boolean(
    header(headers, "authorization") ||
      header(headers, "x-user-id") ||
      header(headers, "x-fliptrybe-user-id") ||
      header(headers, "x-workspace-id") ||
      header(headers, "x-fliptrybe-workspace-id")
  );
}

function decodeJsonSegment(segment: string): JwtClaims {
  const parsed = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new UnauthorizedException("Bearer token payload is invalid.");
  }

  return parsed as JwtClaims;
}

function verifyJwt(token: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new UnauthorizedException("JWT_SECRET is required for bearer authentication.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new UnauthorizedException("Bearer token is invalid.");
  }

  const jwtHeader = decodeJsonSegment(encodedHeader);
  const algorithm = claim(jwtHeader, ["alg"]);

  if (algorithm !== "HS256") {
    throw new UnauthorizedException("Bearer token algorithm is not supported.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actual = Buffer.from(encodedSignature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new UnauthorizedException("Bearer token signature is invalid.");
  }

  const claims = decodeJsonSegment(encodedPayload);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = claims.exp;
  const notBefore = claims.nbf;

  if (typeof expiresAt === "number" && expiresAt <= nowSeconds) {
    throw new UnauthorizedException("Bearer token has expired.");
  }
  if (typeof notBefore === "number" && notBefore > nowSeconds) {
    throw new UnauthorizedException("Bearer token is not active yet.");
  }

  return claims;
}

function contextFromClaims(claims: JwtClaims): Partial<AuthenticatedRequestContext> {
  const userId = claim(claims, ["sub", "userId", "user_id"]);
  const workspaceId = claim(claims, ["workspaceId", "workspace_id", "workspace"]);
  const organizationId = claim(claims, ["organizationId", "organization_id", "orgId", "org_id"]);
  const sessionId = claim(claims, ["sid", "sessionId", "session_id"]);
  const userEmail = claim(claims, ["email", "userEmail", "user_email"]);
  const userName = claim(claims, ["name", "userName", "user_name"]);

  return {
    ...(userId === undefined ? {} : { userId }),
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(organizationId === undefined ? {} : { organizationId }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(userEmail === undefined ? {} : { userEmail }),
    ...(userName === undefined ? {} : { userName })
  };
}

function canTrustProxyHeaders() {
  return (
    process.env.NODE_ENV !== "production" ||
    isEnabled(process.env.TRUST_PROXY_AUTH_HEADERS) ||
    isEnabled(process.env.DIGITAL_ACCESS_TRUST_AUTH_HEADERS)
  );
}

function contextFromHeaders(headers: HeaderBag): Partial<AuthenticatedRequestContext> {
  const userId = header(headers, "x-user-id") ?? header(headers, "x-fliptrybe-user-id");
  const workspaceId =
    header(headers, "x-workspace-id") ?? header(headers, "x-fliptrybe-workspace-id");
  const organizationId =
    header(headers, "x-organization-id") ?? header(headers, "x-fliptrybe-organization-id");
  const userEmail = header(headers, "x-user-email") ?? header(headers, "x-fliptrybe-user-email");
  const userName = header(headers, "x-user-name") ?? header(headers, "x-fliptrybe-user-name");
  const context = {
    ...(userId === undefined ? {} : { userId }),
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(organizationId === undefined ? {} : { organizationId }),
    ...(userEmail === undefined ? {} : { userEmail }),
    ...(userName === undefined ? {} : { userName })
  };

  if (Object.values(context).some(Boolean) && !canTrustProxyHeaders()) {
    throw new UnauthorizedException("Trusted auth headers are not enabled.");
  }

  return context;
}

function requestAliasesFromContext(context: Partial<AuthenticatedRequestContext>) {
  return {
    ...(context.userId === undefined
      ? {}
      : {
          user: {
            id: context.userId,
            ...(context.userEmail === undefined ? {} : { email: context.userEmail }),
            ...(context.userName === undefined ? {} : { name: context.userName })
          }
        }),
    ...(context.workspaceId === undefined
      ? {}
      : {
          workspace: {
            id: context.workspaceId,
            name: context.workspaceId
          }
        }),
    ...(context.organizationId === undefined
      ? {}
      : {
          organization: {
            id: context.organizationId,
            name: context.organizationId
          }
        }),
    context
  };
}

export function authenticatedContextFromHeaders(headers: HeaderBag): Partial<AuthenticatedRequestContext> {
  const token = bearerToken(headers);

  if (token) {
    return requireScopedIdentity(contextFromClaims(verifyJwt(token)));
  }

  return requireScopedIdentity(contextFromHeaders(headers));
}

export function optionalAuthenticatedContextFromHeaders(headers: HeaderBag) {
  try {
    return authenticatedContextFromHeaders(headers);
  } catch {
    return undefined;
  }
}

export function metadataContextFromHeaders(headers: HeaderBag): RequestMetadataContext {
  const idempotencyKey = header(headers, "idempotency-key");
  const ipAddress = header(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = header(headers, "user-agent");
  const deviceId = header(headers, "x-device-id") ?? header(headers, "x-fliptrybe-device-id");

  return {
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    ...(ipAddress === undefined ? {} : { ipAddress }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(deviceId === undefined ? {} : { deviceId })
  };
}

export function attachWorkspaceContext(request: WorkspaceContextRequest) {
  const context = authenticatedContextFromHeaders(request.headers);
  request.workspaceContext = context as AuthenticatedRequestContext;
  request.context = context as AuthenticatedRequestContext;
  Object.assign(request, requestAliasesFromContext(context));
  request.requestMetadata = metadataContextFromHeaders(request.headers);
}

export function workspaceContextFromRequest(request: WorkspaceContextRequest) {
  if (request.workspaceContext) {
    if (!request.workspaceContext.userId) {
      throw new UnauthorizedException("Workspace context is missing.");
    }

    if (!request.workspaceContext.workspaceId) {
      if (request.workspace?.id) {
        request.workspaceContext = {
          ...request.workspaceContext,
          workspaceId: request.workspace.id
        };
      } else {
        throw new UnauthorizedException("Workspace context is missing.");
      }
    }

    return request.workspaceContext as AuthenticatedRequestContext;
  }

  if (request.workspaceContextValidated) {
    if (request.workspaceContextError instanceof Error) {
      throw request.workspaceContextError;
    }

    throw new UnauthorizedException("Workspace context is missing.");
  }

  attachWorkspaceContext(request);

  if (!request.workspaceContext) {
    throw new UnauthorizedException("Workspace context is missing.");
  }

  return request.workspaceContext;
}

export function metadataContextFromRequest(request: WorkspaceContextRequest) {
  if (!request.requestMetadata) {
    request.requestMetadata = metadataContextFromHeaders(request.headers);
  }

  return request.requestMetadata;
}
