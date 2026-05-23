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
    } catch (error) {
      request.workspaceContextError = error;
    }

    next();
  }
}
