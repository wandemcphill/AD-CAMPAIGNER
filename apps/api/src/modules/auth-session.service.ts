import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual
} from "node:crypto";
import { Buffer } from "node:buffer";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";

import { rolePermissions } from "@fliptrybe/auth";
import type { Permission, Role } from "@fliptrybe/types";
import { PrismaService } from "./prisma.service";
import {
  authenticatedContextFromHeaders,
  bearerTokenFromHeaders,
  metadataContextFromHeaders,
  type AuthenticatedRequestContext,
  type HeaderBag,
  type RequestMetadataContext
} from "./request-context";

type SessionHeaderContext = Partial<AuthenticatedRequestContext> & {
  userId?: string;
  workspaceId?: string;
};

const defaultSessionTtlSeconds = 60 * 60 * 24 * 7;
const passwordHashAlgorithm = "scrypt";
const passwordHashKeyLength = 64;
const passwordHashOptions = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
};

interface AuthScope {
  user: {
    id: string;
    email: string;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
    defaultCurrency: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    role: string;
    permissions: string[];
  };
  sessionId?: string;
}

interface RegistrationInput {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  workspaceName: string;
}

interface LoginInput {
  email: string;
  password: string;
  workspaceId?: string;
}

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

function scryptKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: typeof passwordHashOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });
}

async function createPasswordHash(password: string) {
  const salt = randomBytes(16);
  const key = await scryptKey(password, salt, passwordHashKeyLength, passwordHashOptions);

  return [
    passwordHashAlgorithm,
    String(passwordHashOptions.N),
    String(passwordHashOptions.r),
    String(passwordHashOptions.p),
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, cost, blockSize, parallelization, saltValue, keyValue] = storedHash.split("$");

  if (
    algorithm !== passwordHashAlgorithm ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !saltValue ||
    !keyValue
  ) {
    return false;
  }

  const options = {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: passwordHashOptions.maxmem
  };

  if (
    !Number.isSafeInteger(options.N) ||
    !Number.isSafeInteger(options.r) ||
    !Number.isSafeInteger(options.p) ||
    options.N <= 1 ||
    options.r <= 0 ||
    options.p <= 0
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(keyValue, "base64url");
    const actual = await scryptKey(password, salt, expected.length, options);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function recordFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  return body as Record<string, unknown>;
}

function hasOwnField(body: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string.`);
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function requireString(body: Record<string, unknown>, field: string) {
  const value = optionalString(body, field);

  if (!value) {
    throw new BadRequestException(`${field} is required.`);
  }

  return value;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("email must be a valid email address.");
  }

  return email;
}

function normalizePassword(value: unknown) {
  if (typeof value !== "string") {
    throw new BadRequestException("password is required.");
  }
  if (value.length < 8 || value.length > 128) {
    throw new BadRequestException("password must be between 8 and 128 characters.");
  }

  return value;
}

function normalizeDisplayName(value: string, field: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length < 2 || trimmed.length > 120) {
    throw new BadRequestException(`${field} must be between 2 and 120 characters.`);
  }

  return trimmed;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "organization";
}

function organizationSlug(name: string, email: string) {
  const emailHandle = email.split("@").at(0) ?? "organization";
  const base = slugify(name || emailHandle);

  return `${base}-${randomUUID().slice(0, 8)}`;
}

function looksLikeCredentialLogin(body: unknown) {
  const record = recordFromBody(body);

  if (!record) {
    return false;
  }

  return ["email", "password", "workspaceId"].some((field) => hasOwnField(record, field));
}

function parseRegistrationInput(body: unknown): RegistrationInput {
  const record = recordFromBody(body);

  if (!record) {
    throw new BadRequestException("Registration body is required.");
  }

  const email = normalizeEmail(requireString(record, "email"));
  const password = normalizePassword(record.password);
  const name = normalizeDisplayName(requireString(record, "name"), "name");
  const organizationName = normalizeDisplayName(
    optionalString(record, "organizationName") ?? `${name}'s Organization`,
    "organizationName"
  );
  const workspaceName = normalizeDisplayName(
    optionalString(record, "workspaceName") ?? `${organizationName} Workspace`,
    "workspaceName"
  );

  return { email, password, name, organizationName, workspaceName };
}

function parseLoginInput(body: unknown): LoginInput {
  const record = recordFromBody(body);

  if (!record) {
    throw new BadRequestException("Login body is required.");
  }

  const email = normalizeEmail(requireString(record, "email"));
  const password = normalizePassword(record.password);
  const workspaceId = optionalString(record, "workspaceId");

  return {
    email,
    password,
    ...(workspaceId === undefined ? {} : { workspaceId })
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSession(headers: HeaderBag) {
    const scope = await this.getValidatedScope(headers);

    return this.toSessionPayload(scope);
  }

  async getWorkspaceContext(headers: HeaderBag): Promise<AuthenticatedRequestContext> {
    const scope = await this.getValidatedScope(headers);

    return {
      userId: scope.user.id,
      workspaceId: scope.workspace.id,
      organizationId: scope.organization.id,
      ...(scope.sessionId === undefined ? {} : { sessionId: scope.sessionId }),
      userEmail: scope.user.email,
      userName: scope.user.name,
      role: scope.membership.role as Role,
      permissions: scope.membership.permissions as Permission[]
    };
  }

  async register(body: unknown, headers: HeaderBag) {
    const input = parseRegistrationInput(body);
    const existingUser = await this.db.user.findUnique({
      where: { email: input.email },
      select: { id: true }
    });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await createPasswordHash(input.password);

    try {
      const scope = await this.db.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email: input.email,
            name: input.name,
            status: "ACTIVE",
            passwordHash,
            emailVerifiedAt: new Date()
          },
          select: { id: true, email: true, name: true }
        });
        const organization = await transaction.organization.create({
          data: {
            name: input.organizationName,
            slug: organizationSlug(input.organizationName, input.email),
            ownerUserId: user.id
          },
          select: { id: true, name: true, slug: true }
        });
        const workspace = await transaction.workspace.create({
          data: {
            organizationId: organization.id,
            name: input.workspaceName
          },
          select: { id: true, name: true, defaultCurrency: true }
        });
        const membership = await transaction.teamMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: "OWNER",
            permissions: rolePermissions.OWNER
          },
          select: { role: true, permissions: true }
        });

        return { user, organization, workspace, membership };
      });

      return this.issueSignedSession(scope, metadataContextFromHeaders(headers));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("An account or organization with these details already exists.");
      }

      throw error;
    }
  }

  async login(body: unknown, headers: HeaderBag) {
    if (!looksLikeCredentialLogin(body)) {
      return this.issueSession(headers);
    }

    const input = parseLoginInput(body);
    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        passwordHash: true,
        deletedAt: true
      }
    });

    if (!user || user.deletedAt || !user.passwordHash) {
      throw new UnauthorizedException("Email or password is invalid.");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Email or password is invalid.");
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is not active.");
    }

    const scope = await this.resolveUserLoginScope(user, input.workspaceId);

    return this.issueSignedSession(scope, metadataContextFromHeaders(headers));
  }

  async logout(headers: HeaderBag) {
    const context = authenticatedContextFromHeaders(headers);
    const token = bearerTokenFromHeaders(headers);

    if (!context.sessionId || !context.userId || !token) {
      throw new UnauthorizedException("Bearer session token is required to logout.");
    }

    await this.validateStoredSession(context.sessionId, context.userId, token);
    await this.db.session.updateMany({
      where: {
        id: context.sessionId,
        userId: context.userId,
        tokenHash: hashToken(token),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    return { ok: true };
  }

  async issueSession(headers: HeaderBag) {
    const context = authenticatedContextFromHeaders(headers);
    const scope = await this.resolveScope(context);

    return this.issueSignedSession(scope, metadataContextFromHeaders(headers));
  }

  private async issueSignedSession(scope: AuthScope, metadata: RequestMetadataContext) {
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

  private async getValidatedScope(headers: HeaderBag) {
    const context = authenticatedContextFromHeaders(headers);
    const token = bearerTokenFromHeaders(headers);
    const scope = await this.resolveScope(context);

    if (context.sessionId && context.userId) {
      await this.validateStoredSession(context.sessionId, context.userId, token);
    }

    return {
      ...scope,
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId })
    };
  }

  private async resolveScope(context: SessionHeaderContext) {
    if (!context.userId) {
      throw new UnauthorizedException("Authenticated user is not active.");
    }

    const user = await this.db.user.findFirst({
      where: { id: context.userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, email: true, name: true, status: true }
    });

    if (!user) {
      throw new UnauthorizedException("Authenticated user is not active.");
    }

    const scope = context.workspaceId
      ? await this.resolveUserWorkspaceScope(user, context.workspaceId, context.organizationId)
      : await this.resolveDefaultWorkspaceScope(user, context.organizationId);

    return {
      user,
      ...scope
    };
  }

  private async resolveUserLoginScope(
    user: AuthScope["user"],
    requestedWorkspaceId: string | undefined,
    requestedOrganizationId?: string
  ): Promise<AuthScope> {
    if (requestedWorkspaceId) {
      return {
        user,
        ...(await this.resolveUserWorkspaceScope(
          user,
          requestedWorkspaceId,
          requestedOrganizationId
        ))
      };
    }

    return {
      user,
      ...(await this.resolveDefaultWorkspaceScope(user, requestedOrganizationId))
    };
  }

  private async resolveUserWorkspaceScope(
    user: AuthScope["user"],
    requestedWorkspaceId: string,
    requestedOrganizationId?: string
  ): Promise<Omit<AuthScope, "user">> {
    const workspace = await this.db.workspace.findFirst({
      where: {
        id: requestedWorkspaceId,
        deletedAt: null,
        organization: {
          deletedAt: null,
          members: { some: { userId: user.id, deletedAt: null } }
        }
      },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: user.id, deletedAt: null },
              select: { role: true, permissions: true },
              take: 1
            }
          }
        }
      }
    });
    const membership = workspace?.organization.members[0];

    if (!workspace || !membership) {
      throw new ForbiddenException("User is not a member of the requested workspace.");
    }
    if (requestedOrganizationId && requestedOrganizationId !== workspace.organization.id) {
      throw new ForbiddenException("Workspace does not belong to the requested organization.");
    }

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        defaultCurrency: workspace.defaultCurrency
      },
      organization: {
        id: workspace.organization.id,
        name: workspace.organization.name,
        slug: workspace.organization.slug
      },
      membership: {
        role: membership.role,
        permissions: membership.permissions
      }
    };
  }

  private async resolveDefaultWorkspaceScope(
    user: AuthScope["user"],
    requestedOrganizationId?: string
  ): Promise<Omit<AuthScope, "user">> {
    const membership = await this.db.teamMember.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {}),
        organization: { deletedAt: null }
      },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        permissions: true,
        organization: { select: { id: true, name: true, slug: true } }
      }
    });

    if (!membership) {
      throw new ForbiddenException("User is not a member of an active workspace.");
    }

    const workspace = await this.db.workspace.findFirst({
      where: { organizationId: membership.organization.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, defaultCurrency: true }
    });

    if (!workspace) {
      throw new ForbiddenException("User does not have an active workspace.");
    }

    return {
      workspace,
      organization: membership.organization,
      membership: {
        role: membership.role,
        permissions: membership.permissions
      }
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

  private toSessionPayload(scope: AuthScope) {
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
