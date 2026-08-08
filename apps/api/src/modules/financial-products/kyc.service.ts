/**
 * KYC verification orchestration service.
 *
 * Prefers provider-hosted KYC where available. FlipTrybe only stores:
 * - Provider reference ID
 * - Verification status / level
 * - Failure reason
 * - Timestamps
 *
 * Raw identity documents are NOT stored by FlipTrybe — the provider holds them.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";

import { featureFlags } from "@fliptrybe/feature-flags";
import { createMockKycProvider, type KycProviderAdapter } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";

type KycLevel = "LIGHT" | "STANDARD" | "ENHANCED";

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  // When real KYC providers are contracted, inject via ProviderRouterService
  // and make the adapter selection config-driven. For now the mock is used so
  // the API surface is fully exercisable without live credentials.
  private readonly provider: KycProviderAdapter = createMockKycProvider();

  constructor(private readonly prisma: PrismaService) {}

  async initiateVerification(input: {
    userId: string;
    workspaceId: string;
    country: string;
    level?: KycLevel;
    redirectUrl?: string;
  }): Promise<{ sessionId: string; sessionUrl?: string; expiresAt: string }> {
    if (!featureFlags.kycVerification) {
      throw new ServiceUnavailableException("KYC verification is not yet enabled");
    }

    const level = input.level ?? "STANDARD";

    // Check for an existing active verification at this level
    const existing = await this.prisma.client.kycVerification.findFirst({
      where: {
        userId: input.userId,
        level,
        status: { in: ["PENDING", "VERIFIED"] }
      }
    });

    if (existing?.status === "VERIFIED") {
      throw new BadRequestException(`User already has a VERIFIED KYC at level ${level}`);
    }

    const session = await this.provider.initiateVerification({
      userId: input.userId,
      country: input.country,
      level,
      ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {})
    });

    await this.prisma.client.kycVerification.upsert({
      where: {
        userId_providerName_level: {
          userId: input.userId,
          providerName: this.provider.name,
          level
        }
      },
      create: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        providerName: this.provider.name,
        providerReference: session.sessionId,
        country: input.country,
        level,
        status: "PENDING",
        submittedAt: new Date()
      },
      update: {
        providerReference: session.sessionId,
        status: "PENDING",
        submittedAt: new Date(),
        failureReason: null
      }
    });

    this.logger.log(`KYC initiated: userId=${input.userId} level=${level} session=${session.sessionId}`);

    return session;
  }

  async syncVerificationResult(userId: string, level: KycLevel = "STANDARD"): Promise<{
    status: string;
    verifiedName?: string;
    failureReason?: string;
  }> {
    if (!featureFlags.kycVerification) {
      throw new ServiceUnavailableException("KYC verification is not yet enabled");
    }

    const record = await this.prisma.client.kycVerification.findFirst({
      where: { userId, level, status: "PENDING" }
    });

    if (!record?.providerReference) {
      throw new BadRequestException("No pending KYC verification found for this user");
    }

    const result = await this.provider.getVerificationResult(record.providerReference);

    const nextStatus = result.status === "VERIFIED"
      ? "VERIFIED"
      : result.status === "FAILED"
      ? "FAILED"
      : result.status === "REQUIRES_ACTION"
      ? "REQUIRES_ACTION"
      : "PENDING";

    const isDone = nextStatus === "VERIFIED" || nextStatus === "FAILED";
    await this.prisma.client.kycVerification.update({
      where: { id: record.id },
      data: {
        status: nextStatus as "PENDING" | "VERIFIED" | "FAILED" | "REQUIRES_ACTION" | "NOT_STARTED" | "EXPIRED",
        failureReason: result.failureReason ?? null,
        completedAt: isDone ? new Date() : null,
        ...(result.metadata ? { metadata: result.metadata as object } : {})
      }
    });

    this.logger.log(`KYC synced: userId=${userId} level=${level} status=${nextStatus}`);

    return {
      status: nextStatus,
      ...(result.verifiedName ? { verifiedName: result.verifiedName } : {}),
      ...(result.failureReason ? { failureReason: result.failureReason } : {})
    };
  }

  async getKycStatus(userId: string): Promise<{
    level: string;
    status: string;
    submittedAt?: string;
    completedAt?: string;
  }[]> {
    const records = await this.prisma.client.kycVerification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return records.map((r) => ({
      level: r.level as string,
      status: r.status as string,
      ...(r.submittedAt ? { submittedAt: r.submittedAt.toISOString() } : {}),
      ...(r.completedAt ? { completedAt: r.completedAt.toISOString() } : {})
    }));
  }

  async isVerified(userId: string, minLevel: KycLevel = "STANDARD"): Promise<boolean> {
    const levelOrder: Record<KycLevel, number> = { LIGHT: 1, STANDARD: 2, ENHANCED: 3 };
    const minOrder = levelOrder[minLevel];

    const records = await this.prisma.client.kycVerification.findMany({
      where: { userId, status: "VERIFIED" }
    });

    return records.some((r) => levelOrder[r.level as KycLevel] >= minOrder);
  }
}
