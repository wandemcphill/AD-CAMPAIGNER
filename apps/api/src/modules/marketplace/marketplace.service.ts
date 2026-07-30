import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

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
}
