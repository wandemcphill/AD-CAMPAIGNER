/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

async function requireAdmin(db: any, scope: AuthenticatedRequestContext) {
  const workspace = await db.workspace.findFirst({
    where: { id: scope.workspaceId, deletedAt: null },
    select: { organizationId: true }
  });
  if (!workspace) {
    throw new NotFoundException("Workspace was not found.");
  }

  const membership = await db.teamMember.findFirst({
    where: { userId: scope.userId, organizationId: workspace.organizationId, deletedAt: null },
    select: { role: true }
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    throw new ForbiddenException("Only workspace owners/admins can review marketplace applications.");
  }
}

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async listAgencies(query: { specialty?: string } = {}) {
    return this.db.marketplaceAgency.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query.specialty ? { specialty: query.specialty } : {})
      },
      orderBy: { ratingBps: "desc" }
    });
  }

  async listCreators(query: { niche?: string } = {}) {
    return this.db.marketplaceCreator.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query.niche ? { niche: query.niche } : {})
      },
      orderBy: { followerCount: "desc" }
    });
  }

  async applyAsAgency(
    input: { name: string; specialty: string; location: string; description: string; packages?: string[] },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);

    if (!input.name?.trim() || !input.specialty?.trim() || !input.location?.trim() || !input.description?.trim()) {
      throw new BadRequestException("Name, specialty, location, and description are required.");
    }

    return this.db.marketplaceAgencyApplication.create({
      data: {
        workspaceId: scope.workspaceId,
        applicantUserId: scope.userId,
        name: input.name.trim(),
        specialty: input.specialty.trim(),
        location: input.location.trim(),
        description: input.description.trim(),
        packages: input.packages ?? []
      }
    });
  }

  async applyAsCreator(
    input: {
      name: string;
      niche: string;
      bio: string;
      followerCount?: number;
      languages?: string[];
      platforms?: string[];
      rateMinor?: number;
    },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);

    if (!input.name?.trim() || !input.niche?.trim() || !input.bio?.trim()) {
      throw new BadRequestException("Name, niche, and bio are required.");
    }

    return this.db.marketplaceCreatorApplication.create({
      data: {
        workspaceId: scope.workspaceId,
        applicantUserId: scope.userId,
        name: input.name.trim(),
        niche: input.niche.trim(),
        bio: input.bio.trim(),
        followerCount: input.followerCount ?? 0,
        languages: input.languages ?? [],
        platforms: input.platforms ?? [],
        rateMinor: input.rateMinor ?? 0
      }
    });
  }

  async myApplications(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const [agencyApps, creatorApps] = await Promise.all([
      this.db.marketplaceAgencyApplication.findMany({
        where: { applicantUserId: scope.userId },
        orderBy: { createdAt: "desc" }
      }),
      this.db.marketplaceCreatorApplication.findMany({
        where: { applicantUserId: scope.userId },
        orderBy: { createdAt: "desc" }
      })
    ]);

    return {
      agencyApplications: agencyApps,
      creatorApplications: creatorApps
    };
  }

  async adminListApplications(
    query: { status?: string; type?: "agency" | "creator" },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    const statusFilter = query.status ? { status: query.status as any } : {};

    const [agencyApps, creatorApps] = await Promise.all([
      query.type === "creator"
        ? []
        : this.db.marketplaceAgencyApplication.findMany({
            where: statusFilter,
            include: { applicant: { select: { name: true, username: true } } },
            orderBy: { createdAt: "desc" }
          }),
      query.type === "agency"
        ? []
        : this.db.marketplaceCreatorApplication.findMany({
            where: statusFilter,
            include: { applicant: { select: { name: true, username: true } } },
            orderBy: { createdAt: "desc" }
          })
    ]);

    return { agencyApplications: agencyApps, creatorApplications: creatorApps };
  }

  async adminReviewAgencyApplication(
    id: string,
    decision: "APPROVED" | "REJECTED",
    rejectionReason: string | undefined,
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    const application = await this.db.marketplaceAgencyApplication.findFirst({
      where: { id, status: "PENDING" }
    });
    if (!application) {
      throw new NotFoundException("Application was not found or already reviewed.");
    }

    let resultingListingId: string | undefined;

    if (decision === "APPROVED") {
      const listing = await this.db.marketplaceAgency.create({
        data: {
          name: application.name,
          specialty: application.specialty,
          location: application.location,
          description: application.description,
          packages: application.packages,
          verified: false,
          isActive: true
        }
      });
      resultingListingId = listing.id;
    }

    await this.db.marketplaceAgencyApplication.update({
      where: { id: application.id },
      data: {
        status: decision,
        reviewedByUserId: scope.userId,
        reviewedAt: new Date(),
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(resultingListingId ? { resultingListingId } : {})
      }
    });

    await this.db.notification.create({
      data: {
        workspaceId: application.workspaceId,
        recipientUserId: application.applicantUserId,
        channel: "IN_APP",
        title: decision === "APPROVED" ? "Agency application approved" : "Agency application declined",
        body:
          decision === "APPROVED"
            ? `${application.name} is now listed in the Agency Marketplace.`
            : rejectionReason ?? "Your agency application was not approved this time.",
        entityType: "MarketplaceAgencyApplication",
        entityId: application.id
      }
    });

    return { ok: true, resultingListingId };
  }

  async adminReviewCreatorApplication(
    id: string,
    decision: "APPROVED" | "REJECTED",
    rejectionReason: string | undefined,
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    const application = await this.db.marketplaceCreatorApplication.findFirst({
      where: { id, status: "PENDING" }
    });
    if (!application) {
      throw new NotFoundException("Application was not found or already reviewed.");
    }

    let resultingListingId: string | undefined;

    if (decision === "APPROVED") {
      const listing = await this.db.marketplaceCreator.create({
        data: {
          name: application.name,
          niche: application.niche,
          bio: application.bio,
          followerCount: application.followerCount,
          languages: application.languages,
          platforms: application.platforms,
          rateMinor: application.rateMinor,
          currency: "NGN",
          verified: false,
          isActive: true
        }
      });
      resultingListingId = listing.id;
    }

    await this.db.marketplaceCreatorApplication.update({
      where: { id: application.id },
      data: {
        status: decision,
        reviewedByUserId: scope.userId,
        reviewedAt: new Date(),
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(resultingListingId ? { resultingListingId } : {})
      }
    });

    await this.db.notification.create({
      data: {
        workspaceId: application.workspaceId,
        recipientUserId: application.applicantUserId,
        channel: "IN_APP",
        title: decision === "APPROVED" ? "Creator application approved" : "Creator application declined",
        body:
          decision === "APPROVED"
            ? `${application.name} is now listed in the Creator Marketplace.`
            : rejectionReason ?? "Your creator application was not approved this time.",
        entityType: "MarketplaceCreatorApplication",
        entityId: application.id
      }
    });

    return { ok: true, resultingListingId };
  }

  async adminListAgencies(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    return this.db.marketplaceAgency.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  async adminListCreators(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    return this.db.marketplaceCreator.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  async adminSetAgencyActive(id: string, isActive: boolean, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    const agency = await this.db.marketplaceAgency.findFirst({ where: { id, deletedAt: null } });
    if (!agency) {
      throw new NotFoundException("Agency listing was not found.");
    }

    return this.db.marketplaceAgency.update({ where: { id: agency.id }, data: { isActive } });
  }

  async adminSetCreatorActive(id: string, isActive: boolean, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await requireAdmin(this.db, scope);

    const creator = await this.db.marketplaceCreator.findFirst({ where: { id, deletedAt: null } });
    if (!creator) {
      throw new NotFoundException("Creator listing was not found.");
    }

    return this.db.marketplaceCreator.update({ where: { id: creator.id }, data: { isActive } });
  }
}
