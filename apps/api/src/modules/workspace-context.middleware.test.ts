import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "./request-context";
import { WorkspaceContextMiddleware } from "./workspace-context.middleware";

describe("WorkspaceContextMiddleware", () => {
  it("lets public Digital Access routes continue without auth", async () => {
    const getWorkspaceContext = vi.fn();
    const middleware = new WorkspaceContextMiddleware({ getWorkspaceContext } as never);
    const request: WorkspaceContextRequest = {
      headers: { "user-agent": "vitest" }
    };
    const next = vi.fn();

    await middleware.use(request, {}, next);

    expect(getWorkspaceContext).not.toHaveBeenCalled();
    expect(request.workspaceContextValidated).toBe(true);
    expect(request.workspaceContext).toBeUndefined();
    expect(request.requestMetadata?.userAgent).toBe("vitest");
    expect(next).toHaveBeenCalledWith();
  });

  it("makes protected handlers reject missing auth cleanly", async () => {
    const middleware = new WorkspaceContextMiddleware({ getWorkspaceContext: vi.fn() } as never);
    const request: WorkspaceContextRequest = {
      headers: {}
    };

    await middleware.use(request, {}, vi.fn());

    expect(() => workspaceContextFromRequest(request)).toThrow(UnauthorizedException);
  });

  it("stores auth failures for protected handlers", async () => {
    const failure = new UnauthorizedException("Session has expired or been revoked.");
    const middleware = new WorkspaceContextMiddleware({
      getWorkspaceContext: vi.fn().mockRejectedValue(failure)
    } as never);
    const request: WorkspaceContextRequest = {
      headers: { authorization: "Bearer expired" }
    };
    const next = vi.fn();

    await middleware.use(request, {}, next);

    expect(request.workspaceContextError).toBe(failure);
    expect(next).toHaveBeenCalledWith();
    expect(() => workspaceContextFromRequest(request)).toThrow(failure);
  });
});
