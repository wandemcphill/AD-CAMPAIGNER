import { Injectable, type NestMiddleware } from "@nestjs/common";

import { AuthSessionService } from "./auth-session.service";
import { metadataContextFromHeaders, type WorkspaceContextRequest } from "./request-context";

@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  constructor(private readonly authSession: AuthSessionService) {}

  async use(
    request: WorkspaceContextRequest,
    _response: unknown,
    next: (error?: unknown) => void
  ) {
    try {
      request.workspaceContext = await this.authSession.getWorkspaceContext(request.headers);
      request.requestMetadata = metadataContextFromHeaders(request.headers);
      next();
    } catch (error) {
      next(error);
    }
  }
}
