import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "./prisma.service";
import { requireAdultKey } from "./age.decorators";
import type { WorkspaceContextRequest } from "./request-context";

const MINIMUM_AGE_YEARS = 18;

/**
 * Enforces @RequireAdult(). Routes without the decorator are unaffected.
 *
 * Registered AFTER AuthorizationGuard so request.workspaceContext (and its
 * userId) is already populated and an unauthenticated caller gets 401/403 first.
 * The customer never sees the date maths — only a plain "must be 18" message.
 */
@Injectable()
export class AgeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiresAdult = this.reflector.getAllAndOverride<boolean>(requireAdultKey, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiresAdult) {
      return true;
    }

    const request = context.switchToHttp().getRequest<WorkspaceContextRequest>();
    const userId = request.workspaceContext?.userId;

    if (!userId) {
      throw new ForbiddenException("You must be signed in to use this feature.");
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true }
    });

    if (!user?.dateOfBirth || !isAtLeast(user.dateOfBirth, MINIMUM_AGE_YEARS)) {
      throw new ForbiddenException(
        `You must be at least ${MINIMUM_AGE_YEARS} and have verified your date of birth to use this feature.`
      );
    }

    return true;
  }
}

// True when `birth` is at least `years` ago. Compares against the birthday this
// year so someone turning 18 today passes and someone turning 18 tomorrow fails.
function isAtLeast(birth: Date, years: number) {
  const now = new Date();
  const threshold = new Date(
    now.getFullYear() - years,
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  return birth.getTime() <= threshold.getTime();
}
