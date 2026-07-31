import { Injectable, Logger } from "@nestjs/common";
import type { DatabaseClient } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";

export interface VerificationResult {
  success: boolean;
  method: "AUTOMATIC" | "MANUAL_REVIEW" | "WEBHOOK";
  payload?: Record<string, unknown>;
  rejectionReason?: string;
}

interface VerificationContext {
  completionId: string;
  taskId: string;
  taskType: string;
  participantId: string;
  userId: string;
  verificationConfig: Record<string, unknown>;
  proofPayload: Record<string, unknown>;
}

@Injectable()
export class RewardVerificationService {
  private readonly logger = new Logger(RewardVerificationService.name);

  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  async verify(ctx: VerificationContext): Promise<VerificationResult> {
    switch (ctx.taskType) {
      case "QR_SCAN":
        return this.verifyQrScan(ctx);
      case "REFERRAL":
        return this.verifyReferral(ctx);
      case "FLIPTRYBE_LINK_VISIT":
        return this.verifyLinkVisit(ctx);
      case "TIKTOK_IDENTITY_BIND":
        return this.verifyTikTokBind(ctx);
      case "TIKTOK_VIDEO_PUBLISH":
        return this.verifyTikTokPublish(ctx);
      case "CONTENT_MILESTONE":
        return this.verifyContentMilestone(ctx);
      case "MANUAL_PROOF":
        return this.verifyManualProof(ctx);
      default:
        return { success: false, method: "AUTOMATIC", rejectionReason: `Unknown task type: ${ctx.taskType}` };
    }
  }

  private async verifyQrScan(ctx: VerificationContext): Promise<VerificationResult> {
    const token = (ctx.proofPayload as { token?: string }).token;

    if (!token) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "No QR token provided." };
    }

    const qrCode = await this.db.rewardQrCode.findUnique({ where: { token } });

    if (!qrCode) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "Invalid QR code." };
    }

    if (qrCode.expiresAt < new Date()) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "QR code has expired." };
    }

    if (qrCode.taskId !== ctx.taskId) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "QR code does not match this task." };
    }

    const affected = await this.db.$executeRaw`
      UPDATE "RewardQrCode"
      SET "scanCount" = "scanCount" + 1
      WHERE id = ${qrCode.id}
        AND "scanCount" < "maxScans"
    `;

    if (affected === 0) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "QR code scan limit reached." };
    }

    await this.recordEvent(ctx.completionId, "AUTOMATIC", true, { token });

    return { success: true, method: "AUTOMATIC", payload: { qrCodeId: qrCode.id } };
  }

  private async verifyReferral(ctx: VerificationContext): Promise<VerificationResult> {
    const referralCode = (ctx.proofPayload as { referralCode?: string }).referralCode;

    if (!referralCode) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "No referral code provided." };
    }

    const referralAccount = await this.db.referralAccount.findFirst({
      where: { code: referralCode }
    });

    if (!referralAccount) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "Invalid referral code." };
    }

    await this.recordEvent(ctx.completionId, "AUTOMATIC", true, { referralCode });

    return { success: true, method: "AUTOMATIC", payload: { referralAccountId: referralAccount.id } };
  }

  private async verifyLinkVisit(ctx: VerificationContext): Promise<VerificationResult> {
    const visitId = (ctx.proofPayload as { visitId?: string }).visitId;

    if (!visitId) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "No visit tracking ID provided." };
    }

    await this.recordEvent(ctx.completionId, "AUTOMATIC", true, { visitId });

    return { success: true, method: "AUTOMATIC", payload: { visitId } };
  }

  private async verifyTikTokBind(ctx: VerificationContext): Promise<VerificationResult> {
    const oauthToken = (ctx.proofPayload as { oauthToken?: string }).oauthToken;

    if (!oauthToken) {
      return { success: false, method: "AUTOMATIC", rejectionReason: "No TikTok OAuth token provided." };
    }

    await this.recordEvent(ctx.completionId, "AUTOMATIC", true, { bound: true });

    return { success: true, method: "AUTOMATIC", payload: { bound: true } };
  }

  private async verifyTikTokPublish(ctx: VerificationContext): Promise<VerificationResult> {
    await this.recordEvent(ctx.completionId, "WEBHOOK", false, { awaiting: "video.publish.completed" });

    return { success: false, method: "WEBHOOK", payload: { status: "awaiting_webhook" } };
  }

  private async verifyContentMilestone(ctx: VerificationContext): Promise<VerificationResult> {
    const config = ctx.verificationConfig as { minVideos?: number; minTotalViews?: number };
    const minVideos = config.minVideos ?? 1;

    const verifiedPublishes = await this.db.taskCompletion.count({
      where: {
        participantId: ctx.participantId,
        status: "VERIFIED",
        task: { taskType: "TIKTOK_VIDEO_PUBLISH" }
      }
    });

    if (verifiedPublishes < minVideos) {
      return {
        success: false,
        method: "AUTOMATIC",
        rejectionReason: `Only ${verifiedPublishes}/${minVideos} videos published.`
      };
    }

    await this.recordEvent(ctx.completionId, "AUTOMATIC", true, { verifiedPublishes });

    return { success: true, method: "AUTOMATIC", payload: { verifiedPublishes } };
  }

  private async verifyManualProof(_ctx: VerificationContext): Promise<VerificationResult> {
    return { success: false, method: "MANUAL_REVIEW", payload: { status: "awaiting_admin_review" } };
  }

  private async recordEvent(
    completionId: string,
    method: "AUTOMATIC" | "MANUAL_REVIEW" | "WEBHOOK",
    success: boolean,
    payload: Record<string, unknown>
  ) {
    await this.db.verificationEvent.create({
      data: {
        completionId,
        method,
        success,
        payload: payload as any
      }
    });
  }
}
