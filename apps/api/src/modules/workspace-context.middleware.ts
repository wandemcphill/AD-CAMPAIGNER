import { Injectable, type NestMiddleware } from "@nestjs/common";

import { AuthSessionService } from "./auth-session.service";
import {
  hasAuthenticationContextHeaders,
  metadataContextFromHeaders,
  type WorkspaceContextRequest
} from "./request-context";

@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  constructor(private readonly authSession: AuthSessionService) {}

  async use(
    request: WorkspaceContextRequest,
    _response: unknown,
    next: (error?: unknown) => void
  ) {
    request.workspaceContextValidated = true;
    request.requestMetadata = metadataContextFromHeaders(request.headers);

    if (!hasAuthenticationContextHeaders(request.headers)) {
      next();

      return;
    }

    try {
      request.workspaceContext = await this.authSession.getWorkspaceContext(request.headers);
      request.context = request.workspaceContext;
      if (request.workspaceContext.userId) {
        request.user = {
          id: request.workspaceContext.userId,
          ...(request.workspaceContext.userEmail === undefined
            ? {}
            : { email: request.workspaceContext.userEmail }),
          ...(request.workspaceContext.userName === undefined
            ? {}
            : { name: request.workspaceContext.userName })
        };
      }
      if (request.workspaceContext.workspaceId) {
        request.workspace = {
          id: request.workspaceContext.workspaceId,
          name: request.workspaceContext.workspaceId
        };
      }
      if (request.workspaceContext.organizationId) {
        request.organization = {
          id: request.workspaceContext.organizationId,
          name: request.workspaceContext.organizationId
        };
      }
    } catch (error) {
      request.workspaceContextError = error;
    }

    next();
  }
}
