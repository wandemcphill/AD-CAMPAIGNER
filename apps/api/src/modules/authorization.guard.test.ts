import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import type { AuthSessionService } from "./auth-session.service";
import { authorizationPermissionsKey, authorizationPublicKey } from "./authorization.decorators";
import { AuthorizationGuard } from "./authorization.guard";

function createContext(request: Record<string, any> = { headers: {} }, type = "http") {
  return {
    getClass: () => class TestController {},
    getHandler: () => function testHandler() {},
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createGuard(
  metadata: Record<string, unknown>,
  getWorkspaceContext = vi.fn()
) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => metadata[key])
  } as unknown as Reflector;
  const authSession = { getWorkspaceContext } as unknown as AuthSessionService;

  return {
    guard: new AuthorizationGuard(reflector, authSession),
    getWorkspaceContext
  };
}

describe("AuthorizationGuard", () => {
  it("allows routes explicitly marked public without resolving a session", async () => {
    const { getWorkspaceContext, guard } = createGuard({ [authorizationPublicKey]: true });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("denies routes without explicit authorization metadata", async () => {
    const { getWorkspaceContext, guard } = createGuard({});

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      new ForbiddenException("Route is not explicitly authorized.")
    );
    expect(getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("denies protected non-http transports by default", async () => {
    const { getWorkspaceContext, guard } = createGuard({
      [authorizationPermissionsKey]: ["analytics:read"]
    });

    await expect(guard.canActivate(createContext({ headers: {} }, "ws"))).rejects.toThrow(
      new ForbiddenException("Route is not explicitly authorized for this transport.")
    );
    expect(getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("attaches DB-backed workspace context when permissions are satisfied", async () => {
    const request = { headers: { authorization: "Bearer token" } };
    const workspaceContext = {
      permissions: [],
      role: "ADMIN",
      userId: "user_123",
      workspaceId: "workspace_123"
    };
    const { getWorkspaceContext, guard } = createGuard(
      { [authorizationPermissionsKey]: ["admin:access"] },
      vi.fn().mockResolvedValue(workspaceContext)
    );

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(getWorkspaceContext).toHaveBeenCalledWith(request.headers);
    expect(request).toMatchObject({
      workspaceContext,
      workspaceContextValidated: true
    });
  });

  it("denies authenticated members missing a required permission", async () => {
    const { guard } = createGuard(
      { [authorizationPermissionsKey]: ["admin:access"] },
      vi.fn().mockResolvedValue({
        permissions: [],
        role: "VIEWER",
        userId: "user_123",
        workspaceId: "workspace_123"
      })
    );

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      new ForbiddenException("Missing required permission: admin:access.")
    );
  });

  it("propagates auth-session failures for protected routes", async () => {
    const failure = new UnauthorizedException("Session has expired or been revoked.");
    const { guard } = createGuard(
      { [authorizationPermissionsKey]: ["analytics:read"] },
      vi.fn().mockRejectedValue(failure)
    );

    await expect(guard.canActivate(createContext())).rejects.toThrow(failure);
  });
});
