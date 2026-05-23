import { Injectable, type NestMiddleware } from "@nestjs/common";

import { attachWorkspaceContext, type WorkspaceContextRequest } from "./request-context";

@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  use(request: WorkspaceContextRequest, _response: unknown, next: () => void) {
    attachWorkspaceContext(request);
    next();
  }
}
