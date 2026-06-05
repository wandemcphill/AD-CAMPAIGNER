import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { hasPermission } from "@fliptrybe/auth";
import type { Permission, Role } from "@fliptrybe/types";
import { AuthSessionService } from "./auth-session.service";
import {
  authorizationPermissionsKey,
  authorizationPublicKey
} from "./authorization.decorators";
import type { WorkspaceContextRequest } from "./request-context";

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authSession: AuthSessionService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(authorizationPublicKey, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      authorizationPermissionsKey,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions?.length) {
      throw new ForbiddenException("Route is not explicitly authorized.");
    }

    if (context.getType() !== "http") {
      throw new ForbiddenException("Route is not explicitly authorized for this transport.");
    }

    const request = context.switchToHttp().getRequest<WorkspaceContextRequest>();
    const workspaceContext = await this.authSession.getWorkspaceContext(request.headers);
    const member = {
      role: workspaceContext.role as Role,
      permissions: workspaceContext.permissions ?? []
    };

    const missingPermission = requiredPermissions.find(
      (permission) => !hasPermission(member, permission)
    );

    if (missingPermission) {
      throw new ForbiddenException(`Missing required permission: ${missingPermission}.`);
    }

    request.workspaceContext = workspaceContext;
    request.workspaceContextValidated = true;

    return true;
  }
}
