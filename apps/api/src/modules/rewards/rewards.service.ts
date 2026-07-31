import { createHmac, timingSafeEqual } from "crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { DatabaseClient } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { RewardVerificationService } from "./reward-verification.service";
import { RewardFulfillmentService } from "./reward-fulfillment.service";
import type {
  CreateRewardCampaignDto,
  UpdateRewardCampaignDto,
  AddRewardTaskDto,
  SubmitTaskCompletionDto,
  RewardCampaignQueryDto,
  GenerateQrCodesDto,
  ScanQrCodeDto,
  AdminResolveCompletionDto,
  AdminResolveEntitlementDto
} from "./rewards.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService,
    private readonly verification: RewardVerificationService,
    private readonly fulfillment: RewardFulfillmentService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Campaign CRUD ──────────────────────────────────────────────────────────

  async createCampaign(ctx: AuthenticatedRequestContext, dto: CreateRewardCampaignDto) {
    if (!Number.isInteger(dto.totalSlots) || dto.totalSlots <= 0) {
      throw new BadRequestException("totalSlots must be a positive integer.");
    }
    if (!Number.isInteger(dto.rewardValueMinor) || dto.rewardValueMinor <= 0) {
      throw new BadRequestException("rewardValueMinor must be a positive integer.");
    }

    const product = await this.db.voucherProduct.findUnique({
      where: { id: dto.rewardProductId }
    });
    if (!product || !product.active) {
      throw new BadRequestException("Invalid or inactive reward product.");
    }

    return this.db.rewardCampaign.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        totalSlots: dto.totalSlots,
        rewardProductId: dto.rewardProductId,
        rewardValueMinor: dto.rewardValueMinor,
        currency: dto.currency ?? "NGN",
        eligibilityRules: (dto.eligibilityRules ?? {}) as any,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null
      },
      include: { rewardProduct: true, tasks: true }
    });
  }

  async updateCampaign(ctx: AuthenticatedRequestContext, campaignId: string, dto: UpdateRewardCampaignDto) {
    const campaign = await this.db.rewardCampaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId }
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");

    if (dto.status && dto.status !== campaign.status) {
      const allowed = VALID_STATUS_TRANSITIONS[campaign.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${campaign.status} to ${dto.status}.`
        );
      }
    }

    return this.db.rewardCampaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.totalSlots !== undefined ? { totalSlots: dto.totalSlots } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.eligibilityRules !== undefined ? { eligibilityRules: dto.eligibilityRules as any } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {})
      },
      include: { rewardProduct: true, tasks: true }
    });
  }

  async listCampaigns(ctx: AuthenticatedRequestContext, query: RewardCampaignQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where = {
      workspaceId: ctx.workspaceId,
      ...(query.status ? { status: query.status } : {})
    };

    const [campaigns, total] = await Promise.all([
      this.db.rewardCampaign.findMany({
        where,
        include: { rewardProduct: true, tasks: true, _count: { select: { participants: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.rewardCampaign.count({ where })
    ]);

    return { campaigns, total, page, limit };
  }

  async getCampaign(ctx: AuthenticatedRequestContext, campaignId: string) {
    const campaign = await this.db.rewardCampaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId },
      include: {
        rewardProduct: true,
        tasks: { orderBy: { sortOrder: "asc" } },
        _count: { select: { participants: true, entitlements: true } }
      }
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    return campaign;
  }

  // ─── Task management ────────────────────────────────────────────────────────

  async addTask(ctx: AuthenticatedRequestContext, campaignId: string, dto: AddRewardTaskDto) {
    const campaign = await this.db.rewardCampaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId }
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    if (campaign.status !== "DRAFT") {
      throw new BadRequestException("Tasks can only be added to DRAFT campaigns.");
    }

    return this.db.rewardTask.create({
      data: {
        campaignId,
        taskType: dto.taskType,
        label: dto.label,
        description: dto.description ?? null,
        verificationConfig: (dto.verificationConfig ?? {}) as any,
        sortOrder: dto.sortOrder ?? 0,
        required: dto.required ?? true
      }
    });
  }

  // ─── Task completion pipeline ───────────────────────────────────────────────

  async submitTaskCompletion(
    ctx: AuthenticatedRequestContext,
    taskId: string,
    dto: SubmitTaskCompletionDto
  ) {
    const task = await this.db.rewardTask.findUniqueOrThrow({
      where: { id: taskId },
      include: { campaign: true }
    });

    const { campaign } = task;

    if (campaign.status !== "ACTIVE") {
      throw new BadRequestException("Campaign is not active.");
    }
    if (campaign.startsAt > new Date()) {
      throw new BadRequestException("Campaign has not started yet.");
    }
    if (campaign.endsAt && campaign.endsAt < new Date()) {
      throw new BadRequestException("Campaign has ended.");
    }
    if (campaign.claimedSlots >= campaign.totalSlots) {
      throw new BadRequestException("Campaign is full.");
    }

    const participant = await this.getOrCreateParticipant(campaign.id, ctx.userId);

    const existingCompletion = await this.db.taskCompletion.findUnique({
      where: { taskId_participantId: { taskId, participantId: participant.id } }
    });
    if (existingCompletion) {
      throw new ConflictException("Task already submitted.");
    }

    const completionId = uid("tc");
    const completion = await this.db.taskCompletion.create({
      data: {
        id: completionId,
        taskId,
        participantId: participant.id,
        proofPayload: (dto.proofPayload ?? {}) as any,
        idempotencyKey: `reward_tc_${taskId}_${ctx.userId}`
      }
    });

    const result = await this.verification.verify({
      completionId: completion.id,
      taskId: task.id,
      taskType: task.taskType,
      participantId: participant.id,
      userId: ctx.userId,
      verificationConfig: task.verificationConfig as Record<string, unknown>,
      proofPayload: (dto.proofPayload ?? {}) as Record<string, unknown>
    });

    if (result.method === "MANUAL_REVIEW" || result.method === "WEBHOOK") {
      return this.db.taskCompletion.findUniqueOrThrow({
        where: { id: completion.id },
        include: { task: true }
      });
    }

    if (result.success) {
      await this.db.taskCompletion.update({
        where: { id: completion.id },
        data: { status: "VERIFIED", verifiedAt: new Date(), metadata: (result.payload ?? {}) as any }
      });

      await this.checkQualificationAndReserve(participant.id, campaign.id);
    } else {
      await this.db.taskCompletion.update({
        where: { id: completion.id },
        data: { status: "REJECTED", rejectionReason: result.rejectionReason ?? null }
      });
    }

    return this.db.taskCompletion.findUniqueOrThrow({
      where: { id: completion.id },
      include: { task: true }
    });
  }

  async scanQrCode(ctx: AuthenticatedRequestContext, dto: ScanQrCodeDto) {
    const qrCode = await this.db.rewardQrCode.findUnique({ where: { token: dto.token } });
    if (!qrCode) throw new NotFoundException("Invalid QR code.");

    return this.submitTaskCompletion(ctx, qrCode.taskId, {
      proofPayload: { token: dto.token }
    });
  }

  // ─── TikTok webhook ───────────────────────────────────────────────────────

  async handleTikTokVideoWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ received: boolean }> {
    const secret = process.env.TIKTOK_WEBHOOK_SECRET;
    if (secret) {
      if (!signature) throw new UnauthorizedException("Missing TikTok webhook signature.");
      const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new UnauthorizedException("Invalid TikTok webhook signature.");
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Invalid webhook payload.");
    }

    const event = payload["event"] as string | undefined;
    if (event !== "video.publish.completed") {
      return { received: true };
    }

    const data = (payload["data"] ?? {}) as Record<string, unknown>;
    const videoId = data["video_id"] as string | undefined;
    const openId = data["open_id"] as string | undefined;

    if (!videoId) {
      this.logger.warn("TikTok webhook missing video_id", payload);
      return { received: true };
    }

    // Find all PENDING_VERIFICATION TIKTOK_VIDEO_PUBLISH completions matching this video
    const pending = await this.db.taskCompletion.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        task: { taskType: "TIKTOK_VIDEO_PUBLISH" }
      },
      include: { task: { select: { campaignId: true } }, participant: { select: { id: true } } }
    });

    const matches = pending.filter((c) => {
      const proof = c.proofPayload as Record<string, unknown>;
      const videoMatch = proof["videoId"] === videoId;
      const openIdMatch = !openId || proof["tiktokOpenId"] === openId;
      return videoMatch && openIdMatch;
    });

    await Promise.all(
      matches.map(async (completion) => {
        await this.db.taskCompletion.update({
          where: { id: completion.id },
          data: { status: "VERIFIED", verifiedAt: new Date(), metadata: { videoId, openId } as any }
        });

        await this.db.verificationEvent.create({
          data: {
            completionId: completion.id,
            method: "WEBHOOK",
            success: true,
            payload: { event, videoId, openId } as any
          }
        });

        await this.checkQualificationAndReserve(completion.participant.id, completion.task.campaignId);
      })
    );

    this.logger.log(`TikTok video.publish.completed: matched ${matches.length} pending completions for videoId=${videoId}`);
    return { received: true };
  }

  // ─── Qualification check + slot reservation ────────────────────────────────

  private async checkQualificationAndReserve(participantId: string, campaignId: string) {
    const requiredTasks = await this.db.rewardTask.findMany({
      where: { campaignId, required: true }
    });

    const completedTasks = await this.db.taskCompletion.findMany({
      where: {
        participantId,
        status: "VERIFIED",
        taskId: { in: requiredTasks.map((t) => t.id) }
      }
    });

    if (completedTasks.length < requiredTasks.length) {
      return null;
    }

    await this.db.rewardParticipant.update({
      where: { id: participantId },
      data: { completedAt: new Date() }
    });

    return this.tryReserveSlot(participantId, campaignId);
  }

  private async tryReserveSlot(participantId: string, campaignId: string) {
    const existingEntitlement = await this.db.rewardEntitlement.findUnique({
      where: { campaignId_participantId: { campaignId, participantId } }
    });
    if (existingEntitlement) return existingEntitlement;

    const affected = await this.db.$executeRaw`
      UPDATE "RewardCampaign"
      SET "claimedSlots" = "claimedSlots" + 1, "updatedAt" = NOW()
      WHERE id = ${campaignId}
        AND "claimedSlots" < "totalSlots"
        AND status = 'ACTIVE'
    `;

    if (affected === 0) {
      this.logger.log(`Campaign ${campaignId} is full — slot reservation failed.`);
      return null;
    }

    const campaign = await this.db.rewardCampaign.findUniqueOrThrow({
      where: { id: campaignId }
    });

    const entitlementId = uid("rent");
    const entitlement = await this.db.rewardEntitlement.create({
      data: {
        id: entitlementId,
        campaignId,
        participantId,
        rewardProductId: campaign.rewardProductId,
        rewardValueMinor: campaign.rewardValueMinor,
        currency: campaign.currency,
        idempotencyKey: `reward_ent_${campaignId}_${participantId}`
      }
    });

    if (campaign.claimedSlots + 1 >= campaign.totalSlots) {
      await this.db.rewardCampaign.update({
        where: { id: campaignId, status: "ACTIVE" },
        data: { status: "COMPLETED" }
      });
    }

    await this.queue.enqueueRewardFulfillment(entitlementId);
    await this.queue.enqueueLeaderboardRefresh(campaignId);

    this.logger.log(`Slot reserved for participant ${participantId} in campaign ${campaignId}`);

    return entitlement;
  }

  // ─── Participant helpers ────────────────────────────────────────────────────

  private async getOrCreateParticipant(campaignId: string, userId: string) {
    const existing = await this.db.rewardParticipant.findUnique({
      where: { campaignId_userId: { campaignId, userId } }
    });
    if (existing) return existing;

    return this.db.rewardParticipant.create({
      data: { campaignId, userId }
    });
  }

  // ─── User progress ─────────────────────────────────────────────────────────

  async getMyProgress(ctx: AuthenticatedRequestContext) {
    const participations = await this.db.rewardParticipant.findMany({
      where: { userId: ctx.userId },
      include: {
        campaign: {
          include: {
            rewardProduct: true,
            tasks: { orderBy: { sortOrder: "asc" } }
          }
        },
        completions: true,
        entitlements: { include: { fulfillment: true } }
      },
      orderBy: { joinedAt: "desc" }
    });

    return participations.map((p) => ({
      campaign: p.campaign,
      joinedAt: p.joinedAt,
      completedAt: p.completedAt,
      tasksCompleted: p.completions.filter((c) => c.status === "VERIFIED").length,
      totalTasks: p.campaign.tasks.filter((t) => t.required).length,
      entitlement: p.entitlements[0] ?? null
    }));
  }

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  async getLeaderboard(campaignId: string, page = 1, limit = 50) {
    const [entries, total] = await Promise.all([
      this.db.rewardLeaderboardEntry.findMany({
        where: { campaignId },
        orderBy: { rank: "asc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.rewardLeaderboardEntry.count({ where: { campaignId } })
    ]);

    return { entries, total, page, limit };
  }

  // ─── QR Code management ────────────────────────────────────────────────────

  async generateQrCodes(ctx: AuthenticatedRequestContext, campaignId: string, dto: GenerateQrCodesDto) {
    const campaign = await this.db.rewardCampaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId }
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");

    const task = await this.db.rewardTask.findFirst({
      where: { id: dto.taskId, campaignId }
    });
    if (!task || task.taskType !== "QR_SCAN") {
      throw new BadRequestException("Task must be a QR_SCAN task in this campaign.");
    }

    const codes = Array.from({ length: dto.count }, () => ({
      campaignId,
      taskId: dto.taskId,
      token: uid("qr"),
      maxScans: dto.maxScansPerCode ?? 1,
      expiresAt: new Date(dto.expiresAt)
    }));

    await this.db.rewardQrCode.createMany({ data: codes });

    return this.db.rewardQrCode.findMany({
      where: { campaignId, taskId: dto.taskId },
      orderBy: { createdAt: "desc" },
      take: dto.count
    });
  }

  async listQrCodes(ctx: AuthenticatedRequestContext, campaignId: string) {
    const campaign = await this.db.rewardCampaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId }
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");

    return this.db.rewardQrCode.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" }
    });
  }

  // ─── Admin: manual review ──────────────────────────────────────────────────

  async adminGetReviewQueue(page = 1, limit = 20) {
    const where = { status: "PENDING_VERIFICATION" as const };
    const [completions, total] = await Promise.all([
      this.db.taskCompletion.findMany({
        where,
        include: {
          task: { include: { campaign: true } },
          participant: { include: { user: true } }
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.taskCompletion.count({ where })
    ]);

    return { completions, total, page, limit };
  }

  async adminResolveCompletion(completionId: string, dto: AdminResolveCompletionDto, resolverUserId: string) {
    const completion = await this.db.taskCompletion.findUniqueOrThrow({
      where: { id: completionId },
      include: { task: { include: { campaign: true } } }
    });

    if (completion.status !== "PENDING_VERIFICATION") {
      throw new BadRequestException(`Completion is already ${completion.status}.`);
    }

    const updated = await this.db.taskCompletion.update({
      where: { id: completionId },
      data: {
        status: dto.resolution === "VERIFIED" ? "VERIFIED" : "REJECTED",
        verifiedAt: dto.resolution === "VERIFIED" ? new Date() : null,
        verifiedBy: resolverUserId,
        rejectionReason: dto.rejectionReason ?? null
      }
    });

    await this.db.verificationEvent.create({
      data: {
        completionId,
        method: "MANUAL_REVIEW",
        success: dto.resolution === "VERIFIED",
        payload: { resolverUserId, rejectionReason: dto.rejectionReason } as any
      }
    });

    if (dto.resolution === "VERIFIED") {
      await this.checkQualificationAndReserve(
        completion.participantId,
        completion.task.campaignId
      );
    }

    return updated;
  }

  async adminResolveEntitlement(entitlementId: string, dto: AdminResolveEntitlementDto) {
    return this.fulfillment.adminResolveFulfillment(
      entitlementId,
      dto.resolution,
      dto.reason
    );
  }

  // ─── Admin: campaign list ───────────────────────────────────────────────────

  async adminListCampaigns(page = 1, limit = 20) {
    const [campaigns, total] = await Promise.all([
      this.db.rewardCampaign.findMany({
        include: {
          rewardProduct: true,
          _count: { select: { participants: true, entitlements: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.rewardCampaign.count()
    ]);

    return { campaigns, total, page, limit };
  }
}
