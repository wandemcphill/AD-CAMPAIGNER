import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminIdentityService {
  constructor(private readonly db: PrismaService) {}

  async getSecurity(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        isPlatformAdmin: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        totpEnabledAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        sessions: {
          select: {
            id: true,
            deviceName: true,
            ipAddress: true,
            userAgent: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" },
          take: 25
        },
        memberships: {
          where: { deletedAt: null },
          select: {
            id: true,
            role: true,
            permissions: true,
            organization: { select: { id: true, name: true, slug: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!user) throw new NotFoundException("User not found");

    const activeSessions = user.sessions.filter(
      (session) => !session.revokedAt && session.expiresAt.getTime() > Date.now()
    ).length;

    return { ...user, activeSessionCount: activeSessions };
  }

  async revokeAllSessions(targetUserId: string, actorUserId: string, reason: string) {
    if (targetUserId === actorUserId) {
      throw new ConflictException("An administrator cannot revoke their own active sessions here.");
    }

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new ConflictException("A reason of at least 3 characters is required.");
    }

    const user = await this.db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const result = await this.db.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    return {
      revokedCount: result.count,
      reason: trimmed,
      targetUserId,
      actorUserId
    };
  }
}
