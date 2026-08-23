import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

const DEFAULT_MIN_MARGIN_BPS = 200;

function assertNonNegativeInteger(value: unknown, field: string) {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer.`);
  }
}

function assertMarginBps(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 100_000) {
    throw new BadRequestException("minMarginBps must be between 0 and 100000 bps.");
  }
}

@Injectable()
export class AdminVtuCommercialService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async listCanonicalProducts(query: { network?: string; category?: string }) {
    const skus = await this.db.vtuCanonicalSku.findMany({
      where: {
        ...(query.network ? { network: query.network } : {}),
        ...(query.category ? { category: query.category } : {})
      },
      include: {
        providerMappings: {
          where: { active: true },
          orderBy: { costMinor: "asc" }
        }
      },
      orderBy: [{ network: "asc" }, { displayName: "asc" }]
    });

    return skus.map((sku) => {
      const cheapest = sku.providerMappings[0];
      const floorPriceMinor = cheapest
        ? Math.ceil(cheapest.costMinor * (1 + sku.minMarginBps / 10_000))
        : null;

      return {
        id: sku.id,
        displayName: sku.displayName,
        category: sku.category,
        network: sku.network,
        productFamily: sku.productFamily,
        sizeMb: sku.sizeMb,
        validityDays: sku.validityDays,
        planType: sku.planType,
        active: sku.active,
        adminApproved: sku.adminApproved,
        sellingPriceMinor: sku.sellingPriceMinor,
        minMarginBps: sku.minMarginBps,
        floorPriceMinor,
        cheapestCostMinor: cheapest?.costMinor ?? null,
        providerCount: sku.providerMappings.length,
        providers: sku.providerMappings.map((mapping) => ({
          id: mapping.id,
          providerName: mapping.providerName,
          providerSku: mapping.providerSku,
          providerProductName: mapping.providerProductName,
          costMinor: mapping.costMinor,
          active: mapping.active,
          adminApproved: mapping.adminApproved,
          pricingSourceType: mapping.pricingSourceType,
          lastSyncedAt: mapping.lastSyncedAt
        }))
      };
    });
  }

  async updateCanonicalProduct(
    id: string,
    patch: {
      sellingPriceMinor?: number | null;
      minMarginBps?: number;
      active?: boolean;
      adminApproved?: boolean;
    },
    _ctx: AuthenticatedRequestContext
  ) {
    const sku = await this.db.vtuCanonicalSku.findUnique({
      where: { id },
      include: {
        providerMappings: {
          where: { active: true },
          orderBy: { costMinor: "asc" },
          take: 1
        }
      }
    });

    if (!sku) throw new NotFoundException("Canonical VTU product not found.");

    const minMarginBps = patch.minMarginBps ?? sku.minMarginBps ?? DEFAULT_MIN_MARGIN_BPS;
    assertMarginBps(minMarginBps);

    if (patch.sellingPriceMinor !== undefined) {
      assertNonNegativeInteger(patch.sellingPriceMinor, "sellingPriceMinor");
    }

    const cheapest = sku.providerMappings[0];
    const floorPriceMinor = cheapest
      ? Math.ceil(cheapest.costMinor * (1 + minMarginBps / 10_000))
      : null;

    if (
      patch.sellingPriceMinor !== undefined &&
      patch.sellingPriceMinor !== null &&
      floorPriceMinor !== null &&
      patch.sellingPriceMinor < floorPriceMinor
    ) {
      throw new BadRequestException(
        `Selling price must be at least ₦${(floorPriceMinor / 100).toFixed(2)} to preserve the ${minMarginBps} bps minimum margin over the cheapest active provider cost.`
      );
    }

    if (patch.active === false && patch.sellingPriceMinor !== undefined) {
      throw new BadRequestException("Set the product active or inactive separately from pricing changes.");
    }

    return this.db.vtuCanonicalSku.update({
      where: { id },
      data: {
        ...(patch.sellingPriceMinor !== undefined
          ? { sellingPriceMinor: patch.sellingPriceMinor }
          : {}),
        ...(patch.minMarginBps !== undefined ? { minMarginBps: patch.minMarginBps } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.adminApproved !== undefined ? { adminApproved: patch.adminApproved } : {})
      },
      include: {
        providerMappings: {
          where: { active: true },
          orderBy: { costMinor: "asc" }
        }
      }
    });
  }
}
