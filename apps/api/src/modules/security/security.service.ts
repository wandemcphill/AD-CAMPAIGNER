import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { buildOtpauthUri, generateBase32Secret, verifyTotp } from "./totp";
import { decryptTotpSecret, encryptTotpSecret, hashBackupCode } from "./totp-crypto";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.userId) {
    throw new UnauthorizedException("Authenticated user context is required.");
  }

  return context;
}

function generateBackupCode() {
  return randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-");
}

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async status(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const user = await this.db.user.findUnique({
      where: { id: scope.userId },
      select: { totpEnabledAt: true, username: true }
    });

    const remainingBackupCodes = user?.totpEnabledAt
      ? await this.db.twoFactorBackupCode.count({ where: { userId: scope.userId, usedAt: null } })
      : 0;

    return {
      enabled: Boolean(user?.totpEnabledAt),
      enabledAt: user?.totpEnabledAt ?? null,
      remainingBackupCodes
    };
  }

  async setup(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const user = await this.db.user.findUnique({
      where: { id: scope.userId },
      select: { username: true, totpEnabledAt: true }
    });

    if (user?.totpEnabledAt) {
      throw new ConflictException("Two-factor authentication is already enabled.");
    }

    const secret = generateBase32Secret();

    await this.db.user.update({
      where: { id: scope.userId },
      data: { totpSecretEncrypted: encryptTotpSecret(secret) }
    });

    return {
      secret,
      otpauthUri: buildOtpauthUri(secret, user?.username ?? scope.userId)
    };
  }

  async confirm(code: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const user = await this.db.user.findUnique({
      where: { id: scope.userId },
      select: { totpSecretEncrypted: true, totpEnabledAt: true }
    });

    if (!user?.totpSecretEncrypted) {
      throw new BadRequestException("Start two-factor setup before confirming a code.");
    }
    if (user.totpEnabledAt) {
      throw new ConflictException("Two-factor authentication is already enabled.");
    }

    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    if (!verifyTotp(secret, code)) {
      throw new BadRequestException("That code is invalid or expired.");
    }

    const backupCodes = Array.from({ length: 10 }, () => generateBackupCode());

    await this.db.$transaction([
      this.db.user.update({ where: { id: scope.userId }, data: { totpEnabledAt: new Date() } }),
      this.db.twoFactorBackupCode.deleteMany({ where: { userId: scope.userId } }),
      this.db.twoFactorBackupCode.createMany({
        data: backupCodes.map((backupCode) => ({
          userId: scope.userId,
          codeHash: hashBackupCode(backupCode)
        }))
      })
    ]);

    return { enabled: true, backupCodes };
  }

  async disable(code: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const user = await this.db.user.findUnique({
      where: { id: scope.userId },
      select: { totpSecretEncrypted: true, totpEnabledAt: true }
    });

    if (!user?.totpEnabledAt || !user.totpSecretEncrypted) {
      throw new BadRequestException("Two-factor authentication is not enabled.");
    }

    const secret = decryptTotpSecret(user.totpSecretEncrypted);
    const validTotp = verifyTotp(secret, code);
    let validBackup = false;

    if (!validTotp) {
      const codeHash = hashBackupCode(code);
      const backupCode = await this.db.twoFactorBackupCode.findFirst({
        where: { userId: scope.userId, codeHash, usedAt: null }
      });
      validBackup = Boolean(backupCode);
    }

    if (!validTotp && !validBackup) {
      throw new BadRequestException("That code is invalid or expired.");
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: scope.userId },
        data: { totpSecretEncrypted: null, totpEnabledAt: null }
      }),
      this.db.twoFactorBackupCode.deleteMany({ where: { userId: scope.userId } })
    ]);

    return { enabled: false };
  }
}
